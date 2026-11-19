export type Point = [longitude: number, latitude: number]

export const hangzhouDistricts = [
  '上城区', '拱墅区', '西湖区', '滨江区', '萧山区',
  '余杭区', '临平区', '钱塘区', '富阳区', '临安区',
] as const
export const educationStages = ['小学', '初中', '高中', '其他'] as const
export const subjectGroups = ['文科', '理科', '其他'] as const

export interface Job {
  id: string
  district: typeof hangzhouDistricts[number]
  landmark: string
  point: Point
  grade: string
  stage: typeof educationStages[number]
  subjects: string[]
  subjectGroups: typeof subjectGroups[number][]
  title: string
  pay: [number, number]
  schedule: string
  requirements: string
  gender: '男老师' | '女老师' | '不限'
  occupation?: '普通兼职' | '专职教师'
  contact?: string
  preference?: string
  flexiblePay?: boolean
}

export const hangzhou: Point = [120.188, 30.25]

export interface Filters {
  district: string
  occupation: string
  grade: string
  subject: string
  gender: string
  hourlyPay: HourlyPayRange
}

export interface HourlyPayRange {
  min?: number
  max?: number
}

export const emptyFilters: Filters = { district: '', occupation: '', grade: '', subject: '', gender: '', hourlyPay: {} }

export function parseHourlyPay(minText: string, maxText: string): HourlyPayRange | null {
  const parseBound = (text: string) => {
    const value = text.normalize('NFKC').trim()
    if (!value) return undefined
    return /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value) ? Number(value) : NaN
  }
  const min = parseBound(minText)
  const max = parseBound(maxText)
  if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) return null
  if (min !== undefined && max !== undefined && min > max) return null
  return {min, max}
}

export function distanceKm(start: Point, end: Point) {
  const radians = Math.PI / 180
  const latitudeDelta = (end[1] - start[1]) * radians
  const longitudeDelta = (end[0] - start[0]) * radians
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(start[1] * radians) * Math.cos(end[1] * radians) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

export function matchJobs(jobs: readonly Job[], query: string, filters: Filters) {
  const terms = query.toLowerCase().trim().split(/\s+/)
  const {min, max} = filters.hourlyPay
  return jobs.filter(job => {
    const searchable = [job.id, job.title, job.district, job.landmark, ...job.subjects, job.requirements].join(' ').toLowerCase()
    return terms.every(term => searchable.includes(term))
      && (!filters.district || job.district === filters.district)
      && (!filters.occupation || job.occupation === filters.occupation)
      && (!filters.grade || job.stage === filters.grade)
      && (!filters.subject || job.subjectGroups.some(group => group === filters.subject))
      && (!filters.gender || job.gender === '不限' || job.gender === filters.gender)
      && (min === undefined || job.pay[1] >= min)
      && (max === undefined || job.pay[0] <= max)
  })
}
