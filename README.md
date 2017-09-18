better-scroll [1.2.2] 源码分析
===========================
## 说明
>  在源码中若有分析不对或者某个方法没说明清楚，请直接在 Issues 中提出，我会尽快修改！

>  由于插件作者已经编写`公有`的使用方法和参数写成[文档](https://ustbhuangyi.github.io/better-scroll/doc/options.html "better-scroll 最新文档")，所以下面我将私有的方法和参数进行总结说明。

>  如果对您有帮助，您可以点右上角 "Star" 支持我一下 谢谢！ ^_^

## better-scroll 私有方法和参数

### core.js

* _start

* _move

* _end

* _resize
	当窗口的尺寸改变时，重新调用refresh，为了优化性能做了延时
* _startProbe

* _transitionTime

* _transitionTimingFunction

* _transitionEnd

* _translate

* _animate
