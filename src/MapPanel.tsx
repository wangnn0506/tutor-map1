import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Crosshair, Layers, Minus, Plus, RotateCcw } from 'lucide-react'
import { Diagram, project, scale, type View } from './Diagram'
import { loadAmap, locateOnAmap, type MapSettings, type RealMap } from './amap'
import { hangzhou, type Job, type Point } from './jobs'

interface Props {
  jobs: Job[]
  selected: string[]
  onSelect(ids: string[]): void
  onVisible(ids: string[]): void
  focus: Job | null
  settings: MapSettings
  onSettings(): void
}

interface Marker {
  x: number
  y: number
  jobs: Job[]
}

function cluster(points: Marker[]) {
  const groups: Marker[] = []
  for (const point of points) {
    const group = groups.find(candidate => Math.hypot(point.x - candidate.x, point.y - candidate.y) < 56)
    if (!group) {
      groups.push({...point})
      continue
    }
    const count = group.jobs.length
    group.x = (group.x * count + point.x) / (count + 1)
    group.y = (group.y * count + point.y) / (count + 1)
    group.jobs = [...group.jobs, ...point.jobs]
  }
  return groups
}

function constrain(zoom: number) {
  return Math.min(18, Math.max(9, zoom))
}

export function MapPanel({ jobs, selected, onSelect, onVisible, focus, settings, onSettings }: Props) {
  const host = useRef<HTMLElement>(null)
  const amapHost = useRef<HTMLDivElement>(null)
  const drag = useRef<{x: number; y: number; center: Point} | null>(null)
  const [view, setView] = useState<View>({center: hangzhou, zoom: 11, width: 0, height: 0})
  const [real, setReal] = useState<RealMap | null>(null)
  const [mode, setMode] = useState(settings.key ? 'loading' : 'diagram')
  const [location, setLocation] = useState<Point | null>(null)
  const [notice, setNotice] = useState('')
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver(([entry]) => {
      setView(value => ({...value, width: entry.contentRect.width, height: entry.contentRect.height}))
    })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!settings.key || !amapHost.current) return
    let cancelled = false
    let instance: RealMap | undefined
    let timer: number | undefined
    const element = amapHost.current
    loadAmap(settings).then(sdk => {
      if (cancelled) return
      const map = new sdk.Map(element, {center: hangzhou, zoom: 11, viewMode: '2D', zooms: [9, 18]})
      instance = map
      const sync = () => {
        const center = map.getCenter()
        setView(value => ({...value, center: [center.getLng(), center.getLat()], zoom: map.getZoom()}))
      }
      map.on('mapmove', sync)
      map.on('zoomchange', sync)
      timer = window.setTimeout(() => {
        map.destroy()
        instance = undefined
        setMode('error')
      }, 12000)
      map.on('complete', () => {
        clearTimeout(timer)
        setReal(map)
        setMode('real')
        sync()
      })
    }).catch(() => { if (!cancelled) setMode('error') })
    return () => {
      cancelled = true
      clearTimeout(timer)
      instance?.destroy()
    }
  }, [settings])

  function moveTo(center: Point, zoom: number) {
    if (real) real.setZoomAndCenter(zoom, center)
    else setView(value => ({...value, center, zoom}))
  }

  useEffect(() => {
    if (!focus) return
    if (real) real.setZoomAndCenter(13, focus.point)
    else setView(value => ({...value, zoom: 13, center: focus.point}))
  }, [focus, real])

  function zoomBy(amount: number) {
    if (real) real.setZoom(constrain(real.getZoom() + amount))
    else setView(value => ({...value, zoom: constrain(value.zoom + amount)}))
  }

  useEffect(() => {
    if (real || !host.current) return
    const element = host.current
    function wheel(event: WheelEvent) {
      if ((event.target as HTMLElement).closest('button')) return
      event.preventDefault()
      setView(value => ({...value, zoom: constrain(value.zoom - Math.sign(event.deltaY) * .35)}))
    }
    element.addEventListener('wheel', wheel, {passive: false})
    return () => element.removeEventListener('wheel', wheel)
  }, [real])

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {x: event.clientX, y: event.clientY, center: view.center}
  }

  function pan(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current
    const ratio = scale(view)
    if (!origin || !ratio) return
    setView(value => ({...value, center: [
      Math.max(119.85, Math.min(120.52, origin.center[0] - (event.clientX - origin.x) / ratio)),
      Math.max(29.95, Math.min(30.54, origin.center[1] + (event.clientY - origin.y) / ratio))
    ]}))
  }

  function toPixel(point: Point): Point {
    if (!real) return project(point, view)
    const pixel = real.lngLatToContainer(point)
    return [pixel.getX(), pixel.getY()]
  }

  const visible = view.width ? jobs.flatMap(job => {
    const [x, y] = toPixel(job.point)
    return x > 20 && y > 30 && x < view.width - 20 && y < view.height - 30 ? [{x, y, jobs: [job]}] : []
  }) : []
  const visibleIds = visible.map(point => point.jobs[0].id).join(',')
  useEffect(() => {
    if (view.width) onVisible(visibleIds ? visibleIds.split(',') : [])
  }, [onVisible, view.width, visibleIds])
  const markers = cluster(visible)

  async function locate() {
    if (!real || !window.AMap) {
      setNotice('配置高德地图后可使用当前位置。')
      return
    }
    setLocating(true)
    setNotice('')
    try {
      const point = await locateOnAmap(window.AMap)
      if (point[0] < 119.75 || point[0] > 120.7 || point[1] < 29.95 || point[1] > 30.55) {
        setNotice('当前位置超出杭州演示地图范围。')
        return
      }
      setLocation(point)
      moveTo(point, 13)
      onSelect([])
    } catch {
      setNotice('未获取位置，请检查浏览器定位权限。')
    } finally {
      setLocating(false)
    }
  }

  const userPixel = location && toPixel(location)
  return <section ref={host} className="map-panel" aria-label="杭州家教地图">
    <div ref={amapHost} className="amap-layer" />
    {mode !== 'real' && <div className="diagram-layer" onPointerDown={startDrag} onPointerMove={pan}
      onPointerUp={() => {drag.current = null}} onPointerCancel={() => {drag.current = null}}>
      <Diagram view={view}/>
    </div>}
    <div className="map-badge"><Layers size={16}/>{mode === 'real' ? '高德地图' : mode === 'loading' ? '高德加载中 · 暂用示意图' : mode === 'error' ? '高德未加载 · 杭州示意图' : '杭州示意图'}</div>
    {markers.map(marker => {
      const ids = marker.jobs.map(job => job.id)
      const active = ids.some(id => selected.includes(id))
      return <button className={'marker' + (active ? ' active' : '')} key={ids.join(',')} style={{left: marker.x, top: marker.y}}
        aria-label={marker.jobs.map(job => job.district).join('、') + ' ' + ids.length + ' 个岗位'} aria-pressed={active}
        onClick={() => onSelect(active ? [] : ids)}>{ids.length}</button>
    })}
    {userPixel && <span className="user-marker" style={{left:userPixel[0],top:userPixel[1]}} title="当前位置"/>}
    <div className="map-controls">
      <button aria-label="回到杭州全景" title="回到杭州全景" onClick={() => {moveTo(hangzhou, 11); onSelect([]); setNotice('')}}><RotateCcw size={17}/></button>
      <div className="zoom-controls">
        <button aria-label="放大地图" title="放大地图" onClick={() => zoomBy(1)}><Plus size={20}/></button>
        <button aria-label="缩小地图" title="缩小地图" onClick={() => zoomBy(-1)}><Minus size={20}/></button>
      </div>
      <button aria-label="定位到当前位置" title="定位到当前位置" disabled={locating} onClick={locate}><Crosshair size={19}/></button>
    </div>
    {notice && <div className="map-notice" role="status">{notice}</div>}
    <div className="map-foot"><span><i/> 岗位数量</span><button onClick={onSettings}>地图设置</button></div>
  </section>
}
