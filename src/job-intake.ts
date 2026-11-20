import { educationStages, hangzhouDistricts, occupations, parseHourlyPay, subjectGroups, type Job } from './jobs.ts'

const jobIdPattern = /^[\p{L}\p{N}][\p{L}\p{N}._/–—-]{0,79}$/u
const numberedLine = /^\s*(?:(?:订单|岗位|任务)\s*(?:编号|单号|ID|号)|编号|单号|ID)\s*:/i

export function jobIdKey(id: string) {
  return id.normalize('NFKC').toUpperCase()
}

export function splitAnnouncements(text: string) {
  const lines = text.split(/\r?\n/)
  const starts = lines.flatMap((line, index) => numberedLine.test(line.normalize('NFKC')) ? [index] : [])
  return starts.map((start, index) => lines.slice(start, starts[index + 1]).join('\n').trim())
}

export function announcementId(text: string): string {
  const normalized = text.normalize('NFKC').trim()
  const numbered = normalized.split(/\r?\n/).filter(line => numberedLine.test(line))
  if (numbered.length > 1) return ''
  const value = numbered.length
    ? numbered[0].replace(numberedLine, '').split('#')[0].trim()
      .match(/[\p{L}\p{N}][\p{L}\p{N}._/–—-]*$/u)?.[0] || ''
    : normalized
  return jobIdPattern.test(value) ? value : ''
}

const announcementFields = {
  address: ['详细地址', '地址', '地点', '家教地址', '上课地点', '授课地点'],
  gradeSubject: ['年级学科', '年级科目', '年级与科目', '年级和科目', '年级与学科', '年级/科目', '年级/学科', '学段科目'],
  grade: ['年级', '学生年级', '学员年级', '学段'],
  subject: ['科目', '学科', '辅导科目', '授课科目', '需求科目'],
  student: ['学员情况', '学生情况', '孩子情况', '辅导内容'],
  requirements: ['教员要求', '老师要求', '教师要求', '对老师要求', '对教师要求', '要求'],
  pay: ['薪资待遇', '课酬', '薪酬', '薪资', '报酬', '时薪'],
  frequency: ['每周次数', '上课频率', '频次'],
  duration: ['每次时长', '时长', '课时'],
  schedule: ['时间安排', '上课时间', '授课时间', '时间'],
  contact: ['客服微信'],
} as const

const gradePattern = /(?:小学|初中|高中)?(?:[一二三四五六七八九1-9]年级|[初高][一二三123]|学前|幼儿园|中班|大班|小班)|小学|初中|高中/
const subjectPattern = /全科|语文|数学|英语|科学|物理|化学|生物|历史|地理|政治|美术|音乐|体育|作业辅导/g

export function parseAnnouncement(text: string) {
  const fields = new Map<string, string>()
  let current = ''
  for (const line of text.normalize('NFKC').split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue
    const match = line.match(/^\s*([^:]{1,12}):\s*(.*)$/)
    if (match) {
      current = match[1].replace(/[\s【】\[\]（）()]/g, '')
      fields.set(current, match[2].trim())
    } else if (current && line.trim()) {
      fields.set(current, [fields.get(current), line.trim()].join(' '))
    }
  }
  const value = (field: keyof typeof announcementFields) =>
    announcementFields[field].map(alias => fields.get(alias)).find(Boolean) || ''
  const address = value('address')
  const gradeSubject = value('gradeSubject')
  const student = value('student')
  const requirements = value('requirements').replace(/#/g, '').trim()
  const grade = [value('grade'), gradeSubject, student].map(text => text.match(gradePattern)?.[0]).find(Boolean) || ''
  const stage = /初|[七八九789]年级/.test(grade) ? '初中' : /高/.test(grade) ? '高中'
    : /小学|[一二三四五六1-6]年级/.test(grade) ? '小学' : '其他'
  const gradeWithSubject = gradeSubject.replace(gradePattern, '').replace(/^[\s、,/+：:·-]+/, '').trim()
  const subjectText = (student + ' ' + requirements).replace(/语数英/g, '语文、数学、英语')
  const recognized = subjectText.match(subjectPattern) || []
  const subjects = value('subject') || gradeWithSubject || [...new Set(recognized)].join('、')
  const groups = [
    ...(/语文|英语|历史|政治|地理|文科|全科/.test(subjects) ? ['文科'] : []),
    ...(/数学|科学|物理|化学|生物|理科|全科/.test(subjects) ? ['理科'] : []),
    ...(/作业|陪读|音|美术|体育/.test(subjects) ? ['其他'] : []),
  ]
  const payText = value('pay')
  const hourly = payText.match(/^(\d+(?:\.\d+)?)(?:\s*[-–—~～至]\s*(\d+(?:\.\d+)?))?\s*(?:元\s*)?[/每]\s*(?:(\d+(?:\.\d+)?)\s*)?(小时|h\b|分钟|min\b)/i)
  const duration = hourly ? Number(hourly[3] ?? 1) * (/分钟|min/i.test(hourly[4]) ? 1 / 60 : 1) : 0
  const hourlyValue = (amount: string | undefined) => amount && duration > 0 ? String(Math.round(Number(amount) / duration * 100) / 100) : ''
  const preferred = /(?:优先|最好|偏好)\s*(男|女)(?:老师|生|教员)?/.exec(requirements)
  const gender = preferred || /男女不限|性别不限/.test(requirements) ? '不限'
    : /男老师|男生|男教员/.test(requirements) ? '男老师'
    : /女老师|女生|女教员/.test(requirements) ? '女老师' : '不限'
  const district = hangzhouDistricts.find(area => address.includes(area)) || ''
  return {
    id: announcementId(text), district, landmark: '', longitude: '', latitude: '',
    grade, stage, subjects, groups: groups.length ? groups : ['其他'], title: [grade, subjects].filter(Boolean).join(' · '),
    min: hourlyValue(hourly?.[1]), max: hourlyValue(hourly?.[2] || hourly?.[1]),
    schedule: [value('frequency'), value('schedule'), value('duration')].filter(Boolean).join('；'),
    requirements, gender, preference: preferred ? '优先' + preferred[1] + '老师' : '',
    occupation: /专职教师/.test(requirements) ? '专职教师' : /普通兼职/.test(requirements) ? '普通兼职' : '',
    flexiblePay: /议价|报价|面议/.test(payText), contact: value('contact'),
  }
}

export type JobDraft = ReturnType<typeof parseAnnouncement>

export function validateDraft(draft: unknown): Job {
  if (!draft || typeof draft !== 'object') throw new Error('岗位数据无效。')
  const data = draft as Record<string, unknown>
  const field = (name: string, label: string, max: number, required = true) => {
    const value = typeof data[name] === 'string' ? data[name].trim() : ''
    if ((required && !value) || value.length > max) throw new Error(`请检查${label}。`)
    return value
  }
  const id = field('id', '岗位编号', 80).normalize('NFKC')
  if (!jobIdPattern.test(id)) throw new Error('岗位编号最多 80 字，可使用文字、数字和常见编号分隔符。')
  const district = hangzhouDistricts.find(value => value === data.district)
  const stage = educationStages.find(value => value === data.stage)
  if (!district || !stage) throw new Error('请选择城区和学段。')
  const groups = data.groups
  if (!Array.isArray(groups) || !groups.length || groups.some(value => !subjectGroups.some(group => group === value))) {
    throw new Error('请至少选择一个有效的科目分类。')
  }
  const subjects = field('subjects', '科目', 120, false).split(/[、/,，+]+/).map(value => value.trim()).filter(Boolean)
  if (!subjects.length) throw new Error('未识别科目。请检查「科目」或「年级科目」一行。')
  const longitude = Number(field('longitude', '经度', 24))
  const latitude = Number(field('latitude', '纬度', 24))
  if (!(longitude >= 118.3 && longitude <= 120.9 && latitude >= 29.15 && latitude <= 30.65)) {
    throw new Error('请填写杭州范围内的高德坐标，经度在前、纬度在后。')
  }
  const pay = parseHourlyPay(field('min', '最低时薪', 12), field('max', '最高时薪', 12))
  if (pay?.min === undefined || pay.max === undefined || pay.min <= 0) throw new Error('请填写有效的正数时薪区间。')
  const gender = data.gender
  if (gender !== '不限' && gender !== '男老师' && gender !== '女老师') throw new Error('请选择教师性别要求。')
  const occupation = occupations.find(value => value === data.occupation)
  return {
    id, district, stage, point: [longitude, latitude], subjectGroups: [...new Set(groups)] as Job['subjectGroups'],
    landmark: field('landmark', '公开地标', 120), grade: field('grade', '年级', 40), title: field('title', '标题', 100),
    subjects,
    pay: [pay.min, pay.max], schedule: field('schedule', '授课时间', 350), requirements: field('requirements', '教师要求', 600, false),
    gender, occupation, preference: field('preference', '教师偏好', 80, false) || undefined,
    contact: field('contact', '公开客服微信', 80, false) || undefined, flexiblePay: data.flexiblePay === true,
  }
}
