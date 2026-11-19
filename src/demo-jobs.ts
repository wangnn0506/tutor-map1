import type { Job } from './jobs'

// Approximate GCJ-02 demo points at public landmarks.
export const demoJobs: Job[] = [
  {
    id: 'HZ2611182401', district: '滨江区', landmark: '浙江中医药大学附近',
    point: [120.158, 30.183], grade: '六年级', stage: '小学', subjects: ['英语'], subjectGroups: ['文科'], title: '六年级英语',
    pay: [70, 90], schedule: '每周 2 次，周中、周末各 1 次，每次 1–2 小时',
    requirements: '补习英语基础。希望浙中医教员，经验丰富，可长期辅导。', gender: '不限',
  },
  {
    id: 'HZ2611182402', district: '萧山区', landmark: '宁围街道附近',
    point: [120.277, 30.226], grade: '六年级', stage: '小学', subjects: ['全科'], subjectGroups: ['文科', '理科'], title: '六年级全科',
    pay: [100, 150], schedule: '每周 1 次，周日下午 1 点后，每次 2 小时',
    requirements: '希望浙大教员，认真负责，可长期辅导，能接着辅导初中课程。', gender: '不限',
    preference: '优先女老师', flexiblePay: true,
  },
  {
    id: 'HZ2611182403', district: '拱墅区', landmark: '祥符街道附近',
    point: [120.115, 30.332], grade: '三年级', stage: '小学', subjects: ['全科', '作业辅导'], subjectGroups: ['文科', '理科', '其他'], title: '三年级作业辅导',
    pay: [70, 90], schedule: '每周 5 次，晚上 7–9 点，每次 2 小时',
    requirements: '要求男老师，可长期辅导，英语口语较好。', gender: '男老师',
  },
  {
    id: 'HZ2611182404', district: '西湖区', landmark: '武林门地铁站附近',
    point: [120.155, 30.278], grade: '二年级', stage: '小学', subjects: ['语文', '作业辅导'], subjectGroups: ['文科', '其他'], title: '二年级语文陪读',
    pay: [60, 80], schedule: '周一、周二、周五晚上 6 点后，每次 1.5–2 小时',
    requirements: '以语文和作业陪读为主。希望有经验、负责耐心，可长期辅导。', gender: '不限',
  },
]
