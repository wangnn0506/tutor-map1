import { useEffect, useRef } from 'react'
import type { Point } from './jobs'

export interface View {
  center: Point
  zoom: number
  width: number
  height: number
}

export function scale(view: View) {
  return Math.min(view.width / .27, view.height / .27) * 2 ** (view.zoom - 11)
}

export function project(point: Point, view: View): Point {
  const ratio = scale(view)
  return [view.width / 2 + (point[0] - view.center[0]) * ratio, view.height / 2 - (point[1] - view.center[1]) * ratio]
}

const river: Point[] = [[120.08,30.117],[120.124,30.156],[120.191,30.195],[120.216,30.232],[120.257,30.257],[120.323,30.275],[120.38,30.315]]
const lake: Point[] = [[120.135,30.257],[120.126,30.25],[120.127,30.24],[120.137,30.23],[120.148,30.233],[120.155,30.241],[120.155,30.252],[120.149,30.26]]
const labels: [string, Point][] = [['拱墅区',[120.168,30.32]],['西湖区',[120.108,30.249]],['上城区',[120.215,30.28]],['滨江区',[120.195,30.164]],['萧山区',[120.293,30.197]],['西湖',[120.141,30.245]],['钱塘江',[120.251,30.254]]]

export function Diagram({ view }: {view: View}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !view.width || !view.height) return
    const density = window.devicePixelRatio || 1
    canvas.width = view.width * density
    canvas.height = view.height * density
    ctx.scale(density, density)
    ctx.fillStyle = '#e9ebe3'
    ctx.fillRect(0, 0, view.width, view.height)
    function path(points: Point[], color: string, width: number, fill?: string) {
      if (!ctx) return
      ctx.beginPath()
      points.forEach((point, index) => {
        const [x, y] = project(point, view)
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (fill) {
        ctx.closePath()
        ctx.fillStyle = fill
        ctx.fill()
      }
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = width
      ctx.strokeStyle = color
      ctx.stroke()
    }
    path([[120.025,30.295],[120.075,30.29],[120.11,30.26],[120.137,30.234],[120.119,30.196],[120.063,30.222],[120.005,30.257]], '#dbe6cc', 1, '#dce8d0')
    path([[120.275,30.33],[120.309,30.375],[120.38,30.36],[120.368,30.298],[120.326,30.307]], '#dce8d0', 1, '#dce8d0')
    for (let row = 0; row < 34; row++) {
      const y = 30.105 + row * .009
      path(Array.from({length: 13}, (_, i) => [120.012 + i * .034, y + Math.sin(i * .74 + row * .47) * .011]), '#f9faf5', row % 4 === 0 ? 3 : 1.2)
    }
    for (let column = 0; column < 38; column++) {
      const x = 120.012 + column * .011
      path(Array.from({length: 12}, (_, i) => [x + Math.sin(i * .62 + column * .33) * .012, 30.105 + i * .027]), '#f9faf5', column % 5 === 0 ? 3 : 1.2)
    }
    path(river, '#b9dbe4', .014 * scale(view))
    path(lake, '#b9dbe4', 1, '#bfdde4')
    const mainRoads: Point[][] = [
      [[120.04,30.32],[120.105,30.315],[120.15,30.3],[120.21,30.31],[120.294,30.325],[120.365,30.34]],
      [[120.155,30.4],[120.156,30.335],[120.17,30.292],[120.177,30.25],[120.192,30.218],[120.203,30.184],[120.209,30.125]],
      [[120.073,30.207],[120.147,30.207],[120.21,30.226],[120.27,30.22],[120.343,30.207]],
      [[120.124,30.405],[120.115,30.35],[120.116,30.306],[120.105,30.282],[120.094,30.25]],
      [[120.235,30.39],[120.227,30.348],[120.232,30.296],[120.264,30.266],[120.287,30.238],[120.307,30.164]],
      [[120.05,30.27],[120.096,30.273],[120.143,30.274],[120.195,30.277],[120.24,30.292],[120.321,30.312]],
    ]
    mainRoads.forEach(road => {
      path(road, '#d9d3be', 5)
      path(road, '#fff6d8', 3)
    })
    for (const [label, point] of labels) {
      const [x, y] = project(point, view)
      ctx.textAlign = 'center'
      ctx.font = '600 13px system-ui'
      ctx.fillStyle = ['西湖','钱塘江'].includes(label) ? '#527d87' : '#656f66'
      ctx.fillText(label, x, y)
    }
  }, [view])
  return <canvas ref={ref} className="diagram" aria-hidden="true"/>
}
