better-scroll [1.2.2] 源码分析
===========================
## 说明
>  在源码中若有分析不对或者没说明清楚，请直接在 Issues 中提出，我会尽快修改！

>  better-scroll使用方法和参数写成[官方文档](https://ustbhuangyi.github.io/better-scroll/doc/options.html "better-scroll 最新文档")，所以下面我将私有的方法和参数进行总结说明。

>  如果对您有帮助，您可以点右上角 "Star" 支持我一下 谢谢！ ^_^


## better-scroll 私有方法及内置变量

### core.js

* _start
	
	作用：函数对应 start 类型事件

* _move

	作用：函数对应 move 类型事件。

* _end

	作用：函数对应 end 类型事件

* _resize
	
	作用：当窗口的尺寸改变时，重新调用refresh，为了优化性能做了延时

* _startProbe
	
	作用：当options.probeType = 3时，滚动的时候实时派发scroll事件(left、top值)
	
* _transitionTime

	作用：该方法会设置运动时间，不传参数默认为0，即没有动画

* _transitionTimingFunction

	作用：该方法设置运动的类型(贝塞尔曲线)

* _transitionEnd

	作用：滚动完，transition过渡结束后触发，清除参数

* _translate

	作用：是平移运动的核心函数。支持 transform 和 left 两种移动方式

* _animate

	作用：使用 requestAnimationFrame 作为定时器来滚动到指定的位置
