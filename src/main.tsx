import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, CalendarClock, ChevronDown, Copy, GraduationCap, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { emptyFilters, jobs, matchJobs, type Filters, type Job } from './jobs'
import { MapPanel } from './MapPanel'
import type { MapSettings } from './amap'
import './style.css'

const configName = 'hangzhou-tutor-map.amap'
function readSettings(): MapSettings {
  try {
    const saved = sessionStorage.getItem(configName)
    if (saved) return JSON.parse(saved)
  } catch {
    // The build-time configuration also works without session storage.
  }
  return {key: import.meta.env.VITE_AMAP_KEY || '', serviceHost: import.meta.env.VITE_AMAP_SERVICE_HOST || ''}
}

const settings = readSettings()
const fields: {key: keyof Filters; name: string; options: [string, string][]}[] = [
  {key: 'grade', name: '年级', options: ['二年级', '三年级', '六年级'].map(value => [value, value])},
  {key: 'subject', name: '科目', options: ['语文','英语','全科','作业辅导'].map(value => [value, value])},
  {key: 'minPay', name: '最低时薪', options: ['60', '70', '80', '100'].map(value => [value + ' 元/小时', value])},
  {key: 'gender', name: '教师性别', options: [['男老师','男老师'], ['女老师','女老师']]},
  {key: 'district', name: '城区', options: ['西湖区','滨江区','拱墅区','萧山区'].map(value => [value, value])},
]

function Modal({title, children, onClose}: {title: string; children: ReactNode; onClose(): void}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); onClose() }} aria-labelledby="dialog-title">
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21}/></button></div>
    {children}
  </dialog>
}

function Settings({onClose}: {onClose(): void}) {
  const [error, setError] = useState('')
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const key = String(fields.get('key')).trim()
    const serviceHost = String(fields.get('serviceHost')).trim().replace(/\/$/, '')
    if (key && !/^https:\/\/[^\s?#]+\/_AMapService$/.test(serviceHost)) {
      setError('代理地址须以 https:// 开头，以 /_AMapService 结尾。')
      return
    }
    try {
      sessionStorage.setItem(configName, JSON.stringify({ key, serviceHost }))
      window.location.reload()
    } catch {
      setError('此浏览器无法保存配置。')
    }
  }
  return <Modal title="地图设置" onClose={onClose}>
    <form onSubmit={save} className="settings-form">
      <p>填入高德 Web 端（JS API）Key 和已配置的安全代理地址。留空并保存可返回杭州示意图。</p>
      <label>高德 Web Key<input name="key" defaultValue={settings.key} autoComplete="off"/></label>
      <label>安全代理地址<input name="serviceHost" defaultValue={settings.serviceHost} placeholder="https://你的域名/_AMapService" autoComplete="off"/></label>
      {error && <p role="alert">{error}</p>}
      <button className="primary" type="submit">保存地图配置</button>
    </form>
  </Modal>
}

function JobCard({job, onShow}: {job: Job; onShow(): void}) {
  return <article className="job">
    <div className="job-top"><h3>{job.title}</h3><div className="pay"><strong>{job.pay.join('–')}</strong><span> 元/小时</span></div></div>
    <div className="job-tags"><span>{job.district}</span><span>{job.grade}</span>{job.preference && <span className="preference">{job.preference}</span>}</div>
    <div className="job-meta"><MapPin size={16}/><span>{job.landmark}</span></div>
    <div className="job-meta"><CalendarClock size={16}/><span>{job.schedule}</span></div>
    <div className="job-tail"><span>{job.id}</span><button className="text-button" onClick={onShow}>查看要求</button></div>
  </article>
}

function JobDetail({job, close, locate}: {job: Job; close(): void; locate(): void}) {
  const [copyState, setCopyState] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText([
        job.id, job.title, job.district + ' · ' + job.landmark, job.pay.join('–') + ' 元/小时',
        job.schedule, job.requirements, job.preference,
      ].filter(Boolean).join('\n'))
      setCopyState('已复制岗位信息')
    } catch {
      setCopyState('自动复制失败，可选中文字手动复制。')
    }
  }
  return <Modal title={job.title} onClose={close}>
    <dl className="details">
      <dt>岗位编号</dt><dd>{job.id}</dd>
      <dt>大致地点</dt><dd>{job.district} · {job.landmark}</dd>
      <dt>课酬</dt><dd>{job.pay.join('–')} 元/小时{job.flexiblePay ? '，也可自行报价' : ''}</dd>
      <dt>授课时间</dt><dd>{job.schedule}</dd>
      <dt>教师要求</dt><dd>{job.requirements}{job.preference ? ' ' + job.preference + '。' : ''}</dd>
    </dl>
    <div className="dialog-actions"><button className="secondary" onClick={locate}><MapPin size={17}/>地图定位</button><button className="primary" onClick={copy}><Copy size={17}/>复制岗位</button></div>
    <div className="copy-status" role="status">{copyState}</div>
  </Modal>
}

function App() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [selected, setSelected] = useState<string[]>([])
  const [visible, setVisible] = useState<string[]>(jobs.map(job => job.id))
  const [focus, setFocus] = useState<Job | null>(null)
  const [detail, setDetail] = useState<Job | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [mapSettingsOpen, setMapSettingsOpen] = useState(false)
  const [mobileList, setMobileList] = useState(false)
  const touchStart = useRef<number | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const matches = matchJobs(query, filters)
  const filterCount = Object.values(filters).filter(Boolean).length
  const matchingIds = selected.length > 0 ? selected : visible
  const shown = matches.filter(job => matchingIds.includes(job.id))
  const locatedOutside = matches.length > 0 && shown.length === 0

  function choose(ids: string[]) {
    setSelected(ids)
    if (ids.length) setMobileList(true)
    list.current?.scrollTo({top: 0})
  }

  function updateFilter(key: keyof Filters, value: string) {
    setFilters(previous => ({...previous, [key]: value}))
    choose([])
  }

  function resetFilters() {
    setFilters(emptyFilters)
    choose([])
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><GraduationCap size={25}/></span><div>家教地图<span className="brand-subtitle">杭州</span></div></div>
      <span className="demo-badge"><i/>演示岗位</span>
    </header>
    <main className={mobileList ? 'workspace list-open' : 'workspace'}>
      <MapPanel jobs={matches} selected={selected} onSelect={choose} onVisible={setVisible} focus={focus}
        settings={settings} onSettings={() => setMapSettingsOpen(true)}/>
      <section className="sidebar" aria-label="岗位列表">
        <div className="side-head">
          <button className="sheet-toggle" aria-expanded={mobileList} onClick={() => setMobileList(value => !value)}
            onTouchStart={event => {touchStart.current = event.touches[0].clientY}}
            onTouchEnd={event => {
              if (touchStart.current === null) return
              const distance = event.changedTouches[0].clientY - touchStart.current
              if (Math.abs(distance) > 20 && event.cancelable) {
                event.preventDefault()
                setMobileList(distance < 0)
              }
              touchStart.current = null
            }}><span/><ChevronDown size={16}/><span className="sr-only">{mobileList ? '收起岗位列表' : '展开岗位列表'}</span></button>
          <div className="heading"><h1>家教岗位</h1><span>{shown.length} 个岗位</span></div>
          <div className="search-row">
            <label className="search"><Search size={18}/><input type="search" aria-label="搜索岗位" placeholder="搜索城区、地标或科目"
              value={query} onFocus={() => setMobileList(true)} onChange={event => {setQuery(event.target.value); choose([])}}/></label>
            <button className={'filter-button' + (filterCount ? ' applied' : '')} onClick={() => setFilterOpen(true)}><SlidersHorizontal size={17}/>筛选{filterCount ? ' ' + filterCount : ''}</button>
          </div>
          {filterCount > 0 && <div className="applied-list">{fields.filter(field => filters[field.key]).map(field =>
            <button key={field.key} onClick={() => updateFilter(field.key, '')}>{field.options.find(([, value]) => value === filters[field.key])?.[0]}<X size={13}/></button>
          )}</div>}
          {selected.length > 0 && <div className="selection">已选地图点位<button className="text-button" onClick={() => choose([])}>查看全部点位</button></div>}
        </div>
        <div className="results" ref={list}>
          {shown.map(job => <JobCard key={job.id} job={job} onShow={() => setDetail(job)}/>)}
          {!shown.length && <div className="empty"><BookOpen size={28}/><strong>{locatedOutside ? '当前地图范围暂无岗位' : '没有找到符合条件的岗位'}</strong><p>{locatedOutside ? '试试缩小地图，或回到杭州全景。' : '试试其他搜索词，或调整筛选。'}</p></div>}
        </div>
      </section>
    </main>
    {filterOpen && <Modal title="筛选岗位" onClose={() => setFilterOpen(false)}>
      <div className="filter-fields">{fields.map(field => <fieldset key={field.key}>
        <legend>{field.name}</legend><div className="choices">
          {[['全部', ''], ...field.options].map(([label, value]) => <button key={value} aria-pressed={filters[field.key] === value}
            onClick={() => updateFilter(field.key, value)}>{label}</button>)}
        </div>
      </fieldset>)}</div>
      <div className="dialog-actions"><button className="secondary" onClick={resetFilters}>重置</button><button className="primary" onClick={() => {setFilterOpen(false);setMobileList(true)}}>完成筛选</button></div>
    </Modal>}
    {detail && <JobDetail job={detail} close={() => setDetail(null)} locate={() => {
      setFocus({...detail})
      choose([detail.id])
      setMobileList(false)
      setDetail(null)
    }}/>}
    {mapSettingsOpen && <Settings onClose={() => setMapSettingsOpen(false)}/>}
  </div>
}

createRoot(document.getElementById('root')!).render(<App/>)
