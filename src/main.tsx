import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, ChevronDown, Coins, Clock3, Copy, GraduationCap, Headset, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { distanceKm, educationStages, emptyFilters, hangzhouDistricts, matchJobs, parseHourlyPay, subjectGroups, type Filters, type Job, type Point } from './jobs'
import { demoJobs } from './demo-jobs'
import { MapPanel } from './MapPanel'
import type { MapSettings } from './amap'
import './style.css'

const settings: MapSettings = {
  key: import.meta.env.VITE_AMAP_KEY || '',
  serviceHost: import.meta.env.VITE_AMAP_SERVICE_HOST || '',
}

const fields: {key: Exclude<keyof Filters, 'hourlyPay'>; name: string; all: string; options: [string, string][]}[] = [
  {key: 'gender', name: '性别要求', all: '全部性别', options: [['男生', '男老师'], ['女生', '女老师']]},
  {key: 'occupation', name: '职业要求', all: '全部职业', options: ['普通兼职', '专职教师'].map(value => [value, value])},
  {key: 'grade', name: '需求年级', all: '全部年级', options: educationStages.map(value => [value, value])},
  {key: 'subject', name: '需求科目', all: '全部科目', options: subjectGroups.map(value => [value, value])},
  {key: 'district', name: '城区', all: '全部城区', options: hangzhouDistricts.map(value => [value, value])},
]

function Modal({title, children, onClose, headerAction, className}: {title: string; children: ReactNode; onClose(): void; headerAction?: ReactNode; className?: string}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className={className} onCancel={event => { event.preventDefault(); onClose() }} aria-labelledby="dialog-title">
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><div className="dialog-head-actions">{headerAction}<button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21}/></button></div></div>
    {children}
  </dialog>
}

function useCopyJob(job: Job) {
  const [copyState, setCopyState] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText([
        job.id, job.title, job.district + ' · ' + job.landmark,
        job.pay.join('–') + ' 元/小时' + (job.flexiblePay ? '，也可自行报价' : ''),
        job.schedule, job.requirements, job.preference, job.contact,
      ].filter(Boolean).join('\n'))
      setCopyState('已复制岗位信息')
    } catch {
      setCopyState('复制失败，可选中文字手动复制。')
    }
  }
  return {copy, copyState}
}

function JobCard({job, location, onShow}: {job: Job; location: Point | null; onShow(): void}) {
  const {copy, copyState} = useCopyJob(job)
  const km = location ? distanceKm(location, job.point) : null
  const distance = km === null ? null : km < 1 ? `${Math.round(km * 1000)} 米` : `${km.toFixed(1)} 公里`
  return <article className="job">
    <div className="job-top">
      <div className="job-identity">
        <h3>{job.title}</h3>
        {distance && <p>距您约 {distance}（直线）</p>}
      </div>
      <button className="job-copy" onClick={copy}><Copy size={16}/>复制信息</button>
    </div>
    <dl className="job-facts">
      <dt><Coins/>薪酬</dt><dd className="job-pay">{job.pay.join('–')} 元/小时{job.flexiblePay && <span> · 可议价</span>}</dd>
      <dt><Clock3/>时间</dt><dd>{job.schedule}</dd>
      <dt><GraduationCap/>要求</dt><dd>{job.requirements}{job.preference && <span className="preference">{job.preference}</span>}</dd>
      {job.contact && <><dt><Headset/>客服微信</dt><dd>{job.contact}</dd></>}
      <dt><MapPin/>地点</dt><dd>{job.district} · {job.landmark}</dd>
    </dl>
    <div className="job-tail"><span>{job.id}</span><button className="text-button" onClick={onShow}>岗位详情</button></div>
    <div className="copy-status" role="status">{copyState}</div>
  </article>
}

function JobDetail({job, close, locate}: {job: Job; close(): void; locate(): void}) {
  const {copy, copyState} = useCopyJob(job)
  return <Modal title={job.title} onClose={close}>
    <dl className="details">
      <dt>岗位编号</dt><dd>{job.id}</dd>
      <dt>大致地点</dt><dd>{job.district} · {job.landmark}</dd>
      <dt>课酬</dt><dd>{job.pay.join('–')} 元/小时{job.flexiblePay ? '，也可自行报价' : ''}</dd>
      <dt>授课时间</dt><dd>{job.schedule}</dd>
      <dt>教师要求</dt><dd>{job.requirements}{job.preference ? ' ' + job.preference + '。' : ''}</dd>
      {job.contact && <><dt>客服微信</dt><dd>{job.contact}</dd></>}
    </dl>
    <div className="dialog-actions"><button className="secondary" onClick={locate}><MapPin size={17}/>地图定位</button><button className="primary" onClick={copy}><Copy size={17}/>复制岗位</button></div>
    <div className="copy-status" role="status">{copyState}</div>
  </Modal>
}

function App({jobs}: {jobs: readonly Job[]}) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState<Point | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [selected, setSelected] = useState<string[]>([])
  const [visible, setVisible] = useState<string[]>(jobs.map(job => job.id))
  const [focus, setFocus] = useState<Job | null>(null)
  const [detail, setDetail] = useState<Job | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [payInput, setPayInput] = useState({min: '', max: ''})
  const [mobileList, setMobileList] = useState(false)
  const touchStart = useRef<number | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const matches = matchJobs(jobs, query, filters)
  const {min, max} = filters.hourlyPay
  const payLabel = min !== undefined && max !== undefined ? `${min}–${max} 元/小时`
    : min !== undefined ? `≥ ${min} 元/小时`
    : max !== undefined ? `≤ ${max} 元/小时` : ''
  const payError = parseHourlyPay(payInput.min, payInput.max) === null
  const filterCount = fields.filter(field => filters[field.key]).length + Number(Boolean(payLabel))
  const matchingIds = selected.length > 0 ? selected : visible
  const shown = matches.filter(job => matchingIds.includes(job.id))
  const locatedOutside = matches.length > 0 && shown.length === 0

  function choose(ids: string[]) {
    setSelected(ids)
    if (ids.length) setMobileList(true)
    list.current?.scrollTo({top: 0})
  }

  function updateFilter(key: Exclude<keyof Filters, 'hourlyPay'>, value: string) {
    setFilters(previous => ({...previous, [key]: value}))
    choose([])
  }

  function updatePayInput(input: typeof payInput) {
    setPayInput(input)
    const hourlyPay = parseHourlyPay(input.min, input.max)
    if (!hourlyPay) return
    setFilters(previous => ({...previous, hourlyPay}))
    choose([])
  }

  function resetFilters() {
    setPayInput({min: '', max: ''})
    setFilters(emptyFilters)
    choose([])
  }

  function closeFilters() {
    setPayInput({min: min?.toString() ?? '', max: max?.toString() ?? ''})
    setFilterOpen(false)
    setMobileList(true)
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><GraduationCap size={25}/></span><div>家教地图<span className="brand-subtitle">杭州</span></div></div>
      <span className="demo-badge"><i/>演示岗位</span>
    </header>
    <main className={mobileList ? 'workspace list-open' : 'workspace'}>
      <MapPanel jobs={matches} selected={selected} onSelect={choose} onVisible={setVisible} location={location} onLocate={setLocation} focus={focus}
        settings={settings}/>
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
          )}{payLabel && <button onClick={() => updatePayInput({min: '', max: ''})}>{payLabel}<X size={13}/></button>}</div>}
          {selected.length > 0 && <div className="selection">已选地图点位<button className="text-button" onClick={() => choose([])}>查看全部点位</button></div>}
        </div>
        <div className="results" ref={list}>
          {shown.map(job => <JobCard key={job.id} job={job} location={location} onShow={() => setDetail(job)}/>)}
          {!shown.length && <div className="empty"><BookOpen size={28}/><strong>{locatedOutside ? '当前地图范围暂无岗位' : '没有找到符合条件的岗位'}</strong><p>{locatedOutside ? '试试缩小地图，或回到杭州全景。' : '试试其他搜索词，或调整筛选。'}</p></div>}
        </div>
      </section>
    </main>
    {filterOpen && <Modal title="筛选条件" onClose={closeFilters} className="filter-dialog"
      headerAction={<button className="reset-filters" onClick={resetFilters}>重置筛选</button>}>
      <div className="filter-fields">{fields.map(field => <fieldset key={field.key}>
        <legend>{field.name}</legend><div className="choices">
          {[[field.all, ''], ...field.options].map(([label, value]) => <button key={value} aria-pressed={filters[field.key] === value}
            onClick={() => updateFilter(field.key, value)}>{label}</button>)}
        </div>
      </fieldset>)}
        <fieldset>
          <legend>时薪范围（元/小时）</legend>
          <div className="pay-range">
            <input aria-label="最低时薪" placeholder="最低时薪" inputMode="decimal" value={payInput.min}
              aria-invalid={payError} aria-describedby="pay-hint" onChange={event => updatePayInput({...payInput, min: event.target.value})}/>
            <span aria-hidden="true">—</span>
            <input aria-label="最高时薪" placeholder="最高时薪" inputMode="decimal" value={payInput.max}
              aria-invalid={payError} aria-describedby="pay-hint" onChange={event => updatePayInput({...payInput, max: event.target.value})}/>
          </div>
          <p id="pay-hint" className={payError ? 'pay-hint invalid' : 'pay-hint'} aria-live="polite">{payError
            ? '请输入非负金额（最多两位小数），最低时薪不能高于最高时薪。'
            : '可只填一端。岗位的报价与所填区间有重叠即可匹配。'}</p>
        </fieldset>
      </div>
    </Modal>}
    {detail && <JobDetail job={detail} close={() => setDetail(null)} locate={() => {
      setFocus({...detail})
      choose([detail.id])
      setMobileList(false)
      setDetail(null)
    }}/>}
  </div>
}

createRoot(document.getElementById('root')!).render(<App jobs={demoJobs}/>)
