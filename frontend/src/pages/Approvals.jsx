import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Filter, DollarSign, ShieldCheck, Calendar, AlertTriangle, ArrowRight, LogOut, ChevronRight, Loader2, FileText, Edit3 } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal'
import FeedbackModal from '../components/FeedbackModal'
import exitService from '../services/exit.service'
import amendmentService from '../services/amendment.service'
import { useLanguage } from '../context/LanguageContext'
import { frw, getLocale } from '../utils/i18nHelper'

const TABS = ['loans', 'exits', 'amendments']

const AMENDMENT_TYPE_LABELS = {
  SHARE_RECORD: 'Share Purchase / Transfer',
  CONTRIBUTION: 'Contribution',
  LOAN_REPAYMENT: 'Loan Repayment',
  GROUP_EXPENSE: 'Group Expense',
  PENALTY: 'Penalty',
  SOCIAL_CLAIM: 'Social Claim',
}

const AMENDMENT_STATUS_STYLE = {
  PENDING_REVIEW: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)', label: 'Pending Review' },
  APPROVED:       { bg: 'rgba(34,197,94,0.1)',  color: '#22c55e', border: 'rgba(34,197,94,0.25)',  label: 'Approved' },
  APPLIED:        { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'rgba(96,165,250,0.25)', label: 'Applied' },
  REJECTED:       { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', border: 'rgba(239,68,68,0.25)',  label: 'Rejected' },
  CANCELLED:      { bg: 'rgba(156,163,175,0.1)', color: '#9ca3af', border: 'rgba(156,163,175,0.25)', label: 'Cancelled' },
}

export default function Approvals() {
  const [activeTab, setActiveTab] = useState('loans')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState([])
  const [pendingExits, setPendingExits] = useState([])
  const [stats, setStats] = useState({ loans: 0, claims: 0 })
  const [dashboardStats, setDashboardStats] = useState(null)
  const { t, language } = useLanguage()

  const [pendingAmendments, setPendingAmendments] = useState([])
  const [amendmentRejectModal, setAmendmentRejectModal] = useState({ open: false, item: null })
  const [amendmentRejectReason, setAmendmentRejectReason] = useState('')

  const [confirmModal, setConfirmModal] = useState({ open: false, item: null })
  const [exitConfirmModal, setExitConfirmModal] = useState({ open: false, item: null, action: null })
  const [rejectReason, setRejectReason] = useState('')

  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)

  const user = JSON.parse(localStorage.getItem('user'))
  const isPresident = user?.role === 'ROLE_PRESIDENT'
  const isFinance = user?.role === 'ROLE_FINANCE'
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const canApproveLoans = isPresident
  const canSeeExits = isPresident || isFinance || isAdmin
  const visibleExits = pendingExits.filter(e =>
    isPresident || isAdmin ? e.status === 'SETTLEMENT_READY' : e.status === 'APPROVED'
  )

  useEffect(() => {
    if (isPresident || isFinance || isAdmin) fetchAll()
    else setLoading(false)
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const promises = [api.get('/api/v1/dashboard/stats')]
      if (isPresident || isAdmin) promises.push(api.get('/api/v1/approvals/pending'))
      if (canSeeExits) promises.push(exitService.getPendingExitRequests())

      const results = await Promise.allSettled(promises)
      if (results[0].status === 'fulfilled') setDashboardStats(results[0].value.data)

      let pendingLoans = []
      let exits = []

      let offset = 1
      if (isPresident || isAdmin) {
        if (results[offset].status === 'fulfilled') {
          pendingLoans = results[offset].value.data
          setPending(pendingLoans)
          setStats(s => ({ ...s, loans: pendingLoans.filter(i => i.requestedAmount).length }))
        }
        offset++
      }
      if (canSeeExits && results[offset]?.status === 'fulfilled') {
        exits = results[offset].value.data
        setPendingExits(exits)
      }

      // Fetch pending amendments separately (always, for president/admin)
      if (isPresident || isAdmin) {
        try {
          const am = await amendmentService.getPendingAmendments()
          setPendingAmendments(am)
        } catch { /* non-critical */ }
      }

      // Auto-switch to the tab that has pending items, prioritising exits
      if (exits.length > 0) setActiveTab('exits')
      else if (pendingLoans.length > 0) setActiveTab('loans')
      else if (canSeeExits) setActiveTab('exits')
    } catch (err) {
      console.error('Error fetching approvals data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Loan actions ─────────────────────────────────────────────────────────
  const executeAction = async (item, action) => {
    setConfirmModal({ open: false, item: null })
    try {
      await api.post(`/api/v1/approvals/loans/${item.id}/${action}`, {})
      fetchAll()
      const isApprove = action === 'approve'
      setFeedbackData({
        type: 'success',
        title: isApprove ? t('approvals.loan_authorized') : t('approvals.loan_declined'),
        message: isApprove ? t('approvals.success_authorize') : t('approvals.success_decline'),
        details: [
          { label: t('approvals.member'), value: item.memberName },
          { label: t('approvals.amount'), value: frw(item.requestedAmount, language) },
          { label: t('approvals.decision'), value: isApprove ? t('approvals.authorized_status') : t('approvals.declined_status') },
        ],
        actionLabel: t('approvals.back_to_queue')
      })
      setShowFeedback(true)
    } catch (err) {
      setFeedbackData({
        type: 'error',
        title: t('common.error'),
        message: err.response?.data?.message || t('common.system_error'),
        details: [{ label: t('common.action'), value: action.toUpperCase() }],
        actionLabel: t('common.close')
      })
      setShowFeedback(true)
    }
  }

  // ── Exit actions ─────────────────────────────────────────────────────────
  const executeExitAction = async () => {
    const { item, action } = exitConfirmModal
    setExitConfirmModal({ open: false, item: null, action: null })
    try {
      if (action === 'approve') {
        await exitService.approveExit(item.id)
      } else if (action === 'payout') {
        await exitService.recordPayout(item.id, rejectReason || 'N/A')
      } else {
        await exitService.rejectExit(item.id, rejectReason || 'No reason provided')
      }
      setRejectReason('')
      fetchAll()
      setFeedbackData({
        type: 'success',
        title: action === 'approve' ? t('exit.approved_title') : action === 'payout' ? t('exit.payout_recorded_title') : t('exit.rejected_title'),
        message: action === 'approve' ? t('exit.approved_message') : action === 'payout' ? t('exit.payout_recorded_message') : t('exit.rejected_message'),
        details: [
          { label: t('exit.member_label'), value: item.memberName },
          { label: t('exit.net_payout'), value: frw(item.netSettlementAmount, language) },
          { label: t('exit.exit_type_label'), value: item.exitType },
        ],
        actionLabel: t('approvals.back_to_queue')
      })
      setShowFeedback(true)
    } catch (err) {
      setFeedbackData({
        type: 'error',
        title: t('common.error'),
        message: err.response?.data?.message || t('common.system_error'),
        details: [],
        actionLabel: t('common.close')
      })
      setShowFeedback(true)
    }
  }

  // ── Amendment actions ─────────────────────────────────────────────────────
  const executeAmendmentAction = async (amendment, action) => {
    try {
      if (action === 'approve') {
        await amendmentService.approveAmendment(amendment.id)
      } else {
        await amendmentService.rejectAmendment(amendment.id, amendmentRejectReason || 'No reason provided')
      }
      setAmendmentRejectModal({ open: false, item: null })
      setAmendmentRejectReason('')
      fetchAll()
      setFeedbackData({
        type: action === 'approve' ? 'success' : 'error',
        title: action === 'approve' ? 'Amendment Approved & Applied' : 'Amendment Rejected',
        message: action === 'approve'
          ? 'The correcting entries have been applied to the system. The original record is preserved with AMENDED status.'
          : 'The amendment request has been rejected.',
        details: [
          { label: 'Transaction Type', value: AMENDMENT_TYPE_LABELS[amendment.transactionType] || amendment.transactionType },
          { label: 'Original Amount', value: `${Number(amendment.originalAmount).toLocaleString()} FRW` },
          { label: 'Correct Amount', value: `${Number(amendment.correctAmount).toLocaleString()} FRW` },
          { label: 'Requested By', value: amendment.requestedByName },
        ],
        actionLabel: 'Back to Queue',
      })
      setShowFeedback(true)
    } catch (err) {
      setFeedbackData({
        type: 'error',
        title: 'Action Failed',
        message: err.response?.data?.message || 'Could not process the amendment.',
        details: [],
        actionLabel: 'Close',
      })
      setShowFeedback(true)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString || new Date(dateString).getFullYear() < 2000) {
      return <span style={{ fontStyle: 'italic', opacity: 0.6, color: 'var(--text-muted)' }}>{t('common.not_specified')}</span>
    }
    return new Date(dateString).toLocaleDateString(getLocale(language), { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const exitStatusColor = (status) => {
    if (status === 'SETTLEMENT_READY') return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' }
    if (status === 'APPROVED') return { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' }
    return { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'rgba(96,165,250,0.25)' }
  }

  if (!isPresident && !isFinance && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="avatar" style={{ width: '80px', height: '80px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '1.5rem', boxShadow: 'none' }}>
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t('approvals.restricted_title')}</h2>
        <p className="text-muted max-w-md">{t('approvals.restricted_message')}</p>
      </div>
    )
  }

  return (
    <div className="animate-in pb-10">
      <header className="page-header">
        <div className="header-info">
          <h1>{t('approvals.title')}</h1>
          <p className="text-muted">{t('approvals.subtitle')}</p>
        </div>
      </header>

      {/* Stats */}
      <div className="dashboard-grid stagger-1">
        <div className="stat-card">
          <p className="stat-title">{t('approvals.pending_loans')}</p>
          <div className="stat-value-group">
            <span className="stat-value">{stats.loans}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-accent">
            <Clock size={14} /> <span>{t('approvals.awaiting_board')}</span>
          </div>
        </div>
        <div className="stat-card">
          <p className="stat-title">{t('exit.pending_exits')}</p>
          <div className="stat-value-group">
            <span className="stat-value">{visibleExits.length}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: '#ef4444' }}>
            <LogOut size={14} /> <span>{t('exit.awaiting_settlement')}</span>
          </div>
        </div>
        <div className="stat-card" style={{ background: 'var(--accent-glow)', borderColor: 'rgba(234, 179, 8, 0.2)' }}>
          <p className="stat-title">{t('approvals.available_for_loans')}</p>
          <div className="stat-value-group">
            <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>
              {dashboardStats ? frw(dashboardStats.availableForLoan, language) : '---'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted">
            <ShieldCheck size={14} /> <span>{t('approvals.active_out')}: {dashboardStats ? frw(dashboardStats.activeLoans, language) : '---'}</span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2.5rem', marginBottom: '1.5rem' }}>
        {(isPresident || isAdmin) && (
          <button
            onClick={() => setActiveTab('loans')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.875rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s',
              background: activeTab === 'loans' ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'loans' ? '#000' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'loans' ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`
            }}
          >
            <FileText size={16} /> {t('approvals.loan_tab')} {stats.loans > 0 && <span style={{ background: activeTab === 'loans' ? 'rgba(0,0,0,0.2)' : 'var(--accent)', color: activeTab === 'loans' ? '#000' : '#000', borderRadius: '20px', padding: '1px 7px', fontSize: '0.75rem' }}>{stats.loans}</span>}
          </button>
        )}
        {canSeeExits && (
          <button
            onClick={() => setActiveTab('exits')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.875rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s',
              background: activeTab === 'exits' ? '#ef4444' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'exits' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'exits' ? '#ef4444' : 'rgba(255,255,255,0.08)'}`
            }}
          >
            <LogOut size={16} /> {t('exit.exit_tab')} {visibleExits.length > 0 && <span style={{ background: activeTab === 'exits' ? 'rgba(255,255,255,0.25)' : '#ef4444', color: '#fff', borderRadius: '20px', padding: '1px 7px', fontSize: '0.75rem' }}>{visibleExits.length}</span>}
          </button>
        )}
        {(isPresident || isAdmin) && (
          <button
            onClick={() => setActiveTab('amendments')}
            style={{
              padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.875rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s',
              background: activeTab === 'amendments' ? '#f59e0b' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'amendments' ? '#000' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'amendments' ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`
            }}
          >
            <Edit3 size={16} /> Amendments
            {pendingAmendments.length > 0 && (
              <span style={{
                background: activeTab === 'amendments' ? 'rgba(0,0,0,0.2)' : '#f59e0b',
                color: activeTab === 'amendments' ? '#000' : '#000',
                borderRadius: '20px', padding: '1px 7px', fontSize: '0.75rem'
              }}>
                {pendingAmendments.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── LOAN APPROVALS TAB ── */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-20"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div></div>
          ) : pending.length === 0 ? (
            <div className="glass-card py-24 text-center" style={{ borderStyle: 'dashed', opacity: 0.6 }}>
              <CheckCircle className="mx-auto mb-6 text-accent" style={{ opacity: 0.2 }} size={64} />
              <p className="text-xl font-medium">{t('approvals.all_clear')}</p>
              <p className="text-muted">{t('approvals.empty_queue')}</p>
            </div>
          ) : pending.map((item, index) => (
            <div key={item.id} className={`glass-card hover-card animate-in stagger-${(index % 3) + 1}`} style={{ padding: '2rem' }}>
              <div className="approval-card-grid">
                <div className="member-profile-section">
                  <div className="avatar" style={{ width: '60px', height: '60px', fontSize: '1.25rem', borderRadius: '14px', flexShrink: 0 }}>
                    {item.memberName?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">{item.memberName}</h3>
                    <span className="badge pending">{t('approvals.loan_application')}</span>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted">
                      <ShieldCheck size={12} className="text-accent" />
                      <span>{t('approvals.national_id')}: {item.memberNationalId}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-baseline gap-6 justify-between md:justify-start">
                    <div className="amount-display">{frw(item.requestedAmount, language)}</div>
                    <div className="detail-item">
                      <span className="detail-label">{t('approvals.issuance_date')}</span>
                      <span className="detail-value text-accent"><Calendar size={14} />{formatDate(item.issuedDate)}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-item flex-grow">
                      <span className="detail-label">{t('approvals.loan_purpose')}</span>
                      <p className="purpose-box">{item.purpose || t('approvals.purpose_placeholder')}</p>
                    </div>
                    <div className="detail-item min-w-[140px]">
                      <span className="detail-label">{t('approvals.applied_date')}</span>
                      <span className="detail-value text-muted"><Clock size={14} />{new Date(item.createdAt).toLocaleDateString(getLocale(language))}</span>
                    </div>
                  </div>
                </div>
                <div className="auth-btn-group">
                  <button className="btn-authorize" onClick={() => setConfirmModal({ open: true, item })}>
                    <CheckCircle size={18} /> {t('approvals.authorize')}
                  </button>
                  <button className="btn-decline" onClick={() => executeAction(item, 'reject')}>
                    <XCircle size={18} /> {t('approvals.decline')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EXIT REQUESTS TAB ── */}
      {activeTab === 'exits' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : visibleExits.length === 0 ? (
            <div className="glass-card py-24 text-center" style={{ borderStyle: 'dashed', opacity: 0.6 }}>
              <LogOut className="mx-auto mb-6" style={{ opacity: 0.2, color: '#ef4444' }} size={64} />
              <p className="text-xl font-medium">{t('exit.no_pending_exits')}</p>
              <p className="text-muted">{t('exit.no_pending_exits_sub')}</p>
            </div>
          ) : visibleExits.map((item, index) => {
            const sc = exitStatusColor(item.status)
            return (
              <div key={item.id} className={`glass-card hover-card animate-in stagger-${(index % 3) + 1}`} style={{ padding: '2rem', borderColor: 'rgba(239,68,68,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '2rem', alignItems: 'start' }}>

                  {/* Member info */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div className="avatar" style={{ width: '60px', height: '60px', fontSize: '1.25rem', borderRadius: '14px', flexShrink: 0, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                      {item.memberName?.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.35rem' }}>{item.memberName}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {item.status.replace('_', ' ')}
                        </span>
                        <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700, background: item.exitType === 'VOLUNTARY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: item.exitType === 'VOLUNTARY' ? '#22c55e' : '#ef4444', border: `1px solid ${item.exitType === 'VOLUNTARY' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                          {item.exitType === 'VOLUNTARY' ? t('exit.voluntary') : t('exit.expelled')}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{item.memberEmail}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: 'monospace' }}>{item.memberNationalId}</p>
                    </div>
                  </div>

                  {/* Financial summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('exit.total_shares')}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--accent)' }}>{frw(item.totalShareValue, language)}</span>
                    </div>
                    {item.totalUnpaidPenalties > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('exit.unpaid_penalties')}</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444' }}>− {frw(item.totalUnpaidPenalties, language)}</span>
                      </div>
                    )}
                    {/* Interest breakdown */}
                    {(item.totalExpectedInterest > 0 || item.totalPaidInterest > 0) && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('exit.interest_expected')}</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{frw(item.totalExpectedInterest, language)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('exit.interest_paid')}</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#22c55e' }}>+ {frw(item.totalPaidInterest, language)}</span>
                        </div>
                        {item.totalUnpaidInterest > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>{t('exit.interest_unpaid')}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b' }}>{frw(item.totalUnpaidInterest, language)}</span>
                          </div>
                        )}
                        {item.expectedLastPaymentDate && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('exit.expected_last_payment')}</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>
                              {new Date(item.expectedLastPaymentDate).toLocaleDateString(getLocale(language), { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      {t('exit.initiated_by')}: <strong>{item.initiatedByName}</strong> · {formatDate(item.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '160px' }}>
                    {item.status === 'SETTLEMENT_READY' && isPresident && (
                      <>
                        <button
                          onClick={() => setExitConfirmModal({ open: true, item, action: 'approve' })}
                          style={{
                            padding: '0.7rem 1.2rem', borderRadius: '10px', border: 'none',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            boxShadow: '0 4px 12px rgba(34,197,94,0.25)'
                          }}
                        >
                          <CheckCircle size={16} /> {t('exit.approve_exit')}
                        </button>
                        <button
                          onClick={() => setExitConfirmModal({ open: true, item, action: 'reject' })}
                          style={{
                            padding: '0.7rem 1.2rem', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444', fontWeight: 700, fontSize: '0.85rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                          }}
                        >
                          <XCircle size={16} /> {t('exit.reject_exit')}
                        </button>
                      </>
                    )}
                    {item.status === 'APPROVED' && isFinance && (
                      <button
                        onClick={() => setExitConfirmModal({ open: true, item, action: 'payout' })}
                        style={{
                          padding: '0.7rem 1.2rem', borderRadius: '10px', border: 'none',
                          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                          color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                          boxShadow: '0 4px 12px rgba(34,197,94,0.25)'
                        }}
                      >
                        <DollarSign size={16} /> {t('exit.record_payout')}
                      </button>
                    )}
                    {item.exitReason && (
                      <div style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700, display: 'block', marginBottom: '2px' }}>{t('exit.reason')}:</span>
                          {item.exitReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── AMENDMENTS TAB ── */}
      {activeTab === 'amendments' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f59e0b', borderTopColor: 'transparent' }}></div></div>
          ) : pendingAmendments.length === 0 ? (
            <div className="glass-card py-24 text-center" style={{ borderStyle: 'dashed', opacity: 0.6 }}>
              <Edit3 className="mx-auto mb-6" style={{ opacity: 0.2, color: '#f59e0b' }} size={64} />
              <p className="text-xl font-medium">No pending amendment requests</p>
              <p className="text-muted">All corrections have been reviewed.</p>
            </div>
          ) : pendingAmendments.map((item, index) => {
            const delta = Number(item.correctAmount) - Number(item.originalAmount)
            return (
              <div key={item.id} className={`glass-card hover-card animate-in stagger-${(index % 3) + 1}`} style={{ padding: '1.75rem', borderColor: 'rgba(245,158,11,0.12)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', alignItems: 'start' }}>

                  {/* Left: what and why */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                        background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)'
                      }}>
                        {AMENDMENT_TYPE_LABELS[item.transactionType] || item.transactionType}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Reason
                    </p>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {item.reason}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Requested by <strong>{item.requestedByName}</strong>
                      &nbsp;·&nbsp;{new Date(item.createdAt).toLocaleDateString(getLocale(language), { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Middle: amounts */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        Original (wrong)
                      </span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444', fontFamily: 'Outfit, sans-serif', textDecoration: 'line-through', opacity: 0.8 }}>
                        {Number(item.originalAmount).toLocaleString()} FRW
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        Correct amount
                      </span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22c55e', fontFamily: 'Outfit, sans-serif' }}>
                        {Number(item.correctAmount).toLocaleString()} FRW
                      </span>
                    </div>
                    <div style={{
                      padding: '0.5rem 0.75rem', borderRadius: '8px',
                      background: delta > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
                      border: delta > 0 ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(34,197,94,0.15)',
                    }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: delta > 0 ? '#ef4444' : '#22c55e' }}>
                        {delta > 0 ? '+' : ''}{Number(delta).toLocaleString()} FRW net change
                      </span>
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '160px' }}>
                    <button
                      onClick={() => executeAmendmentAction(item, 'approve')}
                      style={{
                        padding: '0.7rem 1.2rem', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        boxShadow: '0 4px 12px rgba(34,197,94,0.25)'
                      }}
                    >
                      <CheckCircle size={16} /> Approve & Apply
                    </button>
                    <button
                      onClick={() => setAmendmentRejectModal({ open: true, item })}
                      style={{
                        padding: '0.7rem 1.2rem', borderRadius: '10px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#ef4444', fontWeight: 700, fontSize: '0.85rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                      }}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── AMENDMENT REJECT MODAL ── */}
      <Modal isOpen={amendmentRejectModal.open} onClose={() => { setAmendmentRejectModal({ open: false, item: null }); setAmendmentRejectReason('') }} maxWidth="480px">
        {amendmentRejectModal.item && (
          <div className="text-center">
            <div className="success-icon-wrapper">
              <div className="success-icon-bg" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <XCircle size={40} strokeWidth={2.5} style={{ color: '#fff' }} />
              </div>
              <div className="success-pulse" style={{ background: '#ef4444' }}></div>
            </div>
            <div className="success-text-section">
              <h2 className="success-title" style={{ fontSize: '1.5rem' }}>Reject Amendment?</h2>
              <p className="success-message">The original record will remain unchanged. Please provide a reason.</p>
              <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Rejection Reason
                </label>
                <textarea
                  rows={3}
                  value={amendmentRejectReason}
                  onChange={e => setAmendmentRejectReason(e.target.value)}
                  placeholder="Why is this amendment being rejected?"
                  style={{
                    width: '100%', borderRadius: '10px', padding: '0.8rem 1rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => { setAmendmentRejectModal({ open: false, item: null }); setAmendmentRejectReason('') }}
                style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--item-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <XCircle size={18} /> Cancel
              </button>
              <button
                onClick={() => executeAmendmentAction(amendmentRejectModal.item, 'reject')}
                style={{ flex: 2, padding: '1rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}
              >
                <XCircle size={18} /> Confirm Rejection <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── LOAN CONFIRM MODAL ── */}
      <Modal isOpen={confirmModal.open && confirmModal.item} onClose={() => setConfirmModal({ open: false, item: null })} maxWidth="500px">
        <div className="text-center">
          <div className="success-icon-wrapper">
            <div className="success-icon-bg" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <AlertTriangle size={40} strokeWidth={2.5} style={{ color: '#fff' }} />
            </div>
            <div className="success-pulse" style={{ background: '#f59e0b' }}></div>
          </div>
          <div className="success-text-section">
            <h2 className="success-title" style={{ fontSize: '1.75rem' }}>{t('approvals.confirm_title')}</h2>
            <p className="success-message">{t('approvals.confirm_message')}</p>
            <div className="success-details-box glass-inset">
              <div className="success-detail-row"><span className="label text-muted">{t('approvals.member')}</span><span className="value font-bold">{confirmModal.item?.memberName}</span></div>
              <div className="success-detail-row"><span className="label text-muted">{t('approvals.amount')}</span><span className="value font-bold">{frw(confirmModal.item?.requestedAmount, language)}</span></div>
              <div className="success-detail-row"><span className="label text-muted">{t('members.guarantor')}</span><span className="value font-bold">{confirmModal.item?.guarantorName || '—'}</span></div>
              <div className="success-detail-row"><span className="label text-muted">{t('approvals.applied_date')}</span><span className="value font-bold">{confirmModal.item ? new Date(confirmModal.item.createdAt).toLocaleDateString(getLocale(language)) : ''}</span></div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontStyle: 'italic' }}>{t('approvals.warning')}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setConfirmModal({ open: false, item: null })} style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--item-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <XCircle size={18} /> {t('common.cancel')}
            </button>
            <button onClick={() => executeAction(confirmModal.item, 'approve')} className="success-action-btn" style={{ flex: 2 }}>
              {t('approvals.confirm_title')} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </Modal>

      {/* ── EXIT CONFIRM MODAL ── */}
      <Modal isOpen={exitConfirmModal.open && exitConfirmModal.item} onClose={() => { setExitConfirmModal({ open: false, item: null, action: null }); setRejectReason('') }} maxWidth="500px">
        {exitConfirmModal.item && (
          <div className="text-center">
            <div className="success-icon-wrapper">
              <div className="success-icon-bg" style={{ background: exitConfirmModal.action === 'approve' || exitConfirmModal.action === 'payout' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                {exitConfirmModal.action === 'approve' || exitConfirmModal.action === 'payout' ? <CheckCircle size={40} strokeWidth={2.5} style={{ color: '#fff' }} /> : <XCircle size={40} strokeWidth={2.5} style={{ color: '#fff' }} />}
              </div>
              <div className="success-pulse" style={{ background: exitConfirmModal.action === 'approve' || exitConfirmModal.action === 'payout' ? '#22c55e' : '#ef4444' }}></div>
            </div>
            <div className="success-text-section">
              <h2 className="success-title" style={{ fontSize: '1.6rem' }}>
                {exitConfirmModal.action === 'approve' ? t('exit.confirm_approve_title') : exitConfirmModal.action === 'payout' ? t('exit.confirm_payout') : t('exit.confirm_reject_title')}
              </h2>
              <p className="success-message">
                {exitConfirmModal.action === 'approve' ? t('exit.confirm_approve_msg') : exitConfirmModal.action === 'payout' ? t('exit.payout_recorded_message') : t('exit.confirm_reject_msg')}
              </p>
              <div className="success-details-box glass-inset">
                <div className="success-detail-row"><span className="label text-muted">{t('exit.member_label')}</span><span className="value font-bold">{exitConfirmModal.item.memberName}</span></div>
                <div className="success-detail-row"><span className="label text-muted">{t('exit.net_payout')}</span><span className="value font-bold" style={{ color: '#22c55e' }}>{frw(exitConfirmModal.item.netSettlementAmount, language)}</span></div>
                <div className="success-detail-row"><span className="label text-muted">{t('exit.exit_type_label')}</span><span className="value font-bold">{exitConfirmModal.item.exitType === 'VOLUNTARY' ? t('exit.voluntary') : t('exit.expelled')}</span></div>
              </div>
              {exitConfirmModal.action === 'reject' && (
                <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('exit.rejection_reason')}</label>
                  <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={t('exit.rejection_reason_placeholder')} style={{ width: '100%', borderRadius: '10px', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              )}
              {exitConfirmModal.action === 'payout' && (
                <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('exit.payout_reference')}</label>
                  <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={t('exit.payout_reference_placeholder')} style={{ width: '100%', borderRadius: '10px', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => { setExitConfirmModal({ open: false, item: null, action: null }); setRejectReason('') }} style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--item-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <XCircle size={18} /> {t('common.cancel')}
              </button>
              <button onClick={executeExitAction} style={{ flex: 2, padding: '1rem', borderRadius: '12px', border: 'none', background: exitConfirmModal.action === 'approve' || exitConfirmModal.action === 'payout' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: `0 4px 16px ${exitConfirmModal.action === 'approve' || exitConfirmModal.action === 'payout' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                {exitConfirmModal.action === 'approve' || exitConfirmModal.action === 'payout' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                {exitConfirmModal.action === 'approve' ? t('exit.approve_exit') : exitConfirmModal.action === 'payout' ? t('exit.record_payout') : t('exit.reject_exit')}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Result Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        type={feedbackData?.type || 'success'}
        title={feedbackData?.title}
        message={feedbackData?.message}
        details={feedbackData?.details}
        actionLabel={feedbackData?.actionLabel || t('approvals.back_to_queue')}
      />
    </div>
  )
}
