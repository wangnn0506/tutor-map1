import type { Point } from './jobs'

interface Pixel { getX(): number; getY(): number }
interface LngLat { getLng(): number; getLat(): number }

export interface RealMap {
  on(event: string, handler: () => void): void
  lngLatToContainer(point: Point): Pixel
  getCenter(): LngLat
  getZoom(): number
  setZoom(zoom: number): void
  setZoomAndCenter(zoom: number, center: Point): void
  destroy(): void
}

interface MapSdk {
  Map: new (element: HTMLElement, options: { center: Point; zoom: number; viewMode: '2D'; zooms: [number, number] }) => RealMap
  convertFrom(point: Point, type: 'gps', callback: (status: string, result?: {locations?: LngLat[]}) => void): void
}

declare global {
  interface Window {
    AMap?: MapSdk
    _AMapSecurityConfig?: { serviceHost: string }
  }
}

export interface MapSettings { key: string; serviceHost: string }
let sdkRequest: Promise<MapSdk> | undefined

export function loadAmap(settings: MapSettings) {
  if (window.AMap) return Promise.resolve(window.AMap)
  if (sdkRequest) return sdkRequest
  if (settings.serviceHost) window._AMapSecurityConfig = { serviceHost: settings.serviceHost }
  sdkRequest = new Promise<MapSdk>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      clearTimeout(timer)
      script.remove()
      sdkRequest = undefined
      reject(new Error('高德地图加载失败'))
    }
    const timer = window.setTimeout(fail, 12000)
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(settings.key)
    script.async = true
    script.onerror = fail
    script.onload = () => {
      if (!window.AMap) return fail()
      clearTimeout(timer)
      resolve(window.AMap)
    }
    document.head.append(script)
  })
  return sdkRequest
}

export function locateOnAmap(sdk: MapSdk): Promise<Point> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(({coords}) => {
      const timer = window.setTimeout(() => reject(new Error('定位坐标转换超时，请重试。')), 8000)
      sdk.convertFrom([coords.longitude, coords.latitude], 'gps', (status, result) => {
        clearTimeout(timer)
        const position = result?.locations?.[0]
        if (status === 'complete' && position) {
          resolve([position.getLng(), position.getLat()])
        } else {
          reject(new Error('无法将当前位置转换为高德坐标，请重试。'))
        }
      })
    }, error => {
      const message = error.code === 1 ? '请允许浏览器访问当前位置后重试。'
        : error.code === 3 ? '定位超时，请重试。' : '暂时无法获取当前位置，请重试。'
      reject(new Error(message))
    }, {enableHighAccuracy: true, timeout: 12000, maximumAge: 30000})
  })
}
