export function eventMixin(BScroll) {
  // 添加一个（名称和事件方法）到_events对象中
  BScroll.prototype.on = function (type, fn, context = this) {
    if (!this._events[type]) {
      this._events[type] = []
    }

    this._events[type].push([fn, context])
  }
  // 添加事件方法进去，在trigger调用一次移除该事件方法
  BScroll.prototype.once = function (type, fn, context = this) {
    let fired = false
    function magic() {
      this.off(type, magic)
      if (!fired) {
        fired = true
        fn.apply(context, arguments)
      }
    }
    this.on(type, magic)
  }
  // 移除_events对象中的指定方法
  BScroll.prototype.off = function (type, fn) {
    let _events = this._events[type]
    if (!_events) {
      return
    }

    let count = _events.length
    while (count--) {
      if (_events[count][0] === fn) {
        _events[count][0] = undefined
      }
    }
  }
  // 调用执行_events对象中的方法
  BScroll.prototype.trigger = function (type) {
    let events = this._events[type]
    if (!events) {
      return
    }

    let len = events.length
    // 深度拷贝
    let eventsCopy = [...events]
    for (let i = 0; i < len; i++) {
      let event = eventsCopy[i]
      // 解构赋值
      let [fn, context] = event
      if (fn) {
        fn.apply(context, [].slice.call(arguments, 1))
      }
    }
  }
}