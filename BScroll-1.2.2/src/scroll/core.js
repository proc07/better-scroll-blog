import {
  eventType,
  TOUCH_EVENT,
  preventDefaultException,
  tap,
  click,
  style,
  offset
} from '../util/dom'
import {ease} from '../util/ease'
import {momentum} from '../util/momentum'
import {requestAnimationFrame, cancelAnimationFrame} from '../util/raf'
import {getNow} from '../util/lang'

export function coreMixin(BScroll) {
  BScroll.prototype._start = function (e) {
    let _eventType = eventType[e.type]
    if (_eventType !== TOUCH_EVENT) {
      // PC端只允许左键点击
      if (e.button !== 0) {
        return
      }
    }

    if (!this.enabled || this.destroyed || (this.initiated && this.initiated !== _eventType)) {
      return
    }
    // _eventType 表示在TOUCH_EVENT(1)还是MOUSE_EVENT(2)中
    this.initiated = _eventType

    if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }
    // moved 为true时，表示正在移动中
    this.moved = false
    // 记录触摸开始位置到手指抬起结束位置的距离
    this.distX = 0
    this.distY = 0
    // _end函数判断移动的方向 -1(左边方向) 0(默认) 1(右边方向)
    this.directionX = 0
    this.directionY = 0
    // 滚动的方向位置(h=水平、v=垂直)
    this.directionLocked = 0

    this._transitionTime()
    this.startTime = getNow()

    if (this.options.wheel) {
      this.target = e.target
    }
    // 若上一次滚动还在继续时，此时触发了_start，则停止跳当前滚动
    this.stop()

    let point = e.touches ? e.touches[0] : e

    this.startX = this.x
    this.startY = this.y
    // 在_end函数中给this.directionX|Y辨别方向
    this.absStartX = this.x
    this.absStartY = this.y
    // 记录当前的位置并移动时更新
    this.pointX = point.pageX
    this.pointY = point.pageY

    this.trigger('beforeScrollStart')
  }

  BScroll.prototype._move = function (e) {
    if (!this.enabled || this.destroyed || eventType[e.type] !== this.initiated) {
      return
    }

    if (this.options.preventDefault) {
      e.preventDefault()
    }

    let point = e.touches ? e.touches[0] : e
    // 触摸一段距离，move当前坐标 - 上一次start开始坐标
    let deltaX = point.pageX - this.pointX
    let deltaY = point.pageY - this.pointY

    this.pointX = point.pageX
    this.pointY = point.pageY

    this.distX += deltaX
    this.distY += deltaY
    // absDistX|Y 用来判断是往哪个方向滚动的
    let absDistX = Math.abs(this.distX)
    let absDistY = Math.abs(this.distY)
    let timestamp = getNow()

    // We need to move at least momentumLimitDistance pixels for the scrolling to initiate
    if (timestamp - this.endTime > this.options.momentumLimitTime && (absDistY < this.options.momentumLimitDistance && absDistX < this.options.momentumLimitDistance)) {
      return
    }
    // If you are scrolling in one direction lock the other
    if (!this.directionLocked && !this.options.freeScroll) {
      // 触摸开始位置到当前移动位置：X轴距离 > Y轴距离 说明是在水平方向滚动
      if (absDistX > absDistY + this.options.directionLockThreshold) {
        this.directionLocked = 'h'		// lock horizontally
      } else if (absDistY >= absDistX + this.options.directionLockThreshold) {
        // Y轴距离 > X轴距离 说明是在垂直方向滚动
        this.directionLocked = 'v'		// lock vertically
      } else {
        this.directionLocked = 'n'		// no lock
      }
    }
    /**
     * eventPassthrough 表示忽略哪一个方向上的滚动，如果为vertical那么表示忽略垂直方向的滚动
     * h 当前正在水平方向滚动，v 当前正在垂直方向滚动
     */
    if (this.directionLocked === 'h') {
      if (this.options.eventPassthrough === 'vertical') {
        // 为横向滚动轮播图上h方向滚动，则关闭掉默认事件
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'horizontal') {
        // 为纵向滚动轮播图上h方向滚动，退出move函数，并页面原生滚动
        this.initiated = false
        return
      }
      // 水平方向滚动，则垂直方向的数值清0，以免计算滚动Y轴
      deltaY = 0
    } else if (this.directionLocked === 'v') {
      if (this.options.eventPassthrough === 'horizontal') {
        // 为纵向滚动轮播图上v方向滚动，则关闭掉默认事件
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'vertical') {
        // 为横向滚动轮播图上v方向滚动，退出move函数，并页面原生滚动
        this.initiated = false
        return
      }
      deltaX = 0
    }
    deltaX = this.hasHorizontalScroll ? deltaX : 0
    deltaY = this.hasVerticalScroll ? deltaY : 0

    let newX = this.x + deltaX
    let newY = this.y + deltaY

    // Slow down or stop if outside of the boundaries
    if (newX > 0 || newX < this.maxScrollX) {
      if (this.options.bounce) {
        newX = this.x + deltaX / 3
      } else {
        newX = newX > 0 ? 0 : this.maxScrollX
      }
    }
    if (newY > 0 || newY < this.maxScrollY) {
      if (this.options.bounce) {
        newY = this.y + deltaY / 3
      } else {
        newY = newY > 0 ? 0 : this.maxScrollY
      }
    }

    if (!this.moved) {
      this.moved = true
      this.trigger('scrollStart')
    }

    this._translate(newX, newY)

    if (timestamp - this.startTime > this.options.momentumLimitTime) {
      // 大于300ms是不会触发flick\momentum，赋值是为了重新计算，在_end函数中能够触发快速滑动、开启动量滚动
      this.startTime = timestamp
      this.startX = this.x
      this.startY = this.y

      if (this.options.probeType === 1) {
        this.trigger('scroll', {
          x: this.x,
          y: this.y
        })
      }
    }
    // 实时的派发 scroll 事件
    if (this.options.probeType > 1) {
      this.trigger('scroll', {
        x: this.x,
        y: this.y
      })
    }
    /**
     * document.documentElement.scrollLeft  获取页面文档向右滚动过的像素数 (FireFox和IE中)
     * document.body.scrollTop 获取页面文档向下滚动过的像素数  (Chrome、Opera、Safari中)
     * window.pageXOffset (所有主流浏览器都支持，IE 8 及 更早 IE 版本不支持该属性)
     */
    let scrollLeft = document.documentElement.scrollLeft || window.pageXOffset || document.body.scrollLeft
    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop
    // pointX 触摸点相对于页面的位置(包括页面原始滚动距离scrollLeft)
    let pX = this.pointX - scrollLeft
    let pY = this.pointY - scrollTop

    // 距离页面(上下左右边上)15px以内直接触发_end事件
    if (pX > document.documentElement.clientWidth - this.options.momentumLimitDistance || pX < this.options.momentumLimitDistance || pY < this.options.momentumLimitDistance || pY > document.documentElement.clientHeight - this.options.momentumLimitDistance
    ) {
      this._end(e)
    }
  }

  BScroll.prototype._end = function (e) {
    if (!this.enabled || this.destroyed || eventType[e.type] !== this.initiated) {
      return
    }
    this.initiated = false

    if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }

    this.trigger('touchEnd', {
      x: this.x,
      y: this.y
    })

    // if configure pull down refresh, check it first
    if (this.options.pullDownRefresh && this._checkPullDown()) {
      return
    }

    // reset if we are outside of the boundaries
    if (this.resetPosition(this.options.bounceTime, ease.bounce)) {
      return
    }
    this.isInTransition = false
    // ensures that the last position is rounded
    let newX = Math.round(this.x)
    let newY = Math.round(this.y)
    // we scrolled less than 15 pixels  触发点击事件
    if (!this.moved) {
      if (this.options.wheel) {
        // 触发说明点击的位置是中间的缝隙(wheel-item元素上下之间存在一些缝隙)
        if (this.target && this.target.className === 'wheel-scroll') {
          let index = Math.abs(Math.round(newY / this.itemHeight))
          /**
           * pointY：点击位置距离body的长度
           * offset([wheel-scroll]).top：wheel-scroll元素距离body的(定位)长度(且加上自带的margin-top: 68px)
           * _offset：以上两个相加得出：中间选项位置距离你点击位置之间的长度及为偏移量
           */
          let _offset = Math.round((this.pointY + offset(this.target).top - this.itemHeight / 2) / this.itemHeight)
          this.target = this.items[index + _offset]
        }
        this.scrollToElement(this.target, this.options.wheel.adjustTime || 400, true, true, ease.swipe)
      } else {
        if (this.options.tap) {
          tap(e, this.options.tap)
        }

        if (this.options.click) {
          click(e)
        }
      }
      this.trigger('scrollCancel')
      return
    }
    this.scrollTo(newX, newY)
    // 正或负数(下面辨别移动方向) =  结束位置 - 开始位置
    let deltaX = newX - this.absStartX
    let deltaY = newY - this.absStartY

    this.directionX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0
    this.directionY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0

    this.endTime = getNow()
    /**
     * startTime、startX、startY 在_move函数中移动超过300ms会重新赋值
     */
    let duration = this.endTime - this.startTime
    let absDistX = Math.abs(newX - this.startX)
    let absDistY = Math.abs(newY - this.startY)

    // flick 只有使用了snap组件才能执行
    if (this._events.flick && duration < this.options.flickLimitTime && absDistX < this.options.flickLimitDistance && absDistY < this.options.flickLimitDistance) {
      this.trigger('flick')
      return
    }

    let time = 0
    // start momentum animation if needed
    if (this.options.momentum && duration < this.options.momentumLimitTime && (absDistY > this.options.momentumLimitDistance || absDistX > this.options.momentumLimitDistance)) {
      let momentumX = this.hasHorizontalScroll ? momentum(this.x, this.startX, duration, this.maxScrollX, this.options.bounce ? this.wrapperWidth : 0, this.options)
        : {destination: newX, duration: 0}
      let momentumY = this.hasVerticalScroll ? momentum(this.y, this.startY, duration, this.maxScrollY, this.options.bounce ? this.wrapperHeight : 0, this.options)
        : {destination: newY, duration: 0}
      newX = momentumX.destination
      newY = momentumY.destination
      time = Math.max(momentumX.duration, momentumY.duration)
      this.isInTransition = 1
    } else {
      if (this.options.wheel) {
        newY = Math.round(newY / this.itemHeight) * this.itemHeight
        time = this.options.wheel.adjustTime || 400
      }
    }

    let easing = ease.swipe
    if (this.options.snap) {
      let snap = this._nearestSnap(newX, newY)
      this.currentPage = snap
      // time 以滚动的距离与300ms比较取值
      time = this.options.snapSpeed || Math.max(
          Math.max(
            Math.min(Math.abs(newX - snap.x), 1000),
            Math.min(Math.abs(newY - snap.y), 1000)
          ), 300)
      newX = snap.x
      newY = snap.y

      this.directionX = 0
      this.directionY = 0
      easing = ease.bounce
    }
    // 进入执行滚动到最后的位置(启动了动量)
    if (newX !== this.x || newY !== this.y) {
      // change easing function when scroller goes out of the boundaries
      if (newX > 0 || newX < this.maxScrollX || newY > 0 || newY < this.maxScrollY) {
        easing = ease.swipeBounce
      }
      this.scrollTo(newX, newY, time, easing)
      return
    }

    if (this.options.wheel) {
      this.selectedIndex = Math.abs(this.y / this.itemHeight) | 0
    }
    // 无缝切换
    this.trigger('scrollEnd', {
      x: this.x,
      y: this.y
    })
  }
  // 当窗口的尺寸改变时，重新调用refresh，为了优化性能做了延时
  BScroll.prototype._resize = function () {
    if (!this.enabled) {
      return
    }

    clearTimeout(this.resizeTimeout)
    this.resizeTimeout = setTimeout(() => {
      this.refresh()
    }, this.options.resizePolling)
  }
  // 滚动的时候实时派发scroll事件
  BScroll.prototype._startProbe = function () {
    cancelAnimationFrame(this.probeTimer)
    this.probeTimer = requestAnimationFrame(probe)

    let me = this

    function probe() {
      let pos = me.getComputedPosition()
      me.trigger('scroll', pos)
      // 是否还在滚动过程中，继续派发
      if (me.isInTransition) {
        me.probeTimer = requestAnimationFrame(probe)
      }
    }
  }
  // 该方法会设置运动时间，不传参数为0，即没有动画
  BScroll.prototype._transitionTime = function (time = 0) {
    this.scrollerStyle[style.transitionDuration] = time + 'ms'

    if (this.options.wheel) {
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].style[style.transitionDuration] = time + 'ms'
      }
    }

    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].transitionTime(time)
      }
    }
  }
  // 该方法设置运动的类型 贝塞尔曲线
  BScroll.prototype._transitionTimingFunction = function (easing) {
    this.scrollerStyle[style.transitionTimingFunction] = easing

    if (this.options.wheel) {
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].style[style.transitionTimingFunction] = easing
      }
    }

    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].transitionTimingFunction(easing)
      }
    }
  }
  // 每次滚动完，transition过渡结束后触发
  BScroll.prototype._transitionEnd = function (e) {
    if (e.target !== this.scroller || !this.isInTransition) {
      return
    }

    this._transitionTime()
    if (!this.pulling && !this.resetPosition(this.options.bounceTime, ease.bounce)) {
      this.isInTransition = false
      this.trigger('scrollEnd', {
        x: this.x,
        y: this.y
      })
    }
  }
  // 该方法执行元素滚动到指定位置
  BScroll.prototype._translate = function (x, y) {
    if (this.options.useTransform) {
      this.scrollerStyle[style.transform] = `translate(${x}px,${y}px)${this.translateZ}`
    } else {
      x = Math.round(x)
      y = Math.round(y)
      this.scrollerStyle.left = `${x}px`
      this.scrollerStyle.top = `${y}px`
    }

    if (this.options.wheel) {
      const {rotate = 25} = this.options.wheel
      for (let i = 0; i < this.items.length; i++) {
        let deg = rotate * (y / this.itemHeight + i)
        this.items[i].style[style.transform] = `rotateX(${deg}deg)`
      }
    }

    this.x = x
    this.y = y

    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].updatePosition()
      }
    }
  }
  // 使用原生定位(left|top)来计算滚动的位置
  BScroll.prototype._animate = function (destX, destY, duration, easingFn) {
    let me = this
    let startX = this.x
    let startY = this.y
    let startTime = getNow()
    let destTime = startTime + duration
    function step() {
      let now = getNow()
      // 超过时间立即结束
      if (now >= destTime) {
        me.isAnimating = false
        me._translate(destX, destY)

        if (!me.pulling && !me.resetPosition(me.options.bounceTime)) {
          me.trigger('scrollEnd', {
            x: me.x,
            y: me.y
          })
        }
        return
      }
      // 当前now等于 0 ~ 1 之间的系数
      now = (now - startTime) / duration
      let easing = easingFn(now)
      // destX - startX (需要滚动的距离) * (0 ~ 1之间的系数) + 开始位置
      let newX = (destX - startX) * easing + startX
      let newY = (destY - startY) * easing + startY

      me._translate(newX, newY)
      // 没到时间继续执行
      if (me.isAnimating) {
        requestAnimationFrame(step)
      }

      if (me.options.probeType === 3) {
        me.trigger('scroll', {
          x: this.x,
          y: this.y
        })
      }
    }

    this.isAnimating = true
    step()
  }
  // 相对于当前位置偏移滚动 x,y 的距离
  BScroll.prototype.scrollBy = function (x, y, time = 0, easing = ease.bounce) {
    x = this.x + x
    y = this.y + y

    this.scrollTo(x, y, time, easing)
  }
  // 滚动到指定的位置
  BScroll.prototype.scrollTo = function (x, y, time = 0, easing = ease.bounce) {
    // 是否在滚动中(即在过渡中，过渡结束后会清除)
    this.isInTransition = this.options.useTransition && time > 0 && (x !== this.x || y !== this.y)

    if (!time || this.options.useTransition) {
      // 设置运动类型、时间、执行滚动的方法
      this._transitionTimingFunction(easing.style)
      this._transitionTime(time)
      this._translate(x, y)
      // 实时派发scroll事件
      if (time && this.options.probeType === 3) {
        this._startProbe()
      }

      if (this.options.wheel) {
        if (y > 0) {
          this.selectedIndex = 0
        } else if (y < this.maxScrollY) {
          this.selectedIndex = this.items.length - 1
        } else {
          // |0 只保留整数部分，小数部分通过拿掉(|转换为2进制之后相加得到的结果)
          this.selectedIndex = Math.abs(y / this.itemHeight) | 0
        }
      }
    } else {
      // 解决不支持transition属性滚动，则用原生定位(left|top)来滚动
      this._animate(x, y, time, easing.fn)
    }
  }
  // 滚动到指定目标元素
  BScroll.prototype.scrollToElement = function (el, time, offsetX, offsetY, easing) {
    if (!el) {
      return
    }
    el = el.nodeType ? el : this.scroller.querySelector(el)

    if (this.options.wheel && el.className !== 'wheel-item') {
      return
    }
    // pos = el距离body长度 - wrapper距离body的长度
    let pos = offset(el)
    pos.left -= this.wrapperOffset.left
    pos.top -= this.wrapperOffset.top

    // if offsetX/Y are true we center the element to the screen
    if (offsetX === true) {
      offsetX = Math.round(el.offsetWidth / 2 - this.wrapper.offsetWidth / 2)
    }
    if (offsetY === true) {
      offsetY = Math.round(el.offsetHeight / 2 - this.wrapper.offsetHeight / 2)
    }
    pos.left -= offsetX || 0
    pos.top -= offsetY || 0
    // 边界处理
    pos.left = pos.left > 0 ? 0 : pos.left < this.maxScrollX ? this.maxScrollX : pos.left
    pos.top = pos.top > 0 ? 0 : pos.top < this.maxScrollY ? this.maxScrollY : pos.top

    if (this.options.wheel) {
      // 取整
      pos.top = Math.round(pos.top / this.itemHeight) * this.itemHeight
    }
    this.scrollTo(pos.left, pos.top, time, easing)
  }
  // 如果超出滚动范围之外，则滚动回 0 或 maxScroll 位置
  BScroll.prototype.resetPosition = function (time = 0, easeing = ease.bounce) {
    let x = this.x
    // 在纵向滚动时则 x 固定为0 || x > 0 说明横向滚动(左边方向)超出了滚动的范围
    if (!this.hasHorizontalScroll || x > 0) {
      x = 0
    } else if (x < this.maxScrollX) {
      // maxScrollX 是为负数，当 x 小于 maxScrollX 时说明横向滚动(右边方向)超出了滚动的范围
      x = this.maxScrollX
    }

    let y = this.y
    // 在横向滚动时 y 值固定为0 || y > 0 说明纵向(上边顶部)往下拖拽超出了滚动范围
    if (!this.hasVerticalScroll || y > 0) {
      y = 0
    } else if (y < this.maxScrollY) {
      y = this.maxScrollY
    }

    if (x === this.x && y === this.y) {
      return false
    }
    // 滚动到(x,y)值位置
    this.scrollTo(x, y, time, easeing)

    return true
  }
  // 获取this.scroller当前(x,y)的位置
  BScroll.prototype.getComputedPosition = function () {
    // 设置为null，获取到全部的属性值
    let matrix = window.getComputedStyle(this.scroller, null)
    let x
    let y

    if (this.options.useTransform) {
      // transform: "matrix(1, 0, 0, 1, 0, 0)"
      matrix = matrix[style.transform].split(')')[0].split(', ')
      x = +(matrix[12] || matrix[4])
      y = +(matrix[13] || matrix[5])
    } else {
      // +"101" === 101
      x = +matrix.left.replace(/[^-\d.]/g, '')
      y = +matrix.top.replace(/[^-\d.]/g, '')
    }

    return {
      x,
      y
    }
  }
  // 立即停止当前运行的滚动动画
  BScroll.prototype.stop = function () {
    // 如果还在滚动中
    if (this.options.useTransition && this.isInTransition) {
      this.isInTransition = false
      // 获取当前位置，设置
      let pos = this.getComputedPosition()
      this._translate(pos.x, pos.y)
      if (this.options.wheel) {
        this.target = this.items[Math.round(-pos.y / this.itemHeight)]
      } else {
        this.trigger('scrollEnd', {
          x: this.x,
          y: this.y
        })
      }
    } else if (!this.options.useTransition && this.isAnimating) {
      // 兼容没有使用css3 transition动画滚动的
      this.isAnimating = false
      this.trigger('scrollEnd', {
        x: this.x,
        y: this.y
      })
    }
  }

  BScroll.prototype.destroy = function () {
    this._removeDOMEvents()

    if (this.options.scrollbar) {
      this._removeScrollBars()
    }

    this.destroyed = true
    this.trigger('destroy')
  }
}