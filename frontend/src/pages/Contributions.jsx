import { useState, useEffect } from 'react'
import { Activity, Plus, Search, Wallet, Box, ReceiptText, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, AlertTriangle, Upload, Eye, Download, FileText, X, Edit3, TrendingUp } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal'
import ModernFileUpload from '../components/ModernFileUpload'
import AmendmentRequestModal from '../components/AmendmentRequestModal'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { frw, getLocale } from '../utils/i18nHelper'
import useDebounce from '../hooks/useDebounce'

export default function Contributions() {
  const { user } = useAuth()
  const [contributions, setContributions] = useState([])
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [amendmentModal, setAmendmentModal] = useState({ open: false, record: null })
  const [topupModal, setTopupModal] = useState({ open: false })
  const [topupMemberId, setTopupMemberId] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [topupMonth, setTopupMonth] = useState(new Date().getMonth() + 1)
  const [topupYear, setTopupYear] = useState(new Date().getFullYear())
  const [topupPreview, setTopupPreview] = useState(null)
  const [topupPreviewLoading, setTopupPreviewLoading] = useState(false)
  const [topupResult, setTopupResult] = useState(null)
  const [topupLoading, setTopupLoading] = useState(false)
  const { t, language } = useLanguage()
  const isFinanceOrAbove = user?.role === 'ROLE_FINANCE' || user?.role === 'ROLE_PRESIDENT' || user?.role === 'ROLE_ADMIN'
  const [filterText, setFilterText] = useState('')
  const debouncedFilter = useDebounce(filterText)
  const [sortConfig, setSortConfig] = useState({ key: 'datePaid', direction: 'desc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Contract upload modal (from table row)
  const [contractModal, setContractModal] = useState({ open: false, contribution: null, contractFile: null })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  // Wizard state
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(1)
  const [contractFile, setContractFile] = useState(null)
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    type: 'SOCIAL',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    datePaid: new Date().toISOString().split('T')[0],
    details: ''
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [contRes, memRes, statsRes] = await Promise.all([
        api.get('/api/v1/contributions'),
        api.get('/api/v1/members'),
        api.get('/api/v1/dashboard/stats')
      ])
      setContributions(contRes.data)
      setStats(statsRes.data)
      const eligible = (memRes.data || [])
        .filter(m => m.type === 'STANDARD' && (m.totalShares || 0) > 0)
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      setMembers(eligible)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openForm = () => {
    setFormData({
      memberId: '',
      amount: '',
      type: 'SOCIAL',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      datePaid: new Date().toISOString().split('T')[0],
      details: ''
    })
    setContractFile(null)
    setStep(1)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    try {
      setActionLoading(true)
      const requestBlob = new Blob([JSON.stringify(formData)], { type: 'application/json' })
      const formDataToSend = new FormData()
      formDataToSend.append('request', requestBlob)
      if (contractFile) formDataToSend.append('contract', contractFile)
      await api.post('/api/v1/contributions', formDataToSend, {})
      setShowForm(false)
      fetchData()
      showToast(t('contributions.success_message'), 'success')
    } catch (error) {
      console.error(error)
      showToast(t('contributions.error_message'), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const openTopupModal = () => {
    setTopupMemberId('')
    setTopupAmount('')
    setTopupMonth(new Date().getMonth() + 1)
    setTopupYear(new Date().getFullYear())
    setTopupPreview(null)
    setTopupResult(null)
    setTopupModal({ open: true })
  }

  const loadTopupPreview = async (memberId) => {
    if (!memberId) { setTopupPreview(null); return }
    setTopupPreviewLoading(true)
    try {
      const res = await api.get(`/api/v1/contributions/interest-topup/preview/${memberId}`)
      setTopupPreview(res.data)
    } catch {
      setTopupPreview(null)
    } finally {
      setTopupPreviewLoading(false)
    }
  }

  const handleTopupMemberChange = (memberId) => {
    setTopupMemberId(memberId)
    setTopupAmount('')
    setTopupResult(null)
    loadTopupPreview(memberId)
  }

  const getTopupSplit = () => {
    const total = parseFloat(topupAmount) || 0
    if (!topupPreview) return { reserve: 0, social: 0 }
    const needed = parseFloat(topupPreview.reserveRemainingNeeded) || 0
    const reserve = Math.min(total, needed)
    const social = total - reserve
    return { reserve, social }
  }

  const handleTopupSubmit = async () => {
    if (!topupMemberId || !topupAmount) return
    setTopupLoading(true)
    try {
      const res = await api.post('/api/v1/contributions/interest-topup', {
        memberId: topupMemberId,
        amount: parseFloat(topupAmount),
        month: topupMonth,
        year: topupYear
      })
      setTopupResult(res.data)
      fetchData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record top-up', 'error')
    } finally {
      setTopupLoading(false)
    }
  }

  const handleUploadContractFromTable = async () => {
    if (!contractModal.contractFile) return
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('contract', contractModal.contractFile)
      const res = await api.post(`/api/v1/contributions/${contractModal.contribution.id}/contract`, formDataToSend, {})
      setContributions(prev => prev.map(c => c.id === res.data.id ? res.data : c))
      setContractModal({ open: false, contribution: null, contractFile: null })
      showToast('Receipt uploaded successfully', 'success')
    } catch (err) {
      console.error('Error uploading receipt:', err)
      showToast('Failed to upload receipt', 'error')
    }
  }

  const handlePreviewReceipt = async (id) => {
    try {
      const res = await api.get(`/api/v1/contributions/${id}/contract`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      window.open(url, '_blank')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to preview receipt', 'error')
    }
  }

  const handleDownloadReceipt = async (contribution) => {
    try {
      const res = await api.get(`/api/v1/contributions/${contribution.id}/contract`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const ext = contribution.signedContractPath ? '.' + contribution.signedContractPath.split('.').pop() : ''
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `receipt-${contribution.memberName}-${contribution.month}-${contribution.year}${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to download receipt', 'error')
    }
  }

  const handleDownloadReceiptPdf = async (contribution) => {
    try {
      const res = await api.get(`/api/v1/contributions/${contribution.id}/receipt`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `receipt-${contribution.memberName}-${contribution.month}-${contribution.year}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showToast(err.response?.data?.message || t('contributions.receipt_pdf_error'), 'error')
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'SOCIAL': return 'bg-blue-500/10 border-blue-500/20 text-blue-400'
      case 'PENALTY': return 'bg-red-500/10 border-red-500/20 text-red-400'
      case 'FRAIS_BANCAIRE': return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
      case 'OBLIGATORY_RESERVE': return 'bg-purple-500/10 border-purple-500/20 text-purple-400'
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400'
    }
  }

  const getTypeName = (type) => {
    switch (type) {
      case 'SOCIAL': return t('contributions.type_social')
      case 'PENALTY': return t('contributions.type_penalty')
      case 'FRAIS_BANCAIRE': return t('contributions.type_banking_fee')
      case 'OBLIGATORY_RESERVE': return t('contributions.type_reserve')
      default: return type
    }
  }

  const filteredData = contributions.filter(c =>
    !debouncedFilter ||
    c.memberName?.toLowerCase().includes(debouncedFilter.toLowerCase()) ||
    c.type?.toLowerCase().includes(debouncedFilter.toLowerCase())
  )

  const sortData = (data) => {
    if (!sortConfig.key) return data
    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.key], bVal = b[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
    setCurrentPage(1)
  }

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <ChevronsUpDown size={12} className="sort-icon text-muted" />
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="sort-icon text-accent" /> : <ChevronDown size={12} className="sort-icon text-accent" />
  }

  const sortedData = sortData(filteredData)
  const totalPages = Math.ceil(sortedData.length / rowsPerPage)
  const paginatedData = sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const StatCard = ({ title, value, unit, icon, loading, detail, children }) => (
    <div className="stat-card group hover:scale-[1.02] transition-all flex flex-col justify-between h-full min-h-[160px]">
      <div>
        <div className="flex justify-between items-start mb-4">
          <p className="stat-title">{title}</p>
          <div className="p-2 rounded-lg bg-white/5 text-muted group-hover:text-accent group-hover:bg-accent/10 transition-all shadow-sm border border-white/5">
            {icon}
          </div>
        </div>
        <div className="stat-value-group">
          <span className="stat-value tracking-tighter" style={{ fontSize: '1.75rem', fontWeight: 900 }}>{loading ? '...' : value}</span>
          {unit && <span className="stat-unit" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '4px' }}>{unit}</span>}
        </div>
      </div>
      {(detail || children) && (
        <div className="mt-4 flex flex-col gap-2">
           {detail && (
             <div className="flex items-center gap-2">
                <div style={{ color: '#b45309' }}>
                  <Activity size={14} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', letterSpacing: '-0.01em' }}>{detail}</span>
             </div>
           )}
           {children}
        </div>
      )}
    </div>
  )

  return (
    <div className="animate-in pb-10">
      <header className="page-header">
        <div className="header-info">
          <h1 className="text-2xl font-black tracking-tight text-white">{t('contributions.title')}</h1>
          <p className="text-sm text-slate-400 font-medium">{t('contributions.subtitle')}</p>
        </div>
        <div className="header-actions">
          {isFinanceOrAbove && (
            <button
              onClick={openTopupModal}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}
            >
              <TrendingUp size={16} strokeWidth={2.5} />
              Interest Top-up
            </button>
          )}
          <button onClick={openForm} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} strokeWidth={3} />
            {t('contributions.record_payment')}
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="reveal-up stagger-1">
          <StatCard
            title={t('contributions.social_fund_balance')}
            value={stats ? frw(stats.socialFundBalance, language) : '---'}
            unit="FRW"
            icon={<Wallet size={18} />}
            loading={loading}
          >
            <div className="space-y-1.5 border-t border-white/5 pt-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted uppercase tracking-tighter">{t('contributions.total_collected')}:</span>
                <span className="font-bold">{stats ? frw(stats.socialCollected, language) : '---'}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted uppercase tracking-tighter">{t('contributions.total_spent')}:</span>
                <span className="font-bold text-red-400">{stats ? frw(stats.socialSpent, language) : '---'}</span>
              </div>
            </div>
          </StatCard>
        </div>

        <div className="reveal-up stagger-3">
          <StatCard
            title={t('contributions.bank_fees_balance')}
            value={stats ? frw(stats.bankFeesBalance, language) : '---'}
            unit="FRW"
            icon={<Activity size={18} />}
            loading={loading}
          >
            <div className="space-y-1.5 border-t border-white/5 pt-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted uppercase tracking-tighter">{t('contributions.total_collected')}:</span>
                <span className="font-bold">{stats ? frw(stats.bankCollected, language) : '---'}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted uppercase tracking-tighter">{t('contributions.total_spent')}:</span>
                <span className="font-bold text-red-400">{stats ? frw(stats.bankSpent, language) : '---'}</span>
              </div>
            </div>
          </StatCard>
        </div>

        <div className="reveal-up stagger-4">
          <StatCard
            title={t('contributions.obligatory_reserves')}
            value={stats ? frw(stats.obligatoryReservePool, language) : '---'}
            unit="FRW"
            icon={<Box size={18} />}
            loading={loading}
            detail={t('contributions.target_detail')}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card mt-8 stagger-2 p-0 overflow-hidden relative">
        <div className="p-6 border-b border-white/10 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <ReceiptText size={20} className="text-accent" />
            <h2 className="text-xl font-bold">{t('contributions.ledger_table_header')}</h2>
          </div>
          <div className="search-box" style={{ maxWidth: '320px', marginBottom: 0 }}>
            <Search size={18} />
            <input
              type="text"
              placeholder={t('contributions.search_placeholder')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th className="sortable" onClick={() => handleSort('memberName')}>{t('contributions.member')} <SortIcon col="memberName" /></th>
                <th className="sortable" onClick={() => handleSort('type')}>{t('contributions.type')} <SortIcon col="type" /></th>
                <th>{t('contributions.period')}</th>
                <th className="sortable" onClick={() => handleSort('datePaid')}>{t('contributions.date')} <SortIcon col="datePaid" /></th>
                <th>{t('contributions.details')}</th>
                <th className="text-right sortable" onClick={() => handleSort('amount')}>{t('contributions.amount')} <SortIcon col="amount" /></th>
                <th className="text-right">{t('contributions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8">{t('common.loading')}</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-muted">{t('contributions.no_records')}</td></tr>
              ) : (
                paginatedData.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-muted text-xs font-mono">{(currentPage - 1) * rowsPerPage + i + 1}</td>
                    <td className="font-medium">{c.memberName || 'System'}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs border ${getTypeColor(c.type)}`}>
                        {getTypeName(c.type)}
                      </span>
                    </td>
                    <td className="text-muted">{String(c.month).padStart(2,'0')}/{c.year}</td>
                    <td className="text-muted">{new Date(c.datePaid).toLocaleDateString(getLocale(language))}</td>
                    <td className="text-muted text-sm max-w-[160px] truncate" title={c.details}>{c.details || <span className="opacity-40 italic">—</span>}</td>
                    <td className="text-right font-bold text-accent">{frw(c.amount, language)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {!c.signedContractPath && (
                          <button
                            className="btn-icon-action"
                            style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}
                            title={t('contributions.upload_receipt')}
                            onClick={() => setContractModal({ open: true, contribution: c, contractFile: null })}
                          >
                            <Upload size={15} />
                          </button>
                        )}
                        {c.signedContractPath && (
                          <>
                            <button
                              className="btn-icon-action"
                              style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)' }}
                              title={t('contributions.view_receipt')}
                              onClick={() => handlePreviewReceipt(c.id)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              className="btn-icon-action"
                              style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.1)' }}
                              title={t('contributions.download_receipt')}
                              onClick={() => handleDownloadReceipt(c)}
                            >
                              <Download size={15} />
                            </button>
                            <button
                              className="btn-icon-action"
                              style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}
                              title={t('contributions.replace_receipt')}
                              onClick={() => setContractModal({ open: true, contribution: c, contractFile: null })}
                            >
                              <Upload size={15} />
                            </button>
                          </>
                        )}
                        <button
                          className="btn-icon-action"
                          style={{ color: '#fb923c', background: 'rgba(251,146,60,0.1)' }}
                          title={t('contributions.download_receipt_pdf')}
                          onClick={() => handleDownloadReceiptPdf(c)}
                        >
                          <FileText size={15} />
                        </button>
                        {isFinanceOrAbove && c.amendmentStatus === 'ORIGINAL' && (
                          <button
                            className="btn-icon-action"
                            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}
                            title="Request Amendment"
                            onClick={() => setAmendmentModal({ open: true, record: c })}
                          >
                            <Edit3 size={15} />
                          </button>
                        )}
                        {c.amendmentStatus && c.amendmentStatus !== 'ORIGINAL' && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: c.amendmentStatus === 'AMENDED' ? 'rgba(239,68,68,0.1)' : c.amendmentStatus === 'CORRECTION' ? 'rgba(34,197,94,0.1)' : 'rgba(96,165,250,0.1)', color: c.amendmentStatus === 'AMENDED' ? '#ef4444' : c.amendmentStatus === 'CORRECTION' ? '#22c55e' : '#60a5fa', border: '1px solid currentColor' }}>
                            {c.amendmentStatus}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <div className="pagination-info">
              <span>{t('common.page')} {currentPage} {t('common.of')} {totalPages}</span>
            </div>
            <div className="pagination-btns">
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}><ChevronLeft size={14} /><ChevronLeft size={14} /></button>
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={14} /></button>
              <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={14} /></button>
              <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}><ChevronRight size={14} /><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Record Contribution Modal */}
      <Modal isOpen={showForm} onClose={() => !actionLoading && setShowForm(false)} maxWidth="540px">
        <div className="text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <ReceiptText size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('contributions.record_payment')}</h2>
              <p className="text-xs text-muted">{t('contributions.step')} {step} {t('common.of')} 2</p>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="filter-label">{t('contributions.select_member')}</label>
                <div className="pill-input-wrapper">
                  <select
                    value={formData.memberId}
                    onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                    className="pill-input"
                  >
                    <option value="">— {t('contributions.select_member')} —</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="wizard-actions" style={{ marginTop: '1rem' }}>
                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.memberId}
                  className="wizard-btn wizard-btn-primary w-full"
                >
                  {t('common.next') || 'Next'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="filter-label">{t('contributions.amount')}</label>
                  <div className="pill-input-wrapper">
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="pill-input"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="filter-label">{t('contributions.payment_type')}</label>
                  <div className="pill-input-wrapper">
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="pill-input"
                    >
                      <option value="SOCIAL">{t('contributions.type_social')}</option>
                      <option value="PENALTY">{t('contributions.type_penalty')}</option>
                      <option value="FRAIS_BANCAIRE">{t('contributions.type_banking_fee')}</option>
                      <option value="OBLIGATORY_RESERVE">{t('contributions.type_reserve')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="filter-label">{t('common.month')}</label>
                  <div className="pill-input-wrapper">
                    <select
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      className="pill-input"
                    >
                      {Object.keys(t('months', { returnObjects: true })).map((m, i) => (
                        <option key={i + 1} value={i + 1}>{t(`months.${m}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="filter-label">{t('common.year')}</label>
                  <div className="pill-input-wrapper">
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="pill-input"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="filter-label">{t('contributions.notes')}</label>
                <textarea
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  className="pill-input"
                  style={{ borderRadius: '1rem', height: '6rem', resize: 'none', padding: '0.875rem 1.5rem' }}
                  placeholder={t('common.optional_details')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {t('contributions.signed_receipt')} <span className="opacity-50 normal-case">({t('common.optional') || 'optional'})</span>
                </label>
                <ModernFileUpload
                  onFileSelect={(file) => setContractFile(file)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
                />
              </div>

              <div className="wizard-actions" style={{ marginTop: '0.5rem' }}>
                <button onClick={() => setStep(1)} className="wizard-btn wizard-btn-secondary">
                  {t('common.back')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.amount || actionLoading}
                  className="wizard-btn wizard-btn-primary"
                >
                  {actionLoading ? t('common.saving') : t('contributions.save_contribution')}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Contract upload modal (from table row) */}
      {contractModal.open && (
      <Modal
        isOpen={contractModal.open}
        onClose={() => setContractModal({ open: false, contribution: null, contractFile: null })}
        maxWidth="480px"
      >
        <div className="text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
              <ReceiptText size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {contractModal.contribution?.signedContractPath ? t('contributions.replace_receipt') : t('contributions.upload_receipt')}
              </h2>
              <p className="text-xs text-muted">
                {contractModal.contribution?.memberName} — {String(contractModal.contribution?.month).padStart(2,'0')}/{contractModal.contribution?.year}
              </p>
            </div>
          </div>

          <ModernFileUpload
            onFileSelect={(file) => setContractModal(prev => ({ ...prev, contractFile: file }))}
            existingFile={contractModal.contribution?.signedContractPath ? contractModal.contribution.signedContractPath.split('/').pop() : null}
            onPreview={() => handlePreviewReceipt(contractModal.contribution.id)}
            onDownload={() => handleDownloadReceipt(contractModal.contribution)}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
          />

          <div className="wizard-actions" style={{ marginTop: '1.5rem' }}>
            <button
              className="wizard-btn wizard-btn-secondary"
              onClick={() => setContractModal({ open: false, contribution: null, contractFile: null })}
            >
              {t('common.cancel')}
            </button>
            <button
              className="wizard-btn wizard-btn-primary"
              onClick={handleUploadContractFromTable}
              disabled={!contractModal.contractFile}
            >
              <Upload size={18} /> {t('contributions.upload_receipt')}
            </button>
          </div>
        </div>
      </Modal>
      )}

      {/* Amendment Modal */}
      <AmendmentRequestModal
        isOpen={amendmentModal.open}
        onClose={() => setAmendmentModal({ open: false, record: null })}
        transactionType="CONTRIBUTION"
        transaction={amendmentModal.record}
        amountField="amount"
        label={amendmentModal.record ? `${amendmentModal.record.memberName} — ${String(amendmentModal.record.month).padStart(2,'0')}/${amendmentModal.record.year} — ${amendmentModal.record.type}` : ''}
        onSuccess={() => setAmendmentModal({ open: false, record: null })}
      />

      {/* Interest Top-up Modal */}
      <Modal isOpen={topupModal.open} onClose={() => !topupLoading && setTopupModal({ open: false })} maxWidth="520px">
        <div className="text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Interest Top-up</h2>
              <p className="text-xs text-muted">Record a member's shortfall payment (reserve + social)</p>
            </div>
          </div>

          {topupResult ? (
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <p className="text-sm font-bold text-emerald-400 mb-3">Top-up recorded successfully</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Member</span>
                    <span className="font-semibold">{topupResult.memberName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Total Top-up</span>
                    <span className="font-bold">{Number(topupResult.totalTopup).toLocaleString()} FRW</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#a78bfa' }}>→ Obligatory Reserve</span>
                      <span style={{ color: '#a78bfa' }} className="font-bold">{Number(topupResult.reservePortion).toLocaleString()} FRW</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#60a5fa' }}>→ Social Fund</span>
                      <span style={{ color: '#60a5fa' }} className="font-bold">{Number(topupResult.socialPortion).toLocaleString()} FRW</span>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-2 text-xs text-muted">
                    Reserve total for {topupYear}: {Number(topupResult.reserveTotalAfterTopup).toLocaleString()} / 25,000 FRW
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="wizard-btn wizard-btn-secondary flex-1" onClick={() => { setTopupResult(null); setTopupMemberId(''); setTopupAmount(''); setTopupPreview(null) }}>
                  Record Another
                </button>
                <button className="wizard-btn wizard-btn-primary flex-1" onClick={() => setTopupModal({ open: false })}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="filter-label">Member</label>
                  <div className="pill-input-wrapper">
                    <select
                      value={topupMemberId}
                      onChange={(e) => handleTopupMemberChange(e.target.value)}
                      className="pill-input"
                    >
                      <option value="">— Select member —</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {topupPreviewLoading && (
                <p className="text-xs text-muted text-center py-2">Loading interest info...</p>
              )}

              {topupPreview && !topupPreviewLoading && (
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#a78bfa' }}>Member Interest Status — {topupYear}</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Available interest (not yet cashed)</span>
                      <span className="font-semibold">{Number(topupPreview.availableInterest).toLocaleString()} FRW</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Reserve already paid this year</span>
                      <span className="font-semibold">{Number(topupPreview.reserveAlreadyPaid).toLocaleString()} FRW</span>
                    </div>
                    <div className="flex justify-between font-bold" style={{ color: Number(topupPreview.topupAmount) > 0 ? '#f59e0b' : '#22c55e' }}>
                      <span>Reserve shortfall (top-up needed)</span>
                      <span>{Number(topupPreview.topupAmount).toLocaleString()} FRW</span>
                    </div>
                  </div>
                  {Number(topupPreview.topupAmount) <= 0 && (
                    <p className="text-xs text-emerald-400 mt-2">✓ This member's interest covers the full 25,000 FRW reserve. No top-up required.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2 col-span-1">
                  <label className="filter-label">Month</label>
                  <div className="pill-input-wrapper">
                    <select value={topupMonth} onChange={(e) => setTopupMonth(Number(e.target.value))} className="pill-input">
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2 col-span-1">
                  <label className="filter-label">Year</label>
                  <div className="pill-input-wrapper">
                    <input type="number" value={topupYear} onChange={(e) => setTopupYear(Number(e.target.value))} className="pill-input" />
                  </div>
                </div>
                <div className="space-y-2 col-span-1">
                  <label className="filter-label">Total Amount</label>
                  <div className="pill-input-wrapper">
                    <input type="number" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} className="pill-input" placeholder="0" min="0" />
                  </div>
                </div>
              </div>

              {topupAmount && parseFloat(topupAmount) > 0 && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Auto-calculated split</p>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#a78bfa' }}>→ Obligatory Reserve (fills 25,000 first)</span>
                    <span style={{ color: '#a78bfa' }} className="font-bold">{getTopupSplit().reserve.toLocaleString()} FRW</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#60a5fa' }}>→ Social Fund (remainder)</span>
                    <span style={{ color: '#60a5fa' }} className="font-bold">{getTopupSplit().social.toLocaleString()} FRW</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button className="wizard-btn wizard-btn-secondary" onClick={() => setTopupModal({ open: false })}>
                  Cancel
                </button>
                <button
                  className="wizard-btn wizard-btn-primary flex-1"
                  disabled={!topupMemberId || !topupAmount || parseFloat(topupAmount) <= 0 || topupLoading}
                  onClick={handleTopupSubmit}
                  style={{ background: 'rgba(139,92,246,0.8)' }}
                >
                  {topupLoading ? 'Recording...' : 'Record Top-up'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-right-10 duration-300">
          <div className={`glass-card p-4 min-w-[300px] border-l-4 ${
            toast.type === 'success' ? 'border-l-emerald-500 bg-emerald-500/10' : 'border-l-red-500 bg-red-500/10'
          } flex items-center gap-3 backdrop-blur-xl shadow-2xl`}>
            {toast.type === 'success' ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <ReceiptText size={18} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                <AlertTriangle size={18} />
              </div>
            )}
            <div>
              <p className="text-sm font-bold tracking-tight">
                {toast.type === 'success' ? t('common.success') : t('common.error')}
              </p>
              <p className="text-xs text-muted leading-tight">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast({ ...toast, show: false })}
              className="ml-auto text-muted hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
