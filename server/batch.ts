import { parseAnnouncement, validateDraft } from '../src/job-intake.ts'
import { hangzhouDistricts } from '../src/jobs.ts'
import type { Job, Point } from '../src/jobs.ts'

// Approximate district-level display points, never an address geocode.
const districtPoints: Record<Job['district'], Point> = {
  上城区: [120.197, 30.226], 拱墅区: [120.142, 30.319], 西湖区: [120.13, 30.26],
  滨江区: [120.212, 30.208], 萧山区: [120.265, 30.183], 余杭区: [120.013, 30.279],
  临平区: [120.302, 30.419], 钱塘区: [120.493, 30.323], 富阳区: [119.96, 30.05], 临安区: [119.725, 30.234],
}

export function prepareBatchJob(announcement: string): Job {
  const draft = parseAnnouncement(announcement)
  const district = hangzhouDistricts.find(value => value === draft.district)
  if (!district) throw new Error('未识别杭州城区。')
  if (!draft.grade) throw new Error('未识别年级。请检查「年级」或「年级科目」一行。')
  const point = districtPoints[district]
  return {
    ...validateDraft({
      ...draft, landmark: '区内，具体地点待确认', longitude: String(point[0]), latitude: String(point[1]),
    }),
    locationPrecision: 'district',
  }
}
