import { useState, useEffect } from 'react'
import { Activity, Plus, Search, Box, ArrowUpRight, DollarSign, Upload, Eye, Download, X, AlertTriangle, Edit3 } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal'
import ModernFileUpload from '../components/ModernFileUpload'
import AmendmentRequestModal from '../components/AmendmentRequestModal'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { frw, getLocale } from '../utils/i18nHelper'
import useDebounce from '../hooks/useDebounce'

export default function Expenditure() {
  const { user } = useAuth()
  const [amendmentModal, setAmendmentModal] = useState({ open: false, record: null })
  const { t, language } = useLanguage()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [filterText, setFilterText] = useState('')
  const debouncedFilter = useDebounce(filterText)
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage] = useState(10)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const [showForm, setShowForm] = useState(false)
  const [slipFile, setSlipFile] = useState(null)
  const [formData, setFormData] = useState({ amount: '', type: 'SOCIAL', description: '', date: '' })

  const [slipModal, setSlipModal] = useState({ open: false, expense: null, slipFile: null })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/expenses')
      setExpenses(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openForm = () => {
    setFormData({ amount: '', type: 'SOCIAL', description: '', date: '' })
    setSlipFile(null)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    try {
      setActionLoading(true)
      const requestBlob = new Blob([JSON.stringify({
        amount: formData.amount,
        type: formData.type,
        description: formData.description,
        date: formData.date
      })], { type: 'application/json' })
      const fd = new FormData()
      fd.append('request', requestBlob)
      if (slipFile) fd.append('slip', slipFile)
      await api.post('/api/v1/expenses', fd, {})
      setShowForm(false)
      fetchData()
      showToast(t('expenditure.success_record') || 'Expense recorded successfully', 'success')
    } catch (error) {
      console.error(error)
      showToast(t('expenditure.failed_record') || 'Failed to record expense', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUploadSlipFromTable = async () => {
    if (!slipModal.slipFile) return
    try {
      const fd = new FormData()
      fd.append('slip', slipModal.slipFile)
      const res = await api.post(`/api/v1/expenses/${slipModal.expense.id}/slip`, fd, {})
      setExpenses(prev => prev.map(e => e.id === res.data.id ? res.data : e))
      setSlipModal({ open: false, expense: null, slipFile: null })
      showToast('Slip uploaded successfully', 'success')
    } catch (err) {
      console.error('Error uploading slip:', err)
      showToast('Failed to upload slip', 'error')
    }
  }

  const handlePreviewSlip = async (id) => {
    try {
      const res = await api.get(`/api/v1/expenses/${id}/slip`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      window.open(url, '_blank')
    } catch (err) {
      console.error('Failed to preview slip:', err)
    }
  }

  const handleDownloadSlip = async (expense) => {
    try {
      const res = await api.get(`/api/v1/expenses/${expense.id}/slip`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const ext = expense.slipPath ? '.' + expense.slipPath.split('.').pop() : ''
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `slip-${expense.type}-${expense.date}${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download slip:', err)
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'SOCIAL': return 'bg-blue-500/10 border-blue-500/20 text-blue-400'
      case 'BANK': return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
      case 'OTHER': return 'bg-gray-500/10 border-gray-500/20 text-gray-400'
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400'
    }
  }

  const getFormatType = (type) => {
    switch (type) {
      case 'SOCIAL': return t('dashboard.social_fund_credit')
      case 'BANK': return t('dashboard.bank_fees')
      case 'OTHER': return t('dashboard.other_costs')
      default: return type
    }
  }

  const filteredData = expenses.filter(e =>
    !debouncedFilter ||
    e.description?.toLowerCase().includes(debouncedFilter.toLowerCase()) ||
    e.type?.toLowerCase().includes(debouncedFilter.toLowerCase())
  )

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
    setCurrentPage(1)
  }

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0
    let aVal = a[sortConfig.key], bVal = b[sortConfig.key]
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.ceil(sortedData.length / rowsPerPage)
  const paginatedData = sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const totalSocial = expenses.filter(e => e.type === 'SOCIAL').reduce((acc, e) => acc + (e.amount || 0), 0)
  const totalBank = expenses.filter(e => e.type === 'BANK').reduce((acc, e) => acc + (e.amount || 0), 0)
  const totalOther = expenses.filter(e => e.type === 'OTHER').reduce((acc, e) => acc + (e.amount || 0), 0)

  const StatCard = ({ title, value, unit, icon, loading, detail }) => (
    <div className="stat-card group hover:scale-[1.02] transition-all flex flex-col justify-between h-full">
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
      {detail && (
        <div className="mt-4 flex items-center gap-2">
          <div style={{ color: '#b45309' }}><Activity size={14} strokeWidth={2.5} /></div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', letterSpacing: '-0.01em' }}>{detail}</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="animate-in pb-10">
      <header className="page-header">
        <div className="header-info">
          <h1>{t('expenditure.ledger_title')}</h1>
          <p className="text-muted">{t('expenditure.ledger_sub')}</p>
        </div>
        <div className="header-actions">
          <button className="wizard-btn wizard-btn-primary" onClick={openForm}>
            <Plus size={18} /> {t('expenditure.new_record')}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="reveal-up stagger-1">
          <StatCard title={t('dashboard.social_fund_credit')} value={frw(totalSocial, language)} unit="FRW" icon={<ArrowUpRight size={18} />} loading={loading} detail={t('expenditure.social_detail')} />
        </div>
        <div className="reveal-up stagger-2">
          <StatCard title={t('dashboard.bank_fees')} value={frw(totalBank, language)} unit="FRW" icon={<Activity size={18} />} loading={loading} detail={t('expenditure.bank_detail')} />
        </div>
        <div className="reveal-up stagger-3">
          <StatCard title={t('dashboard.other_costs')} value={frw(totalOther, language)} unit="FRW" icon={<Box size={18} />} loading={loading} detail={t('expenditure.other_detail')} />
        </div>
      </div>

      <div className="glass-card mt-8 stagger-2 p-0 overflow-hidden relative">
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight size={20} className="text-accent" />
            <h2 className="text-xl">{t('expenditure.ledger_title')}</h2>
          </div>
          <div className="search-box" style={{ maxWidth: '300px', marginBottom: 0 }}>
            <Search size={18} />
            <input type="text" placeholder={t('expenditure.search_placeholder')} value={filterText} onChange={e => setFilterText(e.target.value)} />
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th className="sortable" onClick={() => handleSort('type')}>{t('expenditure.type')}</th>
                <th className="sortable" onClick={() => handleSort('date')}>{t('expenditure.date')}</th>
                <th>{t('expenditure.description')}</th>
                <th>{t('reports.recorded_by')}</th>
                <th className="text-right sortable" onClick={() => handleSort('amount')}>{t('expenditure.amount')}</th>
                <th className="text-right">{t('contributions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center py-8">{t('common.loading')}</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-muted">{t('expenditure.no_expenditures')}</td></tr>
              ) : (
                paginatedData.map((e, i) => (
                  <tr key={e.id}>
                    <td className="text-muted text-xs font-mono">{(currentPage - 1) * rowsPerPage + i + 1}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs border ${getTypeColor(e.type)}`}>
                        {getFormatType(e.type)}
                      </span>
                    </td>
                    <td className="text-muted">
                      {new Date(e.date).toLocaleDateString(getLocale(language), { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="text-muted text-sm max-w-[200px] truncate" title={e.description}>{e.description || <span className="opacity-40 italic">—</span>}</td>
                    <td className="text-muted">{e.recordedByName}</td>
                    <td className="text-right font-bold text-accent">{frw(e.amount || 0, language)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {!e.slipPath && (
                          <button
                            className="btn-icon-action"
                            style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}
                            title={t('expenditure.upload_slip') || 'Upload Slip'}
                            onClick={() => setSlipModal({ open: true, expense: e, slipFile: null })}
                          >
                            <Upload size={15} />
                          </button>
                        )}
                        {e.slipPath && (
                          <>
                            <button
                              className="btn-icon-action"
                              style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)' }}
                              title={t('expenditure.view_slip') || 'View Slip'}
                              onClick={() => handlePreviewSlip(e.id)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              className="btn-icon-action"
                              style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.1)' }}
                              title={t('expenditure.download_slip') || 'Download Slip'}
                              onClick={() => handleDownloadSlip(e)}
                            >
                              <Download size={15} />
                            </button>
                            <button
                              className="btn-icon-action"
                              style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}
                              title={t('expenditure.replace_slip') || 'Replace Slip'}
                              onClick={() => setSlipModal({ open: true, expense: e, slipFile: null })}
                            >
                              <Upload size={15} />
                            </button>
                          </>
                        )}
                        {(!e.amendmentStatus || e.amendmentStatus === 'ORIGINAL') && (
                          <button
                            className="btn-icon-action"
                            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}
                            title="Request Amendment"
                            onClick={() => setAmendmentModal({ open: true, record: e })}
                          >
                            <Edit3 size={15} />
                          </button>
                        )}
                        {e.amendmentStatus && e.amendmentStatus !== 'ORIGINAL' && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: e.amendmentStatus === 'AMENDED' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: e.amendmentStatus === 'AMENDED' ? '#ef4444' : '#22c55e', border: '1px solid currentColor' }}>
                            {e.amendmentStatus}
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
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</button>
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
              <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
              <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      <Modal isOpen={showForm} onClose={() => !actionLoading && setShowForm(false)} maxWidth="500px">
        <div className="text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <DollarSign size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('expenditure.record_transaction')}</h2>
              <p className="text-xs text-muted">{t('expenditure.registration')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('expenditure.category')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { value: 'SOCIAL', label: t('dashboard.social_fund_credit'), color: '#60a5fa' },
                  { value: 'BANK',   label: t('dashboard.bank_fees'),          color: '#fbbf24' },
                  { value: 'OTHER',  label: t('dashboard.other_costs'),         color: '#9ca3af' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: opt.value })}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '12px',
                      border: `1px solid ${formData.type === opt.value ? opt.color : 'rgba(255,255,255,0.08)'}`,
                      background: formData.type === opt.value ? `${opt.color}15` : 'rgba(255,255,255,0.04)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      color: formData.type === opt.value ? opt.color : 'var(--text-main)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('expenditure.amount')} (FRW)</label>
              <input
                type="number"
                className="pill-input"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('expenditure.date')}</label>
              <input
                type="date"
                className="pill-input"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('expenditure.description')}</label>
              <textarea
                className="pill-input"
                style={{ minHeight: '90px', resize: 'vertical', borderRadius: '1rem', padding: '0.875rem 1.5rem' }}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('loans.purpose_placeholder')}
              />
            </div>

            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">
                {t('expenditure.payment_slip') || 'Payment Slip'} <span className="opacity-50 lowercase normal-case">({t('common.optional')})</span>
              </label>
              <ModernFileUpload
                onFileSelect={(file) => setSlipFile(file)}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button type="button" className="wizard-btn wizard-btn-secondary w-full" onClick={() => setShowForm(false)}>{t('expenditure.cancel')}</button>
              <button
                type="button"
                className="wizard-btn wizard-btn-primary w-full"
                onClick={handleSubmit}
                disabled={!formData.amount || !formData.description || !formData.date || actionLoading}
              >
                {actionLoading ? t('loans.processing') : t('expenditure.submit_entry')}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Slip upload modal (from table) */}
      {slipModal.open && (
        <Modal
          isOpen={slipModal.open}
          onClose={() => setSlipModal({ open: false, expense: null, slipFile: null })}
          maxWidth="480px"
        >
          <div className="text-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                <ArrowUpRight size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {slipModal.expense?.slipPath ? (t('expenditure.replace_slip') || 'Replace Slip') : (t('expenditure.upload_slip') || 'Upload Slip')}
                </h2>
                <p className="text-xs text-muted">
                  {slipModal.expense?.description} — {slipModal.expense?.date}
                </p>
              </div>
            </div>

            <ModernFileUpload
              onFileSelect={(file) => setSlipModal(prev => ({ ...prev, slipFile: file }))}
              existingFile={slipModal.expense?.slipPath ? slipModal.expense.slipPath.split('/').pop() : null}
              onPreview={() => handlePreviewSlip(slipModal.expense.id)}
              onDownload={() => handleDownloadSlip(slipModal.expense)}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
            />

            <div className="wizard-actions" style={{ marginTop: '1.5rem' }}>
              <button
                className="wizard-btn wizard-btn-secondary"
                onClick={() => setSlipModal({ open: false, expense: null, slipFile: null })}
              >
                {t('common.cancel')}
              </button>
              <button
                className="wizard-btn wizard-btn-primary"
                onClick={handleUploadSlipFromTable}
                disabled={!slipModal.slipFile}
              >
                <Upload size={18} /> {t('expenditure.upload_slip') || 'Upload Slip'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Amendment Modal */}
      <AmendmentRequestModal
        isOpen={amendmentModal.open}
        onClose={() => setAmendmentModal({ open: false, record: null })}
        transactionType="GROUP_EXPENSE"
        transaction={amendmentModal.record}
        amountField="amount"
        label={amendmentModal.record ? `${amendmentModal.record.type} — ${amendmentModal.record.date} — ${amendmentModal.record.description}` : ''}
        onSuccess={() => setAmendmentModal({ open: false, record: null })}
      />

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-right-10 duration-300">
          <div className={`glass-card p-4 min-w-[300px] border-l-4 ${
            toast.type === 'success' ? 'border-l-emerald-500 bg-emerald-500/10' : 'border-l-red-500 bg-red-500/10'
          } flex items-center gap-3 backdrop-blur-xl shadow-2xl`}>
            {toast.type === 'success' ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <ArrowUpRight size={18} />
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
            <button onClick={() => setToast({ ...toast, show: false })} className="ml-auto text-muted hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
