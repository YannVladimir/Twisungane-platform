import { useState, useEffect } from 'react'
import { 
  History, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Calendar, 
  Activity, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShieldCheck, 
  XCircle, 
  RotateCcw,
  Clock,
  ExternalLink,
  Wallet,
  UserPlus,
  Coins,
  Receipt,
  Banknote,
  HeartPulse,
  TrendingUp,
  FileText
} from 'lucide-react'
import api from '../services/api.js'
import { useLanguage } from '../context/LanguageContext'
import { getLocale } from '../utils/i18nHelper'
import useDebounce from '../hooks/useDebounce'

export default function Activities() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filterText, setFilterText] = useState('')
  const debouncedFilter = useDebounce(filterText)
  const { t, language } = useLanguage()

  useEffect(() => {
    fetchLogs()
  }, [page])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/api/v1/audit-logs?page=${page}&size=15`)
      setLogs(res.data.content || [])
      setTotalPages(res.data.totalPages || 0)
    } catch (err) {
      console.error('Error fetching audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'CONTRIBUTION_RECORDED': return <Wallet size={18} className="text-emerald-400" />
      case 'LOAN_DISBURSED': return <ArrowUpRight size={18} className="text-blue-400" />
      case 'LOAN_REPAYMENT': return <ArrowDownLeft size={18} className="text-emerald-400" />
      case 'LOAN_APPROVED': return <ShieldCheck size={18} className="text-amber-400" />
      case 'LOAN_REJECTED': return <XCircle size={18} className="text-red-400" />
      case 'LOAN_CANCELLED': return <RotateCcw size={18} className="text-muted" />
      case 'LOAN_APPLICATION_SUBMITTED': return <FileText size={18} className="text-blue-400" />
      case 'MEMBER_REGISTERED': return <UserPlus size={18} className="text-indigo-400" />
      case 'SHARE_PURCHASE': return <Coins size={18} className="text-amber-400" />
      case 'SHARE_TRANSFER': return <TrendingUp size={18} className="text-blue-400" />
      case 'EXPENSE_RECORDED': return <Receipt size={18} className="text-rose-400" />
      case 'INTEREST_DISTRIBUTED': return <TrendingUp size={18} className="text-emerald-400" />
      case 'INTEREST_CASHED_OUT': return <Banknote size={18} className="text-emerald-400" />
      case 'SOCIAL_CLAIM_SUBMITTED': return <HeartPulse size={18} className="text-rose-400" />
      case 'SOCIAL_CLAIM_PAID': return <HeartPulse size={18} className="text-emerald-400" />
      default: return <Activity size={18} className="text-accent" />
    }
  }

  const getBorderColor = (action) => {
    if (!action) return '#eab308';
    if (action.includes('LOAN_DISBURSED') || action.includes('LOAN_APPROVED') || action.includes('LOAN_APPLICATION')) return '#3b82f6';   // blue
    if (action.includes('LOAN_REPAYMENT'))                 return '#10b981';  // emerald
    if (action.includes('LOAN_REJECTED') || action.includes('LOAN_CANCELLED')) return '#ef4444'; // red
    if (action.includes('CONTRIBUTION') || action.includes('PURCHASE') || action.includes('TRANSFER')) return '#10b981'; // emerald
    if (action.includes('INTEREST'))                       return '#8b5cf6';  // violet
    if (action.includes('EXPENSE'))                        return '#f97316';  // orange
    if (action.includes('SOCIAL'))                         return '#ec4899';  // pink
    if (action.includes('MEMBER') || action.includes('USER')) return '#6366f1'; // indigo
    return '#eab308'; // amber default
  };

  const getLogColor = (action) => {
    if (action.includes('DISBURSED') || action.includes('APPROVED') || action.includes('REGISTERED') || action.includes('SUBMITTED')) return 'blue'
    if (action.includes('RECORDED') || action.includes('REPAYMENT') || action.includes('PURCHASE') || action.includes('PAID')) return 'emerald'
    if (action.includes('REJECTED') || action.includes('EXPENSE') || action.includes('SUBMITTED')) return 'red'
    return 'amber'
  }

  const filteredLogs = logs.filter(log =>
    log.message?.toLowerCase().includes(debouncedFilter.toLowerCase()) ||
    log.actorName?.toLowerCase().includes(debouncedFilter.toLowerCase()) ||
    log.action?.toLowerCase().includes(debouncedFilter.toLowerCase())
  )

  return (
    <div className="animate-in pb-10">
      <header className="page-header">
        <div className="header-info">
          <h1>{t('activities.title')}</h1>
          <p className="text-muted">{t('activities.subtitle')}</p>
        </div>
        <div className="header-actions">
           <div className="search-box" style={{ width: '300px', marginBottom: 0 }}>
             <Search size={18} />
             <input
               type="text" placeholder={t('activities.search_placeholder')}
               value={filterText} onChange={e => setFilterText(e.target.value)}
             />
           </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto mt-10 relative">
        {/* Timeline main line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-px bg-white/5 z-0" />

        <div className="space-y-8 relative z-10">
          {loading ? (
             <div className="text-center py-20 text-muted glass-card">{t('activities.loading')}</div>
          ) : filteredLogs.length === 0 ? (
             <div className="text-center py-20 text-muted glass-card">{t('activities.no_records')}</div>
          ) : (
              filteredLogs.map((log, i) => {
                const borderColor = getBorderColor(log.action);
                return (
                <div key={log.id} className="group relative flex gap-6 items-start transition-all duration-300">
                  {/* Timeline Node */}
                  <div className="relative shrink-0 mt-1">
                     <div
                       className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5 group-hover:border-white/20 transition-all shadow-xl backdrop-blur-md"
                       style={{ borderColor: `${borderColor}33`, boxShadow: `0 0 0 1px ${borderColor}22` }}
                     >
                        {getActionIcon(log.action)}
                     </div>
                     {/* Date badge next to node */}
                     <div className="absolute top-1/2 -left-[140px] -translate-y-1/2 w-[120px] text-right hidden lg:block">
                       <p className="text-[11px] font-bold text-muted uppercase tracking-widest">{new Date(log.timestamp).toLocaleDateString(getLocale(language), { day: '2-digit', month: 'short' })}</p>
                       <p className="text-[10px] text-muted opacity-50 font-mono">{new Date(log.timestamp).toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' })}</p>
                     </div>
                  </div>

                  {/* Log Content Card */}
                  <div
                    className="flex-grow glass-card p-5 group-hover:scale-[1.01] transition-all duration-300 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]"
                    style={{
                      borderLeft: `4px solid ${borderColor}`,
                      borderTop: '1px solid var(--border-color)',
                      borderRight: '1px solid var(--border-color)',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                     <div className="flex justify-between items-start mb-2">
                       <div className="flex flex-col gap-1">
                          <span
                            className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: borderColor, opacity: 0.85 }}
                          >
                             {log.action.replace(/_/g, ' ')}
                          </span>
                          <h3 className="font-bold text-lg leading-tight">{log.message}</h3>
                       </div>
                       <div className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink size={14} />
                       </div>
                     </div>

                     <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 text-xs text-muted">
                           <div
                             className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                             style={{ background: `${borderColor}22`, color: borderColor }}
                           >
                              {log.actorName?.charAt(0)}
                           </div>
                           <span>{t('activities.action_by')} <strong>{log.actorName}</strong></span>
                        </div>
                        <div className="lg:hidden flex items-center gap-2 text-[10px] text-muted ml-auto">
                           <Clock size={12} />
                           <span>{new Date(log.timestamp).toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                     </div>
                  </div>
                </div>
                );
              })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-4 mt-12 pb-10">
            <button 
              className="page-btn flex items-center gap-2 px-4 w-auto disabled:opacity-30" 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft size={16} /> {t('common.previous')}
            </button>
            <div className="flex items-center text-sm font-bold text-muted">
               {t('common.page')} {page + 1} {t('common.of')} {totalPages}
            </div>
            <button 
              className="page-btn flex items-center gap-2 px-4 w-auto disabled:opacity-30" 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              {t('common.next')} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
