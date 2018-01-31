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
    // wrapperSize = bounce 是否开启回弹
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