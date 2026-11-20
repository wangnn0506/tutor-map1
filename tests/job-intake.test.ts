import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareBatchJob } from '../server/batch.ts'
import { parseAnnouncement, validateDraft } from '../src/job-intake.ts'

function announcement(subjects: string) {
  return [
    '编号：A-1', '地址：西湖区', '年级：初一', '科目：' + subjects,
    '课酬：150元/小时', '时间：周六',
  ].join('\n')
}

function prepareSingleJob(text: string) {
  return validateDraft({
    ...parseAnnouncement(text), longitude: '120.13', latitude: '30.26', landmark: '地铁站',
  })
}

for (const prepare of [prepareSingleJob, prepareBatchJob]) {
  test(prepare.name + ' 在拆分后检查科目', () => {
    for (const empty of ['', '   ', '、 /，+']) {
      assert.throws(() => prepare(announcement(empty)), /科目/)
    }
    assert.deepEqual(prepare(announcement('数学、 英语')).subjects, ['数学', '英语'])
    assert.throws(() => prepare(announcement('数'.repeat(121))), /科目/)
  })
}
