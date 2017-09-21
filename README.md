better-scroll 1.2.2 源码分析
===========================
## 说明
>  在源码中若有分析不对或者没说明清楚，请直接在 Issues 中提出，我会尽快修改！

>  better-scroll使用方法和参数的[官方文档](https://ustbhuangyi.github.io/better-scroll/doc/options.html "better-scroll 最新文档")，下面我将私有的方法和参数进行分析说明。

>  如果对您有帮助，您可以点右上角 "Star" 支持我一下 谢谢！ ^_^

## better-scroll 整体思路

首先 better-scroll 是滚动插件，必然是触发`touchstart`、`touchmove`、`touchend`事件。在 init.js 文件中 `_handleDOMEvents` 函数注册了该事件。

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
      case 'touchmove':
      case 'mousemove':
        this._move(e)
        break
      case 'touchend':
      case 'mouseup':
      case 'touchcancel':
      case 'mousecancel':
        this._end(e)
        break
      case 'orientationchange':
      case 'resize':
        this._resize()
        break
      case 'transitionend':
      case 'webkitTransitionEnd':
      case 'oTransitionEnd':
      case 'MSTransitionEnd':
        this._transitionEnd(e)
        break
      case 'click':
        if (this.enabled && !e._constructed) {
          e.preventDefault()
          e.stopPropagation()
        }
        break
    }
  }
```

`handleEvent` 方法中对移动端与PC端事件同时处理及 transitionend 兼容浏览器。下面来分析 `_start` `_move` `_end` ... 方法实现过程。

