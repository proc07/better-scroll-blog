import {getRect, prepend} from '../util/dom'
import {ease} from '../util/ease'

export function snapMixin(BScroll) {
  // 克隆节点用于无缝滚动及载入一些方法this.on(refresh scrollEnd flick)
  BScroll.prototype._initSnap = function () {
    // 存入当前的位置
    this.currentPage = {}
    const snap = this.options.snap
    /**
     * 克隆前后两个节点，用于无缝滚动
     * 如：before [0,1,2] -> after [2,0,1,2,0]
     */
    if (snap.loop) {
      let children = this.scroller.children
      if (children.length > 0) {
        prepend(children[children.length - 1].cloneNode(true), this.scroller)
        this.scroller.appendChild(children[1].cloneNode(true))
      }
    }

    let el = snap.el
    // 设置了string，那么下面通过getRect来得到元素的位置信息
    if (typeof el === 'string') {
      el = this.scroller.querySelectorAll(el)
    }
    // 重新计算snap组件中pages参数
    this.on('refresh', () => {
      // 将每一张轮播图的值，存入到this.pages中
      this.pages = []
      if (!this.wrapperWidth || !this.wrapperHeight || !this.scrollerWidth || !this.scrollerHeight) {
        return
      }
      // 一张轮播图的宽高
      let stepX = snap.stepX || this.wrapperWidth
      let stepY = snap.stepY || this.wrapperHeight

      let x = 0
      let y
      let cx
      let cy
      let i = 0
      let l
      let m = 0
      let n
      let rect
      if (!el) {
        cx = Math.round(stepX / 2)
        cy = Math.round(stepY / 2)

        while (x > -this.scrollerWidth) {
          this.pages[i] = []
          l = 0
          y = 0

          while (y > -this.scrollerHeight) {
            // i 表示第几列
            // l 表示第几行
            this.pages[i][l] = {
              // 标记每一张轮播图的x,y的坐标
              x: Math.max(x, this.maxScrollX),
              y: Math.max(y, this.maxScrollY),
              width: stepX,
              height: stepY,
              // 标记当前轮播图的中间坐标位置
              cx: x - cx,
              cy: y - cy
            }
            // y = 0, -wrapperHeight, -wrapperHeight*2...  -this.scrollerHeight
            y -= stepY
            l++
          }
          // x = 0 , -wrapperWidth, -wrapperWidth*2...  -this.scrollerWidth
          x -= stepX
          i++
        }
      } else {
        l = el.length
        n = -1

        for (; i < l; i++) {
          rect = getRect(el[i])
          // i.left <= [i - 1].left 水平方向滚动时不成立
          if (i === 0 || rect.left <= getRect(el[i - 1]).left) {
            // m = 0 说明当前是个垂直方向滚动的轮播图
            m = 0
            n++
          }

          if (!this.pages[m]) {
            this.pages[m] = []
          }
          x = Math.max(-rect.left, this.maxScrollX)
          y = Math.max(-rect.top, this.maxScrollY)
          cx = x - Math.round(rect.width / 2)
          cy = y - Math.round(rect.height / 2)
          // m 表示第几列
          // n 表示第几行
          this.pages[m][n] = {
            x: x,
            y: y,
            width: rect.width,
            height: rect.height,
            cx: cx,
            cy: cy
          }
          // 水平方向滚动的轮播图 m++
          if (x > this.maxScrollX) {
            m++
          }
        }
      }

      // 注：上面 cloneNode 无缝滚动，起始位置为第二个及索引(1)
      let initPage = snap.loop ? 1 : 0
      // 滚动到 this.pages 数组中相对应的位置
      this.goToPage(this.currentPage.pageX || initPage, this.currentPage.pageY || 0, 0)

      // Update snap threshold if needed
      const snapThreshold = snap.threshold
      if (snapThreshold % 1 === 0) {
        this.snapThresholdX = snapThreshold
        this.snapThresholdY = snapThreshold
      } else {
        // 快速滑动大于snapThresholdX值时，就滚动到下一张
        this.snapThresholdX = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].width * snapThreshold)
        this.snapThresholdY = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].height * snapThreshold)
      }
    })
    // 滚动结束后，在索引0或length-1时，切换当前位置达到无缝滚动
    this.on('scrollEnd', () => {
      if (snap.loop) {
        if (this.currentPage.pageX === 0) {
          this.goToPage(this.pages.length - 2, this.currentPage.pageY, 0)
        }
        if (this.currentPage.pageX === this.pages.length - 1) {
          this.goToPage(1, this.currentPage.pageY, 0)
        }
      }
    })
    // fastclick 快速滑动切换到下一张
    this.on('flick', () => {
      let time = snap.speed || Math.max(
          Math.max(
            Math.min(Math.abs(this.x - this.startX), 1000),
            Math.min(Math.abs(this.y - this.startY), 1000)
          ), 300)

      this.goToPage(
        this.currentPage.pageX + this.directionX,
        this.currentPage.pageY + this.directionY,
        time
      )
    })
  }
  // 滚动到(x,y)坐标获取最近的一张轮播图的位置
  BScroll.prototype._nearestSnap = function (x, y) {
    if (!this.pages.length) {
      return {x: 0, y: 0, pageX: 0, pageY: 0}
    }

    let i = 0
    // Check if we exceeded the snap threshold 注：滚动的距离小于Threshold值则不触发
    if (Math.abs(x - this.absStartX) <= this.snapThresholdX &&
      Math.abs(y - this.absStartY) <= this.snapThresholdY) {
      return this.currentPage
    }
    // 边界限制
    if (x > 0) {
      x = 0
    } else if (x < this.maxScrollX) {
      x = this.maxScrollX
    }

    if (y > 0) {
      y = 0
    } else if (y < this.maxScrollY) {
      y = this.maxScrollY
    }
    // 当前x坐标获取pages数组中最近的轮播图位置
    let l = this.pages.length
    for (; i < l; i++) {
      if (x >= this.pages[i][0].cx) {
        x = this.pages[i][0].x
        break
      }
    }

    l = this.pages[i].length

    let m = 0
    for (; m < l; m++) {
      if (y >= this.pages[0][m].cy) {
        y = this.pages[0][m].y
        break
      }
    }
    // 如果滚动距离没有超过宽度的一半时，上面2个for循环得到的位置还是原来的，所以 i === pageX
    if (i === this.currentPage.pageX) {
      // directionX(-1、0、1) 当前滚动的方向
      i += this.directionX

      if (i < 0) {
        i = 0
      } else if (i >= this.pages.length) {
        i = this.pages.length - 1
      }

      x = this.pages[i][0].x
    }

    if (m === this.currentPage.pageY) {
      m += this.directionY

      if (m < 0) {
        m = 0
      } else if (m >= this.pages[0].length) {
        m = this.pages[0].length - 1
      }

      y = this.pages[0][m].y
    }

    return {
      x,
      y,
      pageX: i,
      pageY: m
    }
  }
  // 滚动到this.pages中指定的位置
  BScroll.prototype.goToPage = function (x, y, time, easing = ease.bounce) {
    const snap = this.options.snap
    // 边界限制
    if (x >= this.pages.length) {
      x = this.pages.length - 1
    } else if (x < 0) {
      x = 0
    }

    if (y >= this.pages[x].length) {
      y = this.pages[x].length - 1
    } else if (y < 0) {
      y = 0
    }

    let posX = this.pages[x][y].x
    let posY = this.pages[x][y].y

    time = time === undefined ? snap.speed || Math.max(
        Math.max(
          Math.min(Math.abs(posX - this.x), 1000),
          Math.min(Math.abs(posY - this.y), 1000)
        ), 300) : time

    this.currentPage = {
      x: posX,
      y: posY,
      pageX: x,
      pageY: y
    }
    this.scrollTo(posX, posY, time, easing)
  }

  BScroll.prototype.next = function (time, easing) {
    let x = this.currentPage.pageX
    let y = this.currentPage.pageY
    // 默认水平方向滚动
    x++
    // 下面走垂直方向滚动
    if (x >= this.pages.length && this.hasVerticalScroll) {
      x = 0
      y++
    }

    this.goToPage(x, y, time, easing)
  }

  BScroll.prototype.prev = function (time, easing) {
    let x = this.currentPage.pageX
    let y = this.currentPage.pageY

    x--
    if (x < 0 && this.hasVerticalScroll) {
      x = 0
      y--
    }

    this.goToPage(x, y, time, easing)
  }

  BScroll.prototype.getCurrentPage = function () {
    return this.options.snap && this.currentPage
  }
}