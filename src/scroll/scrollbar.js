import {style} from '../util/dom'

const INDICATOR_MIN_LEN = 8

export function scrollbarMixin(BScroll) {
  BScroll.prototype._initScrollbar = function () {
    const {fade = true} = this.options.scrollbar
    this.indicators = []
    let indicator

    if (this.options.scrollX) {
      indicator = {
        el: createScrollbar('horizontal'),
        direction: 'horizontal',
        fade
      }
      this._insertScrollBar(indicator.el)

      this.indicators.push(new Indicator(this, indicator))
    }

    if (this.options.scrollY) {
      indicator = {
        el: createScrollbar('vertical'),
        direction: 'vertical',
        fade
      }
      this._insertScrollBar(indicator.el)
      this.indicators.push(new Indicator(this, indicator))
    }

    this.on('refresh', () => {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].refresh()
      }
    })
    // 在滚动时候触发indicator进行显示或隐藏
    if (fade) {
      this.on('scrollEnd', () => {
        for (let i = 0; i < this.indicators.length; i++) {
          this.indicators[i].fade()
        }
      })

      this.on('scrollCancel', () => {
        for (let i = 0; i < this.indicators.length; i++) {
          this.indicators[i].fade()
        }
      })

      this.on('scrollStart', () => {
        for (let i = 0; i < this.indicators.length; i++) {
          this.indicators[i].fade(true)
        }
      })

      this.on('beforeScrollStart', () => {
        for (let i = 0; i < this.indicators.length; i++) {
          this.indicators[i].fade(true, true)
        }
      })
    }
  }

  BScroll.prototype._insertScrollBar = function (scrollbar) {
    this.wrapper.appendChild(scrollbar)
  }

  BScroll.prototype._removeScrollBars = function () {
    for (var i = 0; i < this.indicators.length; i++) {
      let indicator = this.indicators[i]
      indicator.remove()
    }
  }
}
// 创建Scrollbar DOM元素
function createScrollbar(direction) {
  let scrollbar = document.createElement('div')
  let indicator = document.createElement('div')

  scrollbar.style.cssText = 'position:absolute;z-index:9999;pointerEvents:none'
  indicator.style.cssText = 'box-sizing:border-box;position:absolute;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.9);border-radius:3px;'

  indicator.className = 'bscroll-indicator'

  if (direction === 'horizontal') {
    scrollbar.style.cssText += ';height:7px;left:2px;right:2px;bottom:0'
    indicator.style.height = '100%'
    scrollbar.className = 'bscroll-horizontal-scrollbar'
  } else {
    scrollbar.style.cssText += ';width:7px;bottom:2px;top:2px;right:1px'
    indicator.style.width = '100%'
    scrollbar.className = 'bscroll-vertical-scrollbar'
  }

  scrollbar.style.cssText += ';overflow:hidden'
  scrollbar.appendChild(indicator)

  return scrollbar
}
// 滚动条初始化
function Indicator(scroller, options) {
  // 此处的wrapper是Indicator DOM对象
  this.wrapper = options.el
  this.wrapperStyle = this.wrapper.style
  this.indicator = this.wrapper.children[0]
  this.indicatorStyle = this.indicator.style
  // BScroll
  this.scroller = scroller
  this.direction = options.direction
  if (options.fade) {
    this.visible = 0
    this.wrapperStyle.opacity = '0'
  } else {
    this.visible = 1
  }
}

Indicator.prototype.refresh = function () {
  this.transitionTime()
  this._calculate()
  this.updatePosition()
}
// 滚动条显示、隐藏
Indicator.prototype.fade = function (visible, hold) {
  if (hold && !this.visible) {
    return
  }

  let time = visible ? 250 : 500

  visible = visible ? '1' : '0'

  this.wrapperStyle[style.transitionDuration] = time + 'ms'

  clearTimeout(this.fadeTimeout)
  this.fadeTimeout = setTimeout(() => {
    this.wrapperStyle.opacity = visible
    this.visible = +visible
  }, 0)
}
// 更新滚动条的高度及滚动到的位置
Indicator.prototype.updatePosition = function () {
  if (this.direction === 'vertical') {
    // y = 计算滚动条滚动到的距离
    let y = Math.round(this.sizeRatioY * this.scroller.y)

    // 超出边界时缩小滚动条的高度(原来滚动条的高 - 超出的长度 * 系数3)
    if (y < 0) {
      this.transitionTime(500)
      const height = Math.max(this.indicatorHeight + y * 3, INDICATOR_MIN_LEN)
      this.indicatorStyle.height = `${height}px`
      y = 0
    } else if (y > this.maxPosY) {
      this.transitionTime(500)
      const height = Math.max(this.indicatorHeight - (y - this.maxPosY) * 3, INDICATOR_MIN_LEN)
      this.indicatorStyle.height = `${height}px`
      y = this.maxPosY + this.indicatorHeight - height
    } else {
      this.indicatorStyle.height = `${this.indicatorHeight}px`
    }
    this.y = y

    if (this.scroller.options.useTransform) {
      this.indicatorStyle[style.transform] = `translateY(${y}px)${this.scroller.translateZ}`
    } else {
      this.indicatorStyle.top = `${y}px`
    }
  } else {
    let x = Math.round(this.sizeRatioX * this.scroller.x)

    if (x < 0) {
      this.transitionTime(500)
      const width = Math.max(this.indicatorWidth + x * 3, INDICATOR_MIN_LEN)
      this.indicatorStyle.width = `${width}px`
      x = 0
    } else if (x > this.maxPosX) {
      this.transitionTime(500)
      const width = Math.max(this.indicatorWidth - (x - this.maxPosX) * 3, INDICATOR_MIN_LEN)
      this.indicatorStyle.width = `${width}px`
      x = this.maxPosX + this.indicatorWidth - width
    } else {
      this.indicatorStyle.width = `${this.indicatorWidth}px`
    }

    this.x = x

    if (this.scroller.options.useTransform) {
      this.indicatorStyle[style.transform] = `translateX(${x}px)${this.scroller.translateZ}`
    } else {
      this.indicatorStyle.left = `${x}px`
    }
  }
}
// 清除过度时间
Indicator.prototype.transitionTime = function (time = 0) {
  this.indicatorStyle[style.transitionDuration] = time + 'ms'
}

Indicator.prototype.transitionTimingFunction = function (easing) {
  this.indicatorStyle[style.transitionTimingFunction] = easing
}

Indicator.prototype.remove = function () {
  this.wrapper.parentNode.removeChild(this.wrapper)
}
// 计算滚动条高度、滚动范围、比值
Indicator.prototype._calculate = function () {
  if (this.direction === 'vertical') {
    // 滚动区域的可视高度
    let wrapperHeight = this.wrapper.clientHeight
    // 计算出滚动条的高度
    this.indicatorHeight = Math.max(Math.round(wrapperHeight * wrapperHeight / (this.scroller.scrollerHeight || wrapperHeight || 1)), INDICATOR_MIN_LEN)
    this.indicatorStyle.height = `${this.indicatorHeight}px`
    // 滚动条在可视区能滚动多长的距离
    this.maxPosY = wrapperHeight - this.indicatorHeight
    // 得出一个比值(indicator可滚动的长度/scroller可滚动长度)，以便scroller滚动了多少距离，乘上比值计算出indicator滚动了多少
    this.sizeRatioY = this.maxPosY / this.scroller.maxScrollY
  } else {
    let wrapperWidth = this.wrapper.clientWidth
    this.indicatorWidth = Math.max(Math.round(wrapperWidth * wrapperWidth / (this.scroller.scrollerHeight || wrapperWidth || 1)), INDICATOR_MIN_LEN)
    this.indicatorStyle.width = `${this.indicatorWidth}px`

    this.maxPosX = wrapperWidth - this.indicatorWidth

    this.sizeRatioX = this.maxPosX / this.scroller.maxScrollX
  }
}

