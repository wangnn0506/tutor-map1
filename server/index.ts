import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { announcementId, jobIdKey, splitAnnouncements, validateDraft } from '../src/job-intake.ts'
import { prepareBatchJob } from './batch.ts'
import type { Job } from '../src/jobs.ts'

const password = process.env.ADMIN_PASSWORD
if (!password || password.length < 12) throw new Error('请配置至少 12 字符的 ADMIN_PASSWORD')
const hash = (value: string) => createHash('sha256').update(value).digest()
const passwordHash = hash(password)
const databasePath = process.env.JOBS_DB || '.data/jobs.sqlite'
mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 })
const db = new DatabaseSync(databasePath)
db.exec(`PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    public_json TEXT NOT NULL,
    announcement TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
const list = db.prepare('SELECT public_json FROM jobs WHERE published = 1 ORDER BY created_at DESC, rowid DESC')
const lookup = db.prepare('SELECT public_json, published FROM jobs WHERE id = ?')
const insert = db.prepare('INSERT INTO jobs (id, public_json, announcement) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING')
const unpublish = db.prepare('UPDATE jobs SET published = 0 WHERE id = ? AND published = 1')

const sessions = new Map<string, number>()
const lifetime = 8 * 60 * 60 * 1000
let attempts = 0
let attemptWindowEnds = 0

class HttpError extends Error {
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }

  readonly status: number
}

function send(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
  response.end(JSON.stringify(data))
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw new HttpError(415, '请发送 JSON 数据。')
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request.iterator({destroyOnReturn: false})) {
    size += chunk.length
    if (size > 262144) {
      request.resume()
      throw new HttpError(413, '输入文字过长。')
    }
    chunks.push(chunk)
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString())
    if (result && typeof result === 'object' && !Array.isArray(result)) return result
  } catch { /* Use the same response for malformed JSON and non-objects. */ }
  throw new HttpError(400, '提交的数据格式不正确。')
}

function secureRequest(request: IncomingMessage) {
  return request.headers['x-forwarded-proto'] === 'https'
}

function loopbackRequest(request: IncomingMessage) {
  return process.env.ALLOW_LOCAL_ADMIN === '1' && !request.headers['x-forwarded-proto']
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host || '')
    && (!request.headers.origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.origin))
}

function cookie(token: string, secure: boolean, expires: number) {
  return `tutor_admin=${token}; HttpOnly; SameSite=Strict; Path=/demo1/api/admin; Max-Age=${expires}${secure ? '; Secure' : ''}`
}

function announcement(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 8000) throw new HttpError(400, '请输入一条岗位公告或岗位编号。')
  return value.trim()
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const path = request.url?.split('?')[0]
  const method = request.method
  if (path === '/demo1/api/jobs' && method === 'GET') {
    return send(response, 200, {jobs: list.all().map(row => JSON.parse(String(row.public_json)) as Job)})
  }
  if (!path?.startsWith('/demo1/api/admin/')) throw new HttpError(404, '接口不存在。')
  const route = path.slice('/demo1/api/admin/'.length)
  const secure = secureRequest(request)
  if (!secure && !loopbackRequest(request)) throw new HttpError(403, '后台登录需要 HTTPS。')
  const now = Date.now()
  for (const [key, expires] of sessions) if (expires <= now) sessions.delete(key)
  const token = /(?:^|;\s*)tutor_admin=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1] || ''
  if (route === 'login' && method === 'POST') {
    const data = await body(request)
    if (now >= attemptWindowEnds) { attempts = 0; attemptWindowEnds = now + 60_000 }
    if (attempts >= 8) throw new HttpError(429, '尝试次数过多，请一分钟后再试。')
    if (typeof data.password !== 'string' || !timingSafeEqual(hash(data.password), passwordHash)) {
      attempts += 1
      throw new HttpError(401, '后台密码不正确。')
    }
    attempts = 0
    sessions.delete(token)
    const issued = randomBytes(32).toString('hex')
    sessions.set(issued, now + lifetime)
    response.setHeader('Set-Cookie', cookie(issued, secure, lifetime / 1000))
    return send(response, 200, {ok: true})
  }
  if (!sessions.has(token)) throw new HttpError(401, '请先登录后台。')
  if (route === 'session' && method === 'GET') return send(response, 200, {ok: true})
  if (method !== 'POST') throw new HttpError(404, '接口不存在。')
  const data = await body(request)
  if (route === 'logout') {
    sessions.delete(token)
    response.setHeader('Set-Cookie', cookie('', secure, 0))
    return send(response, 200, {ok: true})
  }
  if (route === 'publish-batch') {
    if (typeof data.announcement !== 'string' || data.announcement.length > 50000) {
      throw new HttpError(400, '请粘贴最多 50000 字的公告。')
    }
    const entries = splitAnnouncements(data.announcement)
    if (!entries.length || entries.length > 50) throw new HttpError(400, '请粘贴 1–50 条带有编号的公告。')
    const published: Pick<Job, 'id' | 'title' | 'district' | 'pay'>[] = []
    const skipped: {id: string; reason: string}[] = []
    db.exec('BEGIN')
    try {
      for (const [index, original] of entries.entries()) {
        let job: Job
        try {
          if (original.length > 8000) throw new Error('单条公告过长。')
          job = prepareBatchJob(original)
        } catch (error) {
          skipped.push({id: announcementId(original) || `第 ${index + 1} 条`, reason: error instanceof Error ? error.message : '公告格式无效。'})
          continue
        }
        if (insert.run(jobIdKey(job.id), JSON.stringify(job), original).changes) published.push({id: job.id, title: job.title, district: job.district, pay: job.pay})
        else skipped.push({id: job.id, reason: '编号已存在。'})
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    return send(response, 200, {published, skipped})
  }
  if (route === 'publish') {
    const original = announcement(data.announcement)
    let job: Job
    try { job = validateDraft(data.draft) }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : '岗位数据无效。') }
    if (!insert.run(jobIdKey(job.id), JSON.stringify(job), original).changes) throw new HttpError(409, '该岗位编号已存在，未重复发布。')
    return send(response, 201, {id: job.id})
  }
  if (route === 'lookup' || route === 'unpublish') {
    const id = announcementId(announcement(data.announcement))
    if (!id) throw new HttpError(400, '无法识别编号。请粘贴包含「编号」的公告或单独输入岗位编号。')
    const row = lookup.get(jobIdKey(id))
    if (!row) throw new HttpError(404, '未找到这个岗位编号。')
    if (route === 'lookup') return send(response, 200, {job: JSON.parse(String(row.public_json)), published: row.published === 1})
    if (!unpublish.run(jobIdKey(id)).changes) throw new HttpError(409, '该岗位已经下架。')
    return send(response, 200, {id})
  }
  throw new HttpError(404, '接口不存在。')
}

createServer((request, response) => {
  void handle(request, response).catch(error => {
    if (error instanceof HttpError) return send(response, error.status, {error: error.message})
    console.error(error instanceof Error ? error.message : 'Unknown API error')
    send(response, 500, {error: '服务暂时不可用。'})
  })
}).listen(Number(process.env.API_PORT || 4174), '127.0.0.1', () => console.log('岗位 API 已启动'))
