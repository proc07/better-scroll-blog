better-scroll 1.2.2 源码分析
===========================
## 说明
>  在源码中若有分析不对或者没说明清楚，请直接在 Issues 中提出，我会尽快修改！

>  better-scroll使用方法和参数的[官方文档](https://ustbhuangyi.github.io/better-scroll/doc/options.html "better-scroll 最新文档")，下面我将私有的方法和参数进行分析说明。

>  如果对您有帮助，您可以点右上角 "Star" 支持我一下 谢谢！ ^_^

## 目录
```
|
|——src
| |—— scroll : 核心代码
| |
| |—— util 工具库
| |    |____ dom : 对DOM操作的库，例如获取兼容浏览器的css前缀，获取元素相对位置，节点插入等
| |    |____ ease : 动画的运行阻尼系数
| |    |____ eventEmitter : 订阅发布
| |    |____ index : 导出当前util的所有库
| |    |____ lang : 封装H5优化动画的库
| |    |____ momentum : 回弹动画的库
| |
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

总结下 initiated ：实际上在 `_move` `_end` 方法中 `this.initiated = false` 这段代码可以不写的，因为有这句判断 `(this.initiated && this.initiated !== _eventType)`（比如第一次进入 initiated 设置成了 1，下一次进入判断 initiated 是存在并且 initiated !== _
eventType (1 !== 1) 这句话是不成立的，可以继续进入）那为什么要设置呢？我觉得 `initiated` 变量在这里定义是：表明当前正在滚动中并且属于移动端还是PC端。

```javascript
    if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }
```

```javascript
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
```
