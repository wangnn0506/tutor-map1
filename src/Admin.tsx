import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError, appBase } from './api'
import { parseAnnouncement, type JobDraft } from './job-intake'
import { educationStages, formatHourlyPay, hangzhouDistricts, occupations, subjectGroups, type Job } from './jobs'

const canLogIn = window.isSecureContext

const textFields = [
  ['id', '岗位编号'], ['title', '岗位标题'], ['grade', '具体年级'], ['subjects', '具体科目'],
  ['landmark', '公开地标（如某地铁站附近）'], ['longitude', '高德经度'], ['latitude', '高德纬度'],
  ['min', '最低时薪（元）'], ['max', '最高时薪（元）'], ['schedule', '授课时间'],
  ['requirements', '教师要求'], ['preference', '教师偏好'], ['contact', '公开客服微信'],
] as const

type AdminAction = 'session' | 'publish' | 'withdraw'

export function Admin() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<AdminAction | null>(null)
  const busy = pending !== null
  const [source, setSource] = useState('')
  const [batchResult, setBatchResult] = useState<{published: Pick<Job, 'id' | 'title' | 'district' | 'pay'>[]; skipped: {id: string; reason: string}[]} | null>(null)
  const [draft, setDraft] = useState<JobDraft | null>(null)
  const [withdrawal, setWithdrawal] = useState('')
  const [candidate, setCandidate] = useState<{job: Job; published: boolean} | null>(null)

  useEffect(() => {
    if (!canLogIn) return
    void api('admin/session').then(() => setLoggedIn(true)).catch(error => {
      if (!(error instanceof ApiError) || error.status !== 401) setMessage(error.message)
    }).finally(() => setChecking(false))
  }, [])

  async function run(action: AdminAction, work: () => Promise<void>) {
    setMessage('')
    setPending(action)
    try { await work() }
    catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请重试。')
      if (loggedIn && error instanceof ApiError && error.status === 401) setLoggedIn(false)
    } finally { setPending(null) }
  }

  function login(event: FormEvent) {
    event.preventDefault()
    void run('session', async () => {
      await api('admin/login', {password})
      setPassword('')
      setLoggedIn(true)
    })
  }

  function edit<K extends keyof JobDraft>(key: K, value: JobDraft[K]) {
    setDraft(previous => previous && {...previous, [key]: value})
  }

  function publish(event: FormEvent) {
    event.preventDefault()
    void run('publish', async () => {
      const {id} = await api<{id: string}>('admin/publish', {announcement: source, draft})
      setDraft(null)
      setSource('')
      setMessage(`岗位 ${id} 已发布。`)
    })
  }

  function publishBatch() {
    void run('publish', async () => {
      const result = await api<NonNullable<typeof batchResult>>('admin/publish-batch', {announcement: source})
      setBatchResult(result)
      setDraft(null)
      if (result.published.length && !result.skipped.length) setSource('')
    })
  }

  function findJob(event: FormEvent) {
    event.preventDefault()
    setCandidate(null)
    void run('withdraw', async () => {
      setCandidate(await api('admin/lookup', {announcement: withdrawal}))
    })
  }

  return <main className="admin">
    <header className="admin-head"><h1>岗位管理</h1><a href={appBase}>查看用户端</a>
      {loggedIn && <button className="secondary" disabled={busy} onClick={() => void run('session', async () => {
        await api('admin/logout', {})
        setLoggedIn(false)
      })}>退出登录</button>}
    </header>
    {message && <p className="admin-message" role="status">{message}</p>}
    {!canLogIn ? <p className="admin-message">请通过 HTTPS 打开运营后台后再登录。</p> : checking ? <p>正在检查登录状态…</p> : !loggedIn ? <form className="admin-section" onSubmit={login}>
      <h2>运营登录</h2>
      <label>后台密码<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}/></label>
      <button className="primary" disabled={busy}>登录</button>
    </form> : <>
      <section className="admin-section">
        <h2>录入并发布</h2>
        <label>群公告原文<textarea disabled={pending === 'publish'} rows={7} maxLength={50000} value={source} onChange={event => {setSource(event.target.value); setDraft(null); setBatchResult(null)}}/></label>
        <p>可一次粘贴多条公告。批量发布使用城区级点位，识别失败的岗位会跳过。</p>
        <div className="intake-actions">
          <button className="primary" disabled={!source.trim() || busy} onClick={publishBatch}>识别并批量发布</button>
          <button className="secondary" disabled={!source.trim() || busy} onClick={() => setDraft(parseAnnouncement(source))}>单条预览与修正</button>
        </div>
        {batchResult && <div className="admin-preview" role="status">
          <p>已发布 {batchResult.published.length} 条，跳过 {batchResult.skipped.length} 条。</p>
          {batchResult.published.length > 0 && <ul className="batch-published">{batchResult.published.map(job =>
            <li key={job.id}><strong>{job.title}</strong><span>{job.district} · {formatHourlyPay(job.pay)}</span><span>编号 {job.id}</span></li>
          )}</ul>}
          {batchResult.skipped.length > 0 && <ul>{batchResult.skipped.map(({id,reason}, index) => <li key={index}>{id} · {reason}</li>)}</ul>}
        </div>}
        {draft && <form className="admin-preview" onSubmit={publish}>
          <h3>核对公开信息</h3>
          <p>只填写可公开的地标和信息。坐标使用高德经纬度，课酬统一换算成元/小时。</p>
          <fieldset disabled={pending === 'publish'}>
            <div className="admin-fields">
              <label>城区<select required value={draft.district} onChange={event => edit('district', event.target.value)}><option value="">请选择</option>{hangzhouDistricts.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>学段<select value={draft.stage} onChange={event => edit('stage', event.target.value)}>{educationStages.map(value => <option key={value}>{value}</option>)}</select></label>
              {textFields.map(([key, label]) => <label key={key}>{label}<input value={draft[key]} onChange={event => edit(key,event.target.value)}/></label>)}
              <label>教师性别<select value={draft.gender} onChange={event => edit('gender',event.target.value)}>{['不限','男老师','女老师'].map(value => <option key={value}>{value}</option>)}</select></label>
              <label>职业要求<select value={draft.occupation} onChange={event => edit('occupation',event.target.value)}><option value="">不限</option>{occupations.map(value => <option key={value}>{value}</option>)}</select></label>
            </div>
            <fieldset className="admin-checks"><legend>科目分类</legend>{subjectGroups.map(group => <label key={group}><input type="checkbox" checked={draft.groups.includes(group)} onChange={event => edit('groups',event.target.checked ? [...draft.groups, group] : draft.groups.filter(value => value !== group))}/>{group}</label>)}</fieldset>
            <label className="admin-checks"><input type="checkbox" checked={draft.flexiblePay} onChange={event => edit('flexiblePay',event.target.checked)}/>时薪可议价</label>
          </fieldset>
          <button className="primary" disabled={busy}>确认发布</button>
        </form>}
      </section>
      <section className="admin-section">
        <h2>下架岗位</h2>
        <form onSubmit={findJob}>
          <label>粘贴原公告、用户端复制的信息或岗位编号<textarea disabled={pending === 'withdraw'} rows={4} maxLength={8000} value={withdrawal} onChange={event => {setWithdrawal(event.target.value);setCandidate(null)}}/></label>
          <button className="secondary" disabled={busy || !withdrawal.trim()}>查找岗位</button>
        </form>
        {candidate && <div className="admin-preview">
          <h3>{candidate.job.title}</h3>
          <p>编号 {candidate.job.id} · {candidate.job.district} · {candidate.job.landmark} · {formatHourlyPay(candidate.job.pay)}</p>
          {candidate.published ? <button className="danger-button" disabled={busy} onClick={() => void run('withdraw', async () => {
            await api('admin/unpublish', {announcement: candidate.job.id})
            setCandidate(null)
            setWithdrawal('')
            setMessage(`岗位 ${candidate.job.id} 已下架。`)
          })}>确认下架</button> : <p>该岗位已下架。</p>}
        </div>}
      </section>
    </>}
  </main>
}
