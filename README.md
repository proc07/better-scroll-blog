better-scroll 1.2.2 源码分析
===========================
## 说明
>  在源码中若有分析不对或者没说明清楚，请直接在 Issues 中提出，我会尽快修改！

>  better-scroll使用方法和参数的[官方文档](https://ustbhuangyi.github.io/better-scroll/doc/options.html "better-scroll 最新文档")，下面我将私有的方法和参数进行分析说明。

>  如果对您有帮助，您可以点右上角 "Star" 支持我一下 谢谢！ ^_^

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

方法 `handleEvent` 中对移动端与PC端事件同时处理及 transitionend 兼容各个浏览器。

在下面来分析 `_start` `_move` `_end`... 方法之前。BScroll 在 `_init` 初始化函数内会调用 `refresh` 方法来重新计算。

```javascript
BScroll.prototype.refresh = function () {
    // 浏览器为了取得正确的值会触发重排
    let rf = this.wrapper.offsetHeight

    this.wrapperWidth = parseInt(this.wrapper.style.width) || this.wrapper.clientWidth
    this.wrapperHeight = parseInt(this.wrapper.style.height) || this.wrapper.clientHeight

    this.scrollerWidth = parseInt(this.scroller.style.width) || this.scroller.clientWidth
    this.scrollerHeight = parseInt(this.scroller.style.height) || this.scroller.clientHeight

    const wheel = this.options.wheel
    if (wheel) {
      // some code here...
    } else {
      // 计算出 X、Y 轴最大可以滚动的范围
      this.maxScrollX = this.wrapperWidth - this.scrollerWidth
      this.maxScrollY = this.wrapperHeight - this.scrollerHeight
    }
    // 当前是否在水平方向滚动
    this.hasHorizontalScroll = this.options.scrollX && this.maxScrollX < 0
    // 当前是否在垂直方向滚动
    this.hasVerticalScroll = this.options.scrollY && this.maxScrollY < 0
     	
    // 不为水平方向时，将水平方向的值清除
    if (!this.hasHorizontalScroll) {
      this.maxScrollX = 0
      this.scrollerWidth = this.wrapperWidth
    }
    // 不为垂直方向时，将垂直方向的值清除
    if (!this.hasVerticalScroll) {
      this.maxScrollY = 0
      this.scrollerHeight = this.wrapperHeight
    }
    
    // ...
  }
```

