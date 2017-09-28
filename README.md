better-scroll 1.2.2 源码分析
===========================
## 说明
>  第一次写，在源码中若有分析不对或者没说明清楚，请直接在 Issues 中提出，我会尽快修改！

>  不懂使用的童鞋可以去 [better-scroll官方API文档](https://ustbhuangyi.github.io/better-scroll/doc/options.html "better-scroll 最新文档") 很详细。

>  如果对您有帮助，您可以点右上角 "Star" 支持我一下 谢谢！ ^_^

## 目录
```
|——src 
| |—— scroll : 核心功能
| |    |____ core : 处理滚动三大事件、滚动动画有关的函数。
| |    |____ event : 监听滚动时派发的操作事件 (发布/订阅者模式)
| |    |____ init : 初始化：参数配置、DOM 绑定事件、调用其他扩展插件
| |    |____ pulldown : 下拉刷新功能
| |    |____ pullup : 上拉加载更多功能
| |    |____ scrollbar : 生成滚动条、滚动时实时计算大小与位置
| |    |____ snap : 扩展的轮播图及一系列操作
| |    |____ wheel : 扩展的picker插件操作
| |—— util 工具库
| |    |____ debug : 发出警告
| |    |____ dom : 关于 dom 元素操作（缓存、浏览器兼容、绑定、事件、属性...）
| |    |____ ease : 贝塞尔曲线
| |    |____ lang : 获取时间戳、拷贝函数
| |    |____ momentum : 动量公式
| |    |____ raf : 定时器 requestAnimationFrame
| |——index.js 导入全部文件，调用初始化函数
```

## BScroll 整体思路

首先 BScroll 是滚动插件，必然是触发`touchstart`、`touchmove`、`touchend`事件。在 init.js 文件中 `_handleDOMEvents` 函数注册了该事件。

```javascript
BScroll.prototype._addDOMEvents = function () {
    // addEvent 是 dom.js 中的 addEventListener 方法
    let eventOperation = addEvent
    this._handleDOMEvents(eventOperation)
}

BScroll.prototype._handleDOMEvents = function (eventOperation) {
    let target = this.options.bindToWrapper ? this.wrapper : window
    // ...

    if (!this.options.disableMouse) {
      eventOperation(this.wrapper, 'mousedown', this)
      eventOperation(target, 'mousemove', this)
      eventOperation(target, 'mousecancel', this)
      eventOperation(target, 'mouseup', this)
    }

    // ...
  }
```
what? this 竟然被填写在了绑定事件里。搜索了下发现这么个东西 [动态改变事件处理器](http://www.tuicool.com/articles/JZrUB3z)。

- **handleEvent 与 addEventListener 关系：** 如果 addEvent 绑定的是一个对象(this)，那么该对象具有一个叫 `handleEvent` 属性的方法。
在页面中触发 `touchstart`、`touchmove`、`touchend` (等其他事件) 时，会自动调用 handleEvent 方法。 
 
```javascript
BScroll.prototype.handleEvent = function (e) {
    switch (e.type) {
      case 'touchstart':
      case 'mousedown':
        this._start(e)
        break
      // some code here...  
      case 'touchend':
      case 'mouseup':
      case 'touchcancel':
      case 'mousecancel':
        this._end(e)
        break
      // some code here...  
      case 'transitionend':
      case 'webkitTransitionEnd':
      case 'oTransitionEnd':
      case 'MSTransitionEnd':
        this._transitionEnd(e)
        break
      // some code here...
    }
  }
```

方法 `handleEvent` 中对移动端与PC端事件同时处理调用内置的 `_start` `_move` `_end`... 方法，下面来对分析。

#### _start 方法

```javascript
BScroll.prototype._start = function (e) {
    // _eventType：有两种情况表示当前的环境：1 = TOUCH_EVENT，2 = MOUSE_EVENT。(可在dom.js中查看eventType变量)
    let _eventType = eventType[e.type]
    // some code here...

    /**
     * 在下面 _eventType 赋值给了 initiated，在这里 initiated 却不等于 _eventType 一定有某些不可告人的原因！
     * 我觉得可能是解决某个中的bug吧，一般来说当前在 TOUCH_EVENT (移动端)中不会变成 MOUSE_EVENT (PC端)。
     * ^_^ 如果你知道的话，请 Issues 中提出！
     */
    if (!this.enabled || this.destroyed || (this.initiated && this.initiated !== _eventType)) {
      return
    }
    // initiated 会在触发 _end 方法是设置成 false 以便于下次 _start 重新进入，它也在 `_move` 方法用到了，去看看。
    this.initiated = _eventType
```

秋得嘛dei！在这里我们先了解下配置参数中的 `eventPassthrough` 用法，以便于下面更好解读。

- **options.eventPassthrough：** 在横向轮播图中，我们可以横向滚动，而纵向的滚动还是保留页面原生滚动，我们可以设置 eventPassthrough 为 vertical。

下面是 `_move` 方法中的片段代码。

```javascript
// If you are scrolling in one direction lock the other
if (!this.directionLocked && !this.options.freeScroll) {
  /** 
   *  absDistX：横向移动的距离
   *  absDistY：纵向移动的距离
   *  触摸开始位置移动到当前位置：横向距离 > 纵向距离，说明当前是在往水平方向(h)移动，反之垂直方向(v)移动。
   */
  if (absDistX > absDistY + this.options.directionLockThreshold) {
    this.directionLocked = 'h'    // lock horizontally
  } else if (absDistY >= absDistX + this.options.directionLockThreshold) {
    this.directionLocked = 'v'    // lock vertically
  } else {
    this.directionLocked = 'n'    // no lock
  }
}

if (this.directionLocked === 'h') {
  if (this.options.eventPassthrough === 'vertical') {
    // 设置为 vertical 的话说明希望保留纵向原生滚动，那么当前为横向轮播图，h方向滚动，则需要关闭默认事件防止触发其他操作。
    e.preventDefault()
  } else if (this.options.eventPassthrough === 'horizontal') {
    // 设置为 horizontal 的话说明希望保留横向原生滚动，那么当前为纵向轮播图，h方向滚动，则退出_move函数，会触发页面原生滚动。
    // 这里 initiated 设置成 false，下次进行触摸时，_start 方法可以进入执行。
    this.initiated = false
    return
  }
  // 横向滚动时，则纵向的数值清零，只能允许一个方向滚动。
  deltaY = 0
} else if (this.directionLocked === 'v') {
  // some code here...
}
```

总结下 initiated ：实际上在 `_move` `_end` 方法中 `this.initiated = false` 这段代码可以不写的。

因为有这句判断 `(this.initiated && this.initiated !== _eventType)`
（比如第一次进入 initiated 设置成了 1，下一次进入判断 initiated 是存在并且 `initiated !== _
eventType` (1 !== 1) 这句话是不成立的，可以继续进入）

那为什么要设置呢？我觉得 `initiated` 变量在这里定义是：表明当前正在滚动中并且属于移动端还是PC端。

我们继续往下看...

```javascript
  if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
    e.preventDefault()
  }
```

- **options.preventDefault：**  eventPassthrough 的设置会导致 preventDefault 无效，这里要注意。(就在我分析的版本案例中作者在snap轮播图就设置了eventPassthrough导致了PC端中拖拽时把图片默认事件一起拖拽了的问题，不过在后续版本已解决。)

- **preventDefaultException：** better-scroll 的实现会阻止原生的滚动，这样也同时阻止了一些原生组件的默认行为。
这个时候我们不能对这些元素做 preventDefault，所以我们可以配置 preventDefaultException。
默认值 {tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/}表示标签名为 input、textarea、button、select 这些元素的默认行为都不会被阻止。

以下是 `_start` 方法中定义的一些变量，用于 `_move` `_end` 方法进行操作判断等。

```javascript
  // moved 作用是为了在 `_move` 方法触发 scrollStart 函数。
  this.moved = false
  // 记录触摸开始位置到结束位置的距离
  this.distX = 0
  this.distY = 0
  // _end 函数判断移动的方向 -1(左或上方向) 0(默认) 1(右或下方向)
  this.directionX = 0
  this.directionY = 0
  // 在滚动的方向位置(h=水平、v=垂直)
  this.directionLocked = 0
  // 设置 transition 运动时间，不传参数设置为0 (core.js可查看)
  this._transitionTime()
  // 时间戳
  this.startTime = getNow()

  // ...

  // 若上一次滚动还在继续时，此时触发了_start，则停止跳当前滚动位置
  this.stop()

  let point = e.touches ? e.touches[0] : e

  // 在 _end 方法中用于计算快速滑动 flick
  this.startX = this.x
  this.startY = this.y
  // 在 _end 方法中给this.directionX|Y辨别方向
  this.absStartX = this.x
  this.absStartY = this.y
  // 记录当前的位置并移动时更新
  this.pointX = point.pageX
  this.pointY = point.pageY
  // better-scroll 还提供了一些事件，方便和外部做交互。如外部使用 on('beforeScrollStart') 方法来监听操作。
  this.trigger('beforeScrollStart')
}
```

`_start` 方法到这里就结束了，下面开始来分析 `_move` 方法。

#### _move 方法

```javascript
BScroll.prototype._move = function (e) {
    // some code here...

    // deltaX 触发一次 touchmove 的距离
    let deltaX = point.pageX - this.pointX
    let deltaY = point.pageY - this.pointY

    // 更新手指移动的位置
    this.pointX = point.pageX
    this.pointY = point.pageY

    // 累加上这移动一段的距离
    this.distX += deltaX
    this.distY += deltaY

    let absDistX = Math.abs(this.distX)
    let absDistY = Math.abs(this.distY)
    let timestamp = getNow()

    /**
     * endTime：开始为零，在 _end 方法中设置(时间戳)。
     * momentumLimitTime: 300。
     * momentumLimitDistance = 15。
     * 第一个条件：每次滚动的时间大于300ms说明比较缓慢的滚动，如果小于300ms则是快速的滚动(可能小于15px)，这种情况则继续执行
     * 第二个条件：需要移动至少15个像素来启动滚动
     */
    if (timestamp - this.endTime > this.options.momentumLimitTime && (absDistY < this.options.momentumLimitDistance && absDistX < this.options.momentumLimitDistance)) {
      return
    }

    // some code here...

    // 如果没有开启 freeScroll，只允许一个方向滚动，另一个方向则要清零。
    deltaX = this.hasHorizontalScroll ? deltaX : 0
    deltaY = this.hasVerticalScroll ? deltaY : 0

    // 最后滚动到的位置
    let newX = this.x + deltaX
    let newY = this.y + deltaY

    // 在边界之外慢下来或停止
    if (newX > 0 || newX < this.maxScrollX) {
      // bounce：是否开启回弹效果
      if (this.options.bounce) {
        newX = this.x + deltaX / 3
      } else {
        newX = newX > 0 ? 0 : this.maxScrollX
      }
    }
    // some code here...

    if (!this.moved) {
      // moved 作用是为了触发 scrollStart 函数。
      this.moved = true
      this.trigger('scrollStart')
    }

    this._translate(newX, newY)
```

`_translate：` 该方法执行元素滚动到指定（x, y）坐标位置上，有两种方法实现。

```javascript
BScroll.prototype._translate = function (x, y) {
    if (this.options.useTransform) {
      this.scrollerStyle[style.transform] = `translate(${x}px,${y}px)${this.translateZ}`
    } else {
      x = Math.round(x)
      y = Math.round(y)
      this.scrollerStyle.left = `${x}px`
      this.scrollerStyle.top = `${y}px`
    }

    // ...

    // 滚动时实时更新当前坐标
    this.x = x
    this.y = y

    // ...
  }
```

支持 `transition` CSS3属性的话使用 translate (及translateZ GPU硬件加速) 来滚动，否则兼容使用定位的 left、top值来滚动。

我们继续看...

```javascript
  if (timestamp - this.startTime > this.options.momentumLimitTime) {
    this.startTime = timestamp
    this.startX = this.x
    this.startY = this.y

    // ...
  }
```

为什么 `timestamp - this.startTime` (即触发 start 到 move 时用的时间) 大于 300ms，会重新赋值这3个参数？

分析：首先我们要知道快速滑动（flick）必须要在很短时间内才算是触发（BScroll中设置为300ms）。

如果这段距离时间大于300ms，在 `_end` 方法中是不会触发flick及momentum。下面代码来自 `_end` 方法。

```javascript
  let duration = this.endTime - this.startTime
  let absDistX = Math.abs(newX - this.startX)
  let absDistY = Math.abs(newY - this.startY)

  // _events.flick 什么时候是存在的？
  // 当调用了 snap.js 组件时才存在。（在snap.js的_initSnap方法中添加了一个 this.on('flick', fn) 的函数）
  if (this._events.flick && duration < this.options.flickLimitTime && absDistX < this.options.flickLimitDistance && absDistY < this.options.flickLimitDistance) {
    this.trigger('flick')
    return
  }

  // start momentum animation if needed
  if (this.options.momentum && duration < this.options.momentumLimitTime && (absDistY > this.options.momentumLimitDistance || absDistX > this.options.momentumLimitDistance)) {
    // some code here...
  } else {
    // code...
  }
```

所以：在 `_move` 方法中滑动的时间大于300ms，需要重新赋值计算，以便于在 `_end` 方法中可以触发flick及momentum。

```javascript
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
```

#### _end 方法

```javascript
BScroll.prototype._end = function (e) {
    // code...
    this.initiated = false

    // some code here...
    
    if (this.resetPosition(this.options.bounceTime, ease.bounce)) {
      return
    }
```

- **resetPosition：** 返回值两种情况：`true` `false`。作用：如果超出滚动范围之外，则滚动回 0 或 maxScroll 位置

```javascript
BScroll.prototype.resetPosition = function (time = 0, easeing = ease.bounce) {
    let x = this.x
    if (!this.hasHorizontalScroll || x > 0) {  // 在纵向滚动时则 x 固定为0 || x > 0 说明横向滚动(左边方向)超出了滚动的范围
      x = 0
    } else if (x < this.maxScrollX) { // maxScrollX 是为负数，当 x 小于 maxScrollX 时说明横向滚动(右边方向)超出了滚动的范围
      x = this.maxScrollX
    }

    let y = this.y
    if (!this.hasVerticalScroll || y > 0) { // 在横向滚动时 y 值固定为0 || y > 0 说明纵向(上边顶部)往下拖拽超出了滚动范围
      y = 0
    } else if (y < this.maxScrollY) {  // 同理..
      y = this.maxScrollY
    }

    // 如果位置没有发生变化，则不需要滚动直接退出。
    if (x === this.x && y === this.y) {
      return false
    }
    // 滚动到(x,y)值位置
    this.scrollTo(x, y, time, easeing)

    return true
  }
```

分析 `resetPosition`：在 `touchmove` 时候若拖拽超过 `maxScroll` 滚动范围，则 `touchend` 时触发该函数返回 `true`。

```javascript
    // 表示结束了 transition 过渡动画
    this.isInTransition = false

    // ensures that the last position is rounded
    let newX = Math.round(this.x)
    let newY = Math.round(this.y)

    // we scrolled less than 15 pixels
    if (!this.moved) {
      if (this.options.wheel) {
        // className = 'wheel-scroll' 说明点击的位置是中间的缝隙 注：wheel-item元素上下之间存在一些缝隙
        if (this.target && this.target.className === 'wheel-scroll') {
          let index = Math.abs(Math.round(newY / this.itemHeight))
          /** 
           * pointY：点击位置距离body的长度
           * offset('wheel-scroll').top：wheel-scroll元素距离body的(定位)长度(且加上自带的margin-top: 68px)
           * _offset：以上两个相加得出：中间选项位置距离你点击位置之间的长度及为偏移量
           */
          let _offset = Math.round((this.pointY + offset(this.target).top - this.itemHeight / 2) / this.itemHeight)
          this.target = this.items[index + _offset]
        }
        this.scrollToElement(this.target, this.options.wheel.adjustTime || 400, true, true, ease.swipe)
      } else {
        // 触发 click tap 事件
        // some code here...
      }
      this.trigger('scrollCancel')
      return
    }

    this.scrollTo(newX, newY)
```

自己截图画的 **wheel** 说明；
![wheel-scroll图片说明](http://wx4.sinaimg.cn/large/0063LHPIly1fjyek9hydqj30920fuq3k.jpg)

接下来看到的就是 `动量滚动` 当快速在屏幕上滑动一段距离的时候，会根据滑动的距离和时间计算出动量，并生成滚动动画。

```javascript
    // delta 为正或负数(下面辨别移动方向) = (结束位置 - 开始位置)
    let deltaX = newX - this.absStartX
    let deltaY = newY - this.absStartY

    // direction作用：在 snap 组件判断当前滑动到上一张还是下一张。
    this.directionX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0
    this.directionY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0

    this.endTime = getNow()
    
    // some code here...

    let time = 0
    // start momentum animation if needed
    if (
      this.options.momentum && 
      duration < this.options.momentumLimitTime && 
      (absDistY > this.options.momentumLimitDistance || absDistX > this.options.momentumLimitDistance)
    ) {
      let momentumX = this.hasHorizontalScroll ? momentum(this.x, this.startX, duration, this.maxScrollX, this.options.bounce ? this.wrapperWidth : 0, this.options)
        : {destination: newX, duration: 0}
      let momentumY = this.hasVerticalScroll ? momentum(this.y, this.startY, duration, this.maxScrollY, this.options.bounce ? this.wrapperHeight : 0, this.options)
        : {destination: newY, duration: 0}

      newX = momentumX.destination
      newY = momentumY.destination
      time = Math.max(momentumX.duration, momentumY.duration)
      // 因为开启动量滚动，所以继续启动 transition 过渡
      this.isInTransition = 1
    } else {
      // some code here...
    }
```

开启动量滚动的三个条件：`options.momentum` 配置、滑动时间需小于 `momentumLimitTime` 、移动距离需大于 `momentumLimitDistance`。调用完 `momentum` 方法后得出最后的位置与时间。

下面我们来看看 `momentum` 方法是如何实现的。

```javascript
/** 
 *  current  结束位置
 *  start    开始位置
 *  time     时长
 *  lowerMargin 滚动区域 maxScroll
 *  wrapperSize 当滚动超过边缘的时候会有一小段回弹动画 (bounce)
 *
 *  distance 距离
 *  speed    速度
 *  deceleration 减速度(系数) 0.001
 *  destination  目的地
 */
export function momentum(current, start, time, lowerMargin, wrapperSize, options) {
  let distance = current - start
  let speed = Math.abs(distance) / time

  let {deceleration, itemHeight, swipeBounceTime, wheel, swipeTime} = options
  let duration = swipeTime
  let rate = wheel ? 4 : 15
  // 惯性拖拽 = 最后的位置 + 速度 / 摩擦系数 * 方向
  let destination = current + speed / deceleration * (distance < 0 ? -1 : 1)

  if (wheel && itemHeight) {
    destination = Math.round(destination / itemHeight) * itemHeight
  }
  // 目的地(超过)最大的滚动范围 maxScroll
  if (destination < lowerMargin) {
    // wrapperSize 是否开启回弹
    destination = wrapperSize ? lowerMargin - (wrapperSize / rate * speed) : lowerMargin
    duration = swipeBounceTime
  } else if (destination > 0) {
    destination = wrapperSize ? wrapperSize / rate * speed : 0
    duration = swipeBounceTime
  }
  // 如果未触发以上两种条件(未到达边界)，则动量滚动到计算出来的位置

  return {
    destination: Math.round(destination),
    duration
  }
}
```

动量距离也拿到了，接下来就应该执行滚动了。

```javascript
    // some code here...

    // 进入执行滚动到最后的位置 (不相等说明开启了动量滚动，反之相等未开启)
    if (newX !== this.x || newY !== this.y) {
      // change easing function when scroller goes out of the boundaries
      if (newX > 0 || newX < this.maxScrollX || newY > 0 || newY < this.maxScrollY) {
        easing = ease.swipeBounce
      }
      // 最后滚动完毕
      this.scrollTo(newX, newY, time, easing)
      return
    }

    // some code here...
}
```



- **总结** `Bscroll` 插件中的3大核心方法就分析完毕了。回过头来看
