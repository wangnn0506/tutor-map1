import type { Point } from './jobs'

interface Pixel { getX(): number; getY(): number }
interface LngLat { getLng(): number; getLat(): number }
interface LocationResult { position?: LngLat }

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
  plugin(name: string, onReady: () => void): void
  Geolocation: new (options: { timeout: number; needAddress: boolean; convert: boolean }) => {
    getCurrentPosition(callback: (status: string, result: LocationResult) => void): void
  }
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
    const timer = window.setTimeout(() => reject(new Error('定位超时')), 12000)
    sdk.plugin('AMap.Geolocation', () => {
      new sdk.Geolocation({ timeout: 9000, needAddress: false, convert: true })
        .getCurrentPosition((status, result) => {
          clearTimeout(timer)
          if (status === 'complete' && result.position) {
            resolve([result.position.getLng(), result.position.getLat()])
          } else {
            reject(new Error('未能定位'))
          }
        })
    })
  })
}
