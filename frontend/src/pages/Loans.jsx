import { useState, useEffect } from 'react'
import { Landmark, Info, Hash, FileText, Send, CheckCircle2, AlertCircle, Clock, ArrowRight, AlertTriangle, User, Users, Search, PiggyBank, History, X, Calendar, ClipboardList, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft as ChevronLeftIcon, ChevronRight, PieChart, Heart, TrendingUp, ReceiptText, ShieldCheck, Box, Activity, Upload, Eye, Download, Edit3 } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal';
import ModernFileUpload from '../components/ModernFileUpload';
import FeedbackModal from '../components/FeedbackModal';
import AmendmentRequestModal from '../components/AmendmentRequestModal';
import { useLanguage } from '../context/LanguageContext';
import { frw, getLocale } from '../utils/i18nHelper';
import useDebounce from '../hooks/useDebounce';

export default function Loans() {
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [eligibility, setEligibility] = useState(0)
  const [loans, setLoans] = useState([])
  const [applications, setApplications] = useState([])
  const [members, setMembers] = useState([])
  const [unpaidPenalties, setUnpaidPenalties] = useState([])
  const [isApplying, setIsApplying] = useState(false)
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    purpose: 'Personal',
    productId: 1,
    loanNumber: '',
    issuedDate: new Date().toISOString().split('T')[0]
  })
  const [error, setError] = useState('')
  const [filterText, setFilterText] = useState('')
  const debouncedFilter = useDebounce(filterText)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  
  // Custom Modals
  const [disburseModal, setDisburseModal] = useState({ open: false, item: null, contractFile: null })
  const [contractUploadModal, setContractUploadModal] = useState({ open: false, loan: null, contractFile: null })
  const [repaymentModal, setRepaymentModal] = useState({ open: false, item: null, amount: '', reference: '', paymentDate: '' })
  const [historyModal, setHistoryModal] = useState({ open: false, item: null, payments: [], schedule: [], historyTab: 'history' })
  const [isSubmittingRepayment, setIsSubmittingRepayment] = useState(false)
  const [repaymentAmendmentModal, setRepaymentAmendmentModal] = useState({ open: false, record: null, loanNumber: '' })
  
  // Confirmation State
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, type: 'info' })

  // Data Table State: History
  const [historySort, setHistorySort] = useState({ key: 'disbursementDate', direction: 'desc' })
  const [historyPage, setHistoryPage] = useState(1)
  const [rowsPerPageHistory, setRowsPerPageHistory] = useState(8)

  // Data Table State: Applications
  const [appSort, setAppSort] = useState({ key: 'createdAt', direction: 'desc' })
  const [appPage, setAppPage] = useState(1)
  const [rowsPerPageApp, setRowsPerPageApp] = useState(8)

  const user = JSON.parse(localStorage.getItem('user'))
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const isPresident = user?.role === 'ROLE_PRESIDENT'
  const isFinance = user?.role === 'ROLE_FINANCE'
  const [dashboardStats, setDashboardStats] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const memberIdParam = (!isAdmin && !isPresident) ? `?memberId=${user.id}` : ''

      const [loansRes, appsRes, statsRes] = await Promise.all([
        api.get(`/api/v1/loans/history${memberIdParam}`),
        api.get(`/api/v1/loans/applications${memberIdParam}`),
        api.get('/api/v1/dashboard/stats')
      ])

      setLoans(loansRes.data || [])
      setApplications(appsRes.data || [])
      setDashboardStats(statsRes.data)

      if (isAdmin) {
        const membersRes = await api.get('/api/v1/members')
        setMembers(membersRes.data || [])
      } else {
        const eligRes = await api.get(`/api/v1/loans/eligibility?memberId=${user.id}`)
        const penRes = await api.get(`/api/v1/penalties/my?memberId=${user.id}`)
        setEligibility(eligRes.data)
        setUnpaidPenalties(penRes.data || [])
      }

    } catch (err) {
      setFeedbackData({
        type: 'error',
        title: t('loans.fetch_error_title'),
        message: err.response?.data?.message || t('loans.fetch_error_msg')
      })
      setShowFeedback(true)
    } finally {
      setLoading(false)
    }
  }

  const isPreRestrictionLoan = formData.issuedDate && formData.issuedDate < '2025-01-01'

  useEffect(() => {
    const memberId = isAdmin ? formData.memberId : user?.id
    if (!memberId) return
    if (isPreRestrictionLoan) {
      setEligibility(Infinity)
      return
    }
    api.get(`/api/v1/loans/eligibility?memberId=${memberId}`)
      .then(res => setEligibility(res.data))
  }, [formData.memberId, formData.issuedDate, isAdmin])

  const handleOpenApplyForm = async () => {
    setIsApplying(true)
    try {
      const res = await api.get('/api/v1/loans/next-loan-number')
      if (res.data?.loanNumber) {
        setFormData(prev => ({ ...prev, loanNumber: res.data.loanNumber }))
      }
    } catch (err) {
      // Suggestion is a convenience only — leave the field blank for manual entry if it fails.
    }
  }

  const handleApply = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const memberId = isAdmin ? formData.memberId : user.id
      const selectedMember = isAdmin ? members.find(m => String(m.id) === String(memberId)) : null

      await api.post(`/api/v1/loans/apply?memberId=${memberId}`, {
        amount: formData.amount,
        purpose: formData.purpose,
        productId: formData.productId,
        issuedDate: formData.issuedDate,
        loanNumber: formData.loanNumber,
        guarantorId: selectedMember?.guarantorId || null
      })
      
      
      const member = isAdmin ? members.find(m => m.id === formData.memberId) : user
      
      setFeedbackData({
        type: 'success',
        title: t('loans.registered_title'),
        message: t('loans.registered_msg'),
        details: [
          { label: t('loans.borrower'), value: isAdmin ? `${member.firstName} ${member.lastName}` : `${user.firstName} ${user.lastName}` },
          { label: t('loans.amount_requested'), value: `${parseFloat(formData.amount).toLocaleString()} FRW` },
          { label: t('loans.status'), value: t('loans.pending').toUpperCase() }
        ]
      })

      setIsApplying(false)
      setFormData({
        memberId: '',
        amount: '',
        purpose: 'Personal',
        productId: 1,
        loanNumber: '',
        issuedDate: new Date().toISOString().split('T')[0]
      })
      fetchData()
      setShowFeedback(true)
    } catch (err) {
      const backendMessage = err.response?.data?.message
      setFeedbackData({
        type: 'error',
        title: t('loans.registration_failed_title'),
        message: backendMessage || t('loans.registration_failed_fallback')
      })
      setShowFeedback(true)
    }
  }

  const handleDisbursement = async () => {
    const { item, contractFile } = disburseModal
    setConfirmModal({
      open: true,
      title: t('loans.confirm_disburse_title'),
      message: t('loans.confirm_disburse_msg').replace('{amount}', item?.requestedAmount?.toLocaleString()).replace('{name}', item?.memberName),
      type: 'success',
      onConfirm: async () => {
        try {
          const formDataToSend = new FormData()
          if (contractFile) formDataToSend.append('contract', contractFile)
          await api.post(`/api/v1/approvals/loans/${item.id}/disburse`, formDataToSend, {})
          setFeedbackData({
            type: 'success',
            title: t('loans.loan_activated_title'),
            message: t('loans.loan_activated_msg'),
            details: []
          })
          setDisburseModal({ open: false, item: null, contractFile: null })
          setConfirmModal({ open: false })
          setShowFeedback(true)
          fetchData()
        } catch(err) {
          console.error(err)
          setFeedbackData({
            type: 'error',
            title: t('loans.disburse_error_title'),
            message: err.response?.data?.message || t('loans.disburse_error_fallback')
          })
          setShowFeedback(true)
        }
      }
    })
  }

  const handleUploadLoanContract = async () => {
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('contract', contractUploadModal.contractFile)
      const res = await api.post(`/api/v1/loans/${contractUploadModal.loan.id}/signed-contract`, formDataToSend, {})
      setLoans(prev => prev.map(l => l.id === res.data.id ? res.data : l))
      setContractUploadModal({ open: false, loan: null, contractFile: null })
    } catch(err) {
      setFeedbackData({
        type: 'error',
        title: t('loans.upload_failed_title'),
        message: err.response?.data?.message || t('loans.upload_failed_msg')
      })
      setShowFeedback(true)
    }
  }

  const handlePreviewLoanContract = async (loanId) => {
    try {
      const res = await api.get(`/api/v1/loans/${loanId}/signed-contract`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      window.open(url, '_blank')
    } catch(err) {
      setFeedbackData({
        type: 'error',
        title: t('loans.preview_failed_title'),
        message: err.response?.data?.message || t('loans.preview_failed_msg')
      })
      setShowFeedback(true)
    }
  }

  const handleDownloadLoanContract = async (loan) => {
    try {
      const res = await api.get(`/api/v1/loans/${loan.id}/signed-contract`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const ext = loan.signedContractPath ? '.' + loan.signedContractPath.split('.').pop() : ''
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `contract-${loan.member?.firstName}-${loan.member?.lastName}-${loan.loanNumber}${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch(err) {
      setFeedbackData({
        type: 'error',
        title: t('loans.download_failed_title'),
        message: err.response?.data?.message || t('loans.download_failed_msg')
      })
      setShowFeedback(true)
    }
  }

  const handleRepayment = async (e) => {
    e.preventDefault()
    
    setConfirmModal({
      open: true,
      title: t('loans.confirm_repayment_title'),
      message: t('loans.confirm_repayment_msg').replace('{amount}', parseFloat(repaymentModal.amount).toLocaleString()),
      type: 'info',
      onConfirm: async () => {
        setIsSubmittingRepayment(true)
        try {
          await api.post(`/api/v1/approvals/repayment/${repaymentModal.item.id}`, {
            amount: repaymentModal.amount,
            transactionReference: repaymentModal.reference,
            paymentDate: repaymentModal.paymentDate
          })
          setFeedbackData({
            type: 'success',
            title: t('loans.repayment_recorded_title'),
            message: `${t('loans.repayment_recorded_msg')} ${parseFloat(repaymentModal.amount).toLocaleString()} FRW.`,
            details: []
          })
          setRepaymentModal({ open: false, item: null, amount: '', reference: '', paymentDate: '' })
          setConfirmModal({ open: false })
          setShowFeedback(true)
          fetchData()
        } catch (err) {
          console.error(err)
          setFeedbackData({
            type: 'error',
            title: t('loans.repayment_failed_title'),
            message: err.response?.data?.message || t('loans.repayment_failed_msg')
          })
          setShowFeedback(true)
        } finally {
          setIsSubmittingRepayment(false)
        }
      }
    })
  }

  const downloadContract = async (loanId) => {
    try {
      const response = await api.get(`/api/v1/loans/${loanId}/contract`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `contract_${loanId}.pdf`)
      document.body.appendChild(link)
      link.click()
    } catch (err) {
      setFeedbackData({
        type: 'error',
        title: t('loans.download_failed_title'),
        message: err.response?.data?.message || t('loans.download_pdf_failed_msg')
      })
      setShowFeedback(true)
    }
  }

  const fetchRepayments = async (loan) => {
    try {
      const [paymentsRes, scheduleRes] = await Promise.all([
        api.get(`/api/v1/loans/${loan.id}/repayments`),
        api.get(`/api/v1/loans/${loan.id}/schedule`)
      ])
      setHistoryModal({ open: true, item: loan, payments: paymentsRes.data || [], schedule: scheduleRes.data || [], historyTab: 'history' })
    } catch (err) {
      setFeedbackData({
        type: 'error',
        title: t('loans.network_error_title'),
        message: t('loans.fetch_history_error_msg')
      })
      setShowFeedback(true)
    }
  }

  // Reusable Sorting Helper
  const sortData = (data, config) => {
    if (!config.key) return data;
    return [...data].sort((a, b) => {
      let aVal, bVal;
      
      // Handle nested or complex keys
      if (config.key === 'borrower') {
        aVal = `${a.member?.firstName} ${a.member?.lastName}`.toLowerCase();
        bVal = `${b.member?.firstName} ${b.member?.lastName}`.toLowerCase();
      } else if (config.key === 'member') {
        aVal = a.memberName?.toLowerCase();
        bVal = b.memberName?.toLowerCase();
      } else {
        aVal = a[config.key];
        bVal = b[config.key];
      }

      if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleLoanAction = (id, action) => {
    const actionTitles = {
      approve: t('loans.authorize'),
      reject: t('loans.decline'),
      cancel: t('loans.cancel_app')
    }

    setConfirmModal({
      open: true,
      title: `${t('loans.confirm_title')} — ${actionTitles[action] || action}`,
      message: t('loans.confirm_loan_action_msg'),
      type: action === 'approve' ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/api/v1/approvals/loans/${id}/${action}`, {})
          fetchData()

          const title = action === 'approve' ? t('loans.loan_authorized_title') : (action === 'reject' ? t('loans.loan_declined_title') : t('loans.app_cancelled_title'))
          setFeedbackData({
            type: 'success',
            title,
            message: t('loans.loan_action_success_msg'),
            actionLabel: t('loans.close')
          })
          setConfirmModal({ open: false })
          setShowFeedback(true)
        } catch (err) {
          setError(err.response?.data?.message || `Failed to ${action} loan application.`)
        }
      }
    })
  }

  const filteredHistory = loans.filter(l =>
    !debouncedFilter ||
    l.member?.firstName?.toLowerCase().includes(debouncedFilter.toLowerCase()) ||
    l.member?.lastName?.toLowerCase().includes(debouncedFilter.toLowerCase())
  )

  const exportDisbursementsToCSV = () => {
    const headers = [
      "Disbursement Date",
      "Loan Number",
      "Borrower",
      "Guarantor",
      "Principal Amount (FRW)",
      "Total Interest (FRW)",
      "Remaining Principal (FRW)",
      "Remaining Interest (FRW)",
      "Status"
    ];

    const rows = filteredHistory.map(loan => {
      const disbursementDate = loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB')) : '';
      const loanNumber = loan.loanNumber || loan.id.slice(-6);
      const borrowerName = `${loan.member?.firstName || ''} ${loan.member?.lastName || ''}`.replace(/"/g, '""');
      const guarantorName = (loan.member?.guarantorName || '').replace(/"/g, '""');
      const principal = loan.principalAmount || 0;
      const interest = loan.totalInterestAmount || 0;
      const remPrincipal = loan.remainingPrincipal || 0;
      const remInterest = loan.remainingInterest || 0;
      const status = loan.status || '';

      return [
        `"${disbursementDate}"`,
        `"${loanNumber}"`,
        `"${borrowerName}"`,
        `"${guarantorName}"`,
        principal,
        interest,
        remPrincipal,
        remInterest,
        `"${status}"`
      ].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Disbursements_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Computed Data: History
  const sortedHistory = sortData(filteredHistory, historySort)
  const paginatedHistory = sortedHistory.slice((historyPage - 1) * rowsPerPageHistory, historyPage * rowsPerPageHistory)
  const historyTotalPages = Math.ceil(filteredHistory.length / rowsPerPageHistory)

  // Computed Data: Applications
  const filteredApps = applications.filter(app => app.status !== 'DISBURSED')
  const sortedApps = sortData(filteredApps, appSort)
  const paginatedApps = sortedApps.slice((appPage - 1) * rowsPerPageApp, appPage * rowsPerPageApp)
  const appTotalPages = Math.ceil(filteredApps.length / rowsPerPageApp)

  const getRowOptions = (total) => {
    const base = [10, 20, 30, 40, 50, 100];
    return base.filter((val, idx) => idx === 0 || total > base[idx-1]);
  }

  const handleSort = (table, key) => {
    if (table === 'history') {
      const direction = historySort.key === key && historySort.direction === 'asc' ? 'desc' : 'asc';
      setHistorySort({ key, direction });
      setHistoryPage(1);
    } else {
      const direction = appSort.key === key && appSort.direction === 'asc' ? 'desc' : 'asc';
      setAppSort({ key, direction });
      setAppPage(1);
    }
  }

  const SortIcon = ({ table, columnKey }) => {
    const config = table === 'history' ? historySort : appSort;
    if (config.key !== columnKey) return <ChevronsUpDown size={12} className="sort-icon" />;
    return config.direction === 'asc' ? <ChevronUp size={12} className="sort-icon" /> : <ChevronDown size={12} className="sort-icon" />;
  }

  const activeLoans = loans.filter(l => l.status === 'ACTIVE')

  // Financial Eligibility Check for Filtered Members list
  const qualifiedMembers = members
    .filter(m => {
      if (m.status !== 'ACTIVE' || m.type === 'SOCIAL') return false;
      
      // Must have shares
      const mShares = m.totalShares || 0;
      if (mShares <= 0) return false;

      // Must not have an active loan
      const hasActiveLoan = loans.some(l => l.member?.id === m.id && l.status === 'ACTIVE');
      if (hasActiveLoan) return false;

      return true;
    })
    .sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const calculateLoanProjections = () => {
    const active = loans.filter(l => l.status === 'ACTIVE');
    if (active.length === 0) return { nearest: null, final: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let allPaymentDates = [];
    let completionDates = [];

    active.forEach(loan => {
      const disbursement = new Date(loan.disbursementDate);
      const monthsToPay = Math.ceil((loan.principalAmount || 0) / 50000);
      
      for (let i = 1; i <= monthsToPay; i++) {
        const paymentDate = new Date(disbursement);
        paymentDate.setMonth(paymentDate.getMonth() + i);
        allPaymentDates.push(paymentDate);
        if (i === monthsToPay) completionDates.push(paymentDate);
      }
    });

    const futurePayments = allPaymentDates
      .filter(d => d >= today)
      .sort((a, b) => a - b);

    const nearest = futurePayments.length > 0 ? futurePayments[0] : null;
    const final = completionDates.length > 0 ? new Date(Math.max(...completionDates)) : null;

    return { nearest, final };
  };

  const { nearest: nearestPayment, final: finalPayment } = calculateLoanProjections();

  const loansThisYear = loans.filter(l => {
    if (!l.disbursementDate) return false;
    const date = new Date(l.disbursementDate);
    return date.getFullYear() === new Date().getFullYear();
  }).length;

  const totalAmountLoanedThisYear = loans.filter(l => {
    if (!l.disbursementDate) return false;
    const date = new Date(l.disbursementDate);
    return date.getFullYear() === new Date().getFullYear();
  }).reduce((acc, l) => acc + (l.principalAmount || 0), 0);

  const paidLoansCount = loans.filter(l => l.status === 'PAID').length;

  const StatCard = ({ title, value, unit, icon, loading, detail, hoverDetails, children }) => (
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
      {(detail || hoverDetails || children) && (
        <div className="mt-4 flex flex-col gap-2">
           {detail && (
             <div className="flex items-center gap-2">
                <div style={{ color: '#b45309' }}>
                  <Activity size={14} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', letterSpacing: '-0.01em' }}>{detail}</span>
             </div>
           )}
           {hoverDetails && (
             <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-1 group-hover:translate-y-0 space-y-2">
                {hoverDetails}
             </div>
           )}
           {children}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted animate-pulse">Synchronizing Loan Ledger...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in pb-10">
      <header className="page-header">
        <div className="header-info">
          <h1>{(isAdmin || isPresident) ? t('loans.portfolio_title') : t('nav.loans')}</h1>
          <p className="text-muted">
            {(isAdmin || isPresident) ? t('loans.portfolio_sub') : t('loans.track_limit')}
          </p>
        </div>
        {isAdmin && !isApplying && (
          <button className="btn-primary" onClick={handleOpenApplyForm}>
            <Landmark size={20} />
            <span>{t('loans.new_request')}</span>
          </button>
        )}
      </header>

      {isApplying && isAdmin ? (
        <div className="glass-card max-w-2xl mx-auto stagger-1 relative overflow-hidden">
          <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.05, pointerEvents: 'none' }}>
             <Landmark size={150} />
          </div>
          <div className="card-header pb-4 border-b border-white/10 mb-8 flex justify-between items-center">
            <h3 className="text-2xl font-bold">{t('loans.wizard_title')}</h3>
            <button className="wizard-btn wizard-btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => setIsApplying(false)}>
              <X size={18} /> <span>{t('loans.cancel')}</span>
            </button>
          </div>
          
          <form onSubmit={handleApply} className="wizard-body p-0 space-y-8">
            <div className="pill-group">
               <label className="filter-label mb-3 block">1. {t('loans.select_borrower')}</label>
               <div className="pill-input-wrapper">
                  <div className="pill-input-icon"><User size={18} className="text-muted" /></div>
                  <select 
                    className="pill-input"
                    value={formData.memberId}
                    onChange={(e) => setFormData({...formData, memberId: e.target.value})}
                    required
                  >
                    <option value="" style={{ background: 'var(--card-bg)' }}>{t('loans.qualified_placeholder')}</option>
                    {qualifiedMembers.map(m => (
                      <option key={m.id} value={m.id} style={{ background: 'var(--card-bg)' }}>
                        {m.firstName} {m.lastName} ({m.guarantorName || '—'})
                      </option>
                    ))}
                  </select>
               </div>
            </div>

            {formData.memberId && (
              <div className="filter-badge" style={{ padding: '0.75rem 1rem', width: '100%', borderRadius: '12px' }}>
                <span className="info-icon" style={{ display: 'flex', color: 'var(--accent)' }}><Info size={18} /></span>
                <p>{t('loans.max_capacity')}: <span className="font-bold">
                  {isPreRestrictionLoan ? t('loans.no_limit') || 'No limit (pre-2025)' : `${Number(eligibility).toLocaleString()} FRW`}
                </span></p>
              </div>
            )}

            <div className="pill-group">
              <label className="filter-label mb-3 block">2. {t('loans.specifications')}</label>
              <div className="pill-input-wrapper">
                <div className="pill-input-icon"><span className="text-xs font-bold text-muted">FRW</span></div>
                <input 
                    type="number" required
                    className={`pill-input ${ (formData.amount && (formData.amount > eligibility || formData.amount > dashboardStats?.availableForLoan || formData.amount % 50000 !== 0)) ? 'border-red-500/50' : ''}`}
                    placeholder={t('loans.amount_placeholder')}
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>

              {formData.amount && (
                <div className="mt-3 space-y-2">
                  {formData.amount % 50000 !== 0 && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertCircle size={13} /> {t('loans.multiple_error')}
                    </p>
                  )}
                  {formData.amount > eligibility && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertCircle size={13} /> {t('loans.limit_error')}
                    </p>
                  )}
                  {formData.amount > 0 && formData.amount % 50000 === 0 && formData.amount <= eligibility && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <CheckCircle2 size={13} /> {t('loans.valid_amount')}
                    </p>
                  )}
                </div>
              )}
              
              <div className="pill-input-wrapper mt-4">
                <div className="pill-input-icon"><Calendar size={18} className="text-muted" /></div>
                <input 
                    type="date" required
                    className="pill-input"
                    title={t('loans.issuance_date')}
                    value={formData.issuedDate}
                    onChange={(e) => setFormData({...formData, issuedDate: e.target.value})}
                />
              </div>

              <div className="pill-group mt-6">
                <label className="filter-label mb-3 block">3. {t('loans.identification_ref')}</label>
                <div className="pill-input-wrapper">
                    <div className="pill-input-icon"><Hash size={18} className="text-muted" /></div>
                    <input 
                        type="text" required
                        className="pill-input"
                        placeholder={t('loans.loan_number_placeholder')}
                        value={formData.loanNumber}
                        onChange={(e) => setFormData({...formData, loanNumber: e.target.value})}
                    />
                </div>
                <p className="text-[10px] text-muted italic mt-2 opacity-70">{t('loans.numbering_help')}</p>
              </div>
            </div>

            <div className="pill-group">
              <label className="filter-label mb-3 block">4. {t('loans.purpose_ref')}</label>
              <textarea 
                className="pill-input"
                style={{ height: 'auto', minHeight: '120px', padding: '1rem' }}
                placeholder={t('loans.purpose_placeholder')}
                rows="3"
                value={formData.purpose}
                onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                required
              ></textarea>
            </div>

            {error && (
              <div className="p-4 rounded-xl mb-6 border flex gap-3 text-sm" style={{ 
                background: 'var(--item-bg)', 
                borderColor: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--text-main)'
              }}>
                <AlertCircle size={20} className="text-red-500 shrink-0" />
                <div>
                  <p className="font-bold mb-1">Registration Blocked</p>
                  <p className="opacity-80">{error}</p>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="wizard-btn wizard-btn-primary w-full py-4 text-lg" 
              disabled={!formData.memberId || !formData.amount || formData.amount > eligibility || formData.amount % 50000 !== 0}
            >
              <Send size={18} />
              <span>{t('loans.submit_president')}</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="stagger-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="reveal-up stagger-1">
              <StatCard 
                title={(isAdmin || isPresident) ? t('loans.total_active_out') : t('loans.outstanding_amount')}
                value={frw(loans.filter(l => l.status === 'ACTIVE').reduce((acc, l) => acc + (l.remainingPrincipal || 0), 0), language)}
                unit="FRW"
                icon={<Landmark size={18} />}
                loading={loading}
                detail={`${t('loans.total_loaned_year')}: ${frw(totalAmountLoanedThisYear, language)}`}
                hoverDetails={
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                       <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-main" />
                          <span className="text-[10px] text-muted uppercase font-bold tracking-tight">{t('loans.expected_interest')}:</span>
                       </div>
                       <span className="text-[10px] font-bold text-main">
                          {frw(loans.filter(l => l.status === 'ACTIVE').reduce((acc, l) => acc + (l.remainingInterest || 0), 0), language)}
                       </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-main" />
                        <span className="text-[10px] text-muted uppercase font-bold tracking-tight">{t('loans.next_payment')}:</span>
                      </div>
                      <span className="text-[10px] font-bold text-main">
                        {nearestPayment ? nearestPayment.toLocaleDateString(getLocale(language)) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-main" />
                        <span className="text-[10px] text-muted uppercase font-bold tracking-tight">{t('loans.projected_completion')}:</span>
                      </div>
                      <span className="text-[10px] font-bold text-main">
                        {finalPayment ? finalPayment.toLocaleDateString(getLocale(language)) : 'N/A'}
                      </span>
                    </div>
                  </div>
                }
              />
            </div>

            <div className="reveal-up stagger-2">
              <StatCard 
                title={t('loans.total_active')}
                value={loans.filter(l => l.status === 'ACTIVE').length}
                unit={t('loans.loans_count')}
                icon={<Users size={18} />}
                loading={loading}
                detail={`${t('loans.total_made_year')}: ${loansThisYear}`}
                hoverDetails={
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-main" /> 
                        <span className="text-[10px] text-muted uppercase font-bold tracking-tight">{t('loans.approvals')}:</span>
                      </div>
                      <span className="text-[10px] font-bold text-main">{applications.filter(a => a.status === 'PENDING').length}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <History size={14} className="text-main" /> 
                        <span className="text-[10px] text-muted uppercase font-bold tracking-tight">{t('loans.disbursement')}:</span>
                      </div>
                      <span className="text-[10px] font-bold text-main">{applications.filter(a => a.status === 'APPROVED').length}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-main" /> 
                        <span className="text-[10px] text-muted uppercase font-bold tracking-tight">{t('loans.paid_loans')}:</span>
                      </div>
                      <span className="text-[10px] font-bold text-main">{paidLoansCount}</span>
                    </div>
                  </div>
                }
              />
            </div>

            <div className="reveal-up stagger-3">
              <div className="stat-card group hover:scale-[1.02] transition-all flex flex-col justify-between h-full bg-[#fefce8] border-[#fef08a] text-[#854d0e] dark:bg-yellow-500/10 dark:border-yellow-500/20 dark:text-yellow-500">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="stat-title opacity-80" style={{ color: 'inherit' }}>{t('dashboard.available_liquidity').toUpperCase()}</p>
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-yellow-500/10 text-inherit transition-all shadow-sm border border-black/5 dark:border-yellow-500/20">
                      <PiggyBank size={18} />
                    </div>
                  </div>
                  <div className="stat-value-group">
                    <span className="stat-value tracking-tighter" style={{ fontSize: '1.75rem', fontWeight: 900, color: 'inherit' }}>
                      {frw(dashboardStats?.availableForLoan || 0, language)}
                    </span>
                    <span className="stat-unit opacity-70" style={{ color: 'inherit' }}>FRW</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 border-t border-black/5 dark:border-white/5 pt-3">
                  <div className="flex justify-between items-center text-[10px] opacity-80">
                    <div className="flex items-center gap-2">
                       <PieChart size={12} className="text-main" />
                       <span className="uppercase font-bold tracking-tight text-muted">{t('dashboard.shares_pool')}</span>
                    </div>
                    <span className="font-bold text-main">{frw(dashboardStats?.sharesPool || 0, language)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] opacity-80">
                    <div className="flex items-center gap-2">
                       <Heart size={12} className="text-main" />
                       <span className="uppercase font-bold tracking-tight text-muted">{t('dashboard.social_fund_credit')}</span>
                    </div>
                    <span className="font-bold text-main">+{frw(dashboardStats?.socialFundCredit || 0, language)}</span>
                  </div>
                  <div className="opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto overflow-hidden transition-all duration-500 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] opacity-80">
                      <div className="flex items-center gap-2">
                         <TrendingUp size={12} className="text-main" />
                         <span className="uppercase font-bold tracking-tight text-muted">{t('dashboard.interest_pool')}</span>
                      </div>
                      <span className="font-bold text-main">+{dashboardStats?.interestPool?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] opacity-80">
                      <div className="flex items-center gap-2">
                         <ReceiptText size={12} className="text-main" />
                         <span className="uppercase font-bold tracking-tight text-muted">{t('dashboard.bank_fees')}</span>
                      </div>
                      <span className="font-bold text-main">+{dashboardStats?.bankFeesBalance?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] opacity-80">
                      <div className="flex items-center gap-2">
                         <ShieldCheck size={12} className="text-main" />
                         <span className="uppercase font-bold tracking-tight text-muted">{t('dashboard.obligatory_reserve_pool')}</span>
                      </div>
                      <span className="font-bold text-main">+{dashboardStats?.obligatoryReservePool?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="glass-card p-0 overflow-hidden">
                 <div className="p-6 border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                         <History size={20} className="text-accent"/>
                         <h2 className="text-xl">{t('loans.association_history')}</h2>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="search-box" style={{ maxWidth: '300px', marginBottom: 0, width: '100%' }}>
                             <Search size={18} />
                             <input 
                                 type="text" placeholder={t('loans.search_member')} 
                                 value={filterText} onChange={e => setFilterText(e.target.value)}
                             />
                        </div>
                        {(isAdmin || isFinance) && (
                            <button 
                                onClick={exportDisbursementsToCSV} 
                                className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
                                style={{ height: '42px', minHeight: '42px', whiteSpace: 'nowrap' }}
                            >
                                <Download size={16} />
                                <span>Export CSV</span>
                            </button>
                        )}
                    </div>
                 </div>
                <div className="table-container">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th className="sortable text-left" onClick={() => handleSort('history', 'member')}>
                                    {t('loans.member')} <SortIcon table="history" columnKey="member" />
                                </th>
                                <th className="sortable text-left" onClick={() => handleSort('history', 'disbursementDate')}>
                                    {t('loans.loan_details')} <SortIcon table="history" columnKey="disbursementDate" />
                                </th>
                                 <th className="sortable text-right" onClick={() => handleSort('history', 'principal')}>
                                    {t('loans.loan_amount')} <SortIcon table="history" columnKey="principal" />
                                </th>
                                <th className="sortable text-right" onClick={() => handleSort('history', 'remainingPrincipal')}>
                                    {t('loans.balance')} <SortIcon table="history" columnKey="remainingPrincipal" />
                                </th>
                                <th className="sortable text-center" onClick={() => handleSort('history', 'nextPaymentDate')}>
                                    {t('dashboard.repayment_schedule')} <SortIcon table="history" columnKey="nextPaymentDate" />
                                </th>
                                <th className="sortable text-center" onClick={() => handleSort('history', 'status')}>
                                    {t('loans.status')} <SortIcon table="history" columnKey="status" />
                                </th>
                                <th className="text-right">{t('loans.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedHistory.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-10 text-muted">{t('loans.no_history_found')}</td></tr>
                            ) : paginatedHistory.map((loan, index) => (
                                <tr key={loan.id}>
                                    <td className="text-muted font-mono" style={{ fontSize: '0.75rem' }}>{(historyPage - 1) * rowsPerPageHistory + index + 1}</td>
                                    <td>
                                        <div>
                                            <p className="font-bold">{loan.member?.firstName} {loan.member?.lastName}</p>
                                            {loan.member?.guarantorName && (
                                              <p style={{ fontSize: '11.5px', fontStyle: 'italic', opacity: 0.6, marginTop: '4px', color: 'var(--text-main)' }}>
                                                {loan.member.guarantorName}
                                              </p>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-xs space-y-1">
                                            <p><span className="text-muted">{t('loans.loan_number')}:</span> <span className="font-bold text-accent">{loan.loanNumber || loan.id.slice(-6)}</span></p>
                                            <p><span className="text-muted">{t('loans.issued')}:</span> {new Date(loan.disbursementDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}</p>
                                        </div>
                                    </td>
                                    <td className="text-right font-bold text-sm">
                                        <div className="flex flex-col items-end gap-1">
                                            <p>{loan.principalAmount?.toLocaleString()} <span className="text-[10px] text-muted font-normal">FRW</span></p>
                                            <span className="remaining-highlight" style={{ fontSize: '10px' }}>
                                                {t('loans.int_short')}: {loan.totalInterestAmount?.toLocaleString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <p className="font-bold text-sm">{loan.remainingPrincipal?.toLocaleString()} <span className="text-[10px] text-muted font-normal">FRW</span></p>
                                            {loan.remainingInterest > 0 && (
                                                <span className="remaining-highlight" style={{ fontSize: '10px' }}>
                                                    {t('loans.int_short')}: {loan.remainingInterest?.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="flex flex-col items-center">
                                            {loan.status === 'ACTIVE' && loan.nextPaymentDate ? (
                                              <span className="text-xs font-bold text-accent">
                                                {new Date(loan.nextPaymentDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'), { month: 'short', day: 'numeric', year: 'numeric' })}
                                              </span>
                                            ) : (
                                              <span className="text-muted text-xs">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <span className={`badge ${loan.status === 'ACTIVE' ? 'active' : 'info'}`}>
                                            {loan.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex justify-end gap-2 whitespace-nowrap">
                                            {loan.status === 'ACTIVE' && (isAdmin || user?.role === 'ROLE_PRESIDENT' || user?.role === 'ROLE_FINANCE') && (
                                              <button 
                                                className="btn-icon-action" 
                                                style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }} 
                                                title={t('loans.record_repayment')} 
                                                onClick={() => {
                                                  const remainingTotal = (loan.remainingPrincipal || 0) + (loan.remainingInterest || 0);
                                                  const defaultAmount = Math.min(55000, remainingTotal);
                                                  setRepaymentModal({ open: true, item: loan, amount: String(defaultAmount), reference: '' });
                                                }}
                                              >
                                                  <PiggyBank size={16} />
                                              </button>
                                            )}
                                            <button 
                                              className="btn-icon-action" 
                                              style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }} 
                                              title={t('loans.payment_history')} 
                                              onClick={() => fetchRepayments(loan)}
                                            >
                                                <ClipboardList size={16} />
                                            </button>
                                            <button className="btn-icon-action" style={{ color: 'var(--accent)', background: 'var(--accent-glow)' }} title="System Contract PDF" onClick={() => downloadContract(loan.id)}>
                                                <FileText size={16} />
                                            </button>
                                            {(isAdmin || isPresident) && !loan.signedContractPath && (
                                              <button
                                                className="btn-icon-action"
                                                style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}
                                                title="Upload Signed Contract"
                                                onClick={() => setContractUploadModal({ open: true, loan, contractFile: null })}
                                              >
                                                <Upload size={16} />
                                              </button>
                                            )}
                                            {loan.signedContractPath && (
                                              <>
                                                <button
                                                  className="btn-icon-action"
                                                  style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.1)' }}
                                                  title="Preview Signed Contract"
                                                  onClick={() => handlePreviewLoanContract(loan.id)}
                                                >
                                                  <Eye size={16} />
                                                </button>
                                                <button
                                                  className="btn-icon-action"
                                                  style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}
                                                  title="Download Signed Contract"
                                                  onClick={() => handleDownloadLoanContract(loan)}
                                                >
                                                  <Download size={16} />
                                                </button>
                                                {(isAdmin || isPresident) && (
                                                  <button
                                                    className="btn-icon-action"
                                                    style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}
                                                    title="Replace Signed Contract"
                                                    onClick={() => setContractUploadModal({ open: true, loan, contractFile: null })}
                                                  >
                                                    <Upload size={16} />
                                                  </button>
                                                )}
                                              </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {historyTotalPages > 0 && (
                    <div className="pagination-controls">
                        <div className="pagination-info">
                            <span>{t('loans.page')} {historyPage} {t('loans.of')} {historyTotalPages}</span>
                            <div className="rows-selector-container">
                                <span>{t('loans.show')}:</span>
                                <select 
                                    className="rows-select" 
                                    value={rowsPerPageHistory} 
                                    onChange={(e) => { setRowsPerPageHistory(Number(e.target.value)); setHistoryPage(1); }}
                                >
                                    {getRowOptions(filteredHistory.length).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="pagination-btns">
                            <button className="page-btn" disabled={historyPage === 1} onClick={() => setHistoryPage(1)}>
                                <ChevronLeftIcon size={14} style={{ transform: 'translateX(-1px)' }} />
                            </button>
                            <button className="page-btn" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>
                                <ChevronLeftIcon size={14} />
                            </button>
                            {[...Array(historyTotalPages)].map((_, i) => (
                                <button 
                                    key={i} 
                                    className={`page-btn ${historyPage === i+1 ? 'active' : ''}`}
                                    onClick={() => setHistoryPage(i+1)}
                                >
                                    {i+1}
                                </button>
                            ))}
                            <button className="page-btn" disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage(p => p + 1)}>
                                <ChevronRight size={14} />
                            </button>
                            <button className="page-btn" disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage(historyTotalPages)}>
                                <ChevronRight size={14} style={{ transform: 'translateX(1px)' }} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="glass-card p-0 overflow-hidden">
                <div className="p-6 border-b border-white/10 flex flex-col items-center justify-center gap-4">
                   <div className="flex items-center gap-2">
                        <Clock size={20} className="text-accent"/>
                        <h2 className="text-xl">{t('loans.registration_status_queue') || 'Registration Status Queue'}</h2>
                   </div>
                </div>
                <div className="table-container">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th className="sortable text-left" onClick={() => handleSort('app', 'createdAt')}>
                                    {t('loans.date')} <SortIcon table="app" columnKey="createdAt" />
                                </th>
                                <th className="sortable text-left" onClick={() => handleSort('app', 'member')}>
                                    {t('loans.member')} <SortIcon table="app" columnKey="member" />
                                </th>
                                <th className="sortable text-left" onClick={() => handleSort('app', 'requestedAmount')}>
                                    {t('loans.total_amount')} <SortIcon table="app" columnKey="requestedAmount" />
                                </th>
                                <th className="sortable text-center" onClick={() => handleSort('app', 'status')}>
                                    {t('loans.approval_flow')} <SortIcon table="app" columnKey="status" />
                                </th>
                                <th className="text-left">{t('loans.purpose')}</th>
                                <th className="text-right">{t('loans.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedApps.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-10 text-muted">{t('loans.no_apps_found')}</td></tr>
                            ) : paginatedApps.map((app, index) => (
                                <tr key={app.id}>
                                    <td className="text-muted font-mono" style={{ fontSize: '0.75rem' }}>{(appPage - 1) * rowsPerPageApp + index + 1}</td>
                                    <td>{new Date(app.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <div>
                                            <p className="font-bold">{app.memberName}</p>
                                            {app.guarantorName && (
                                              <p style={{ fontSize: '11.5px', fontStyle: 'italic', opacity: 0.6, marginTop: '4px', color: 'var(--text-main)' }}>
                                                {app.guarantorName}
                                              </p>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-sm tracking-tight">{app.requestedAmount?.toLocaleString()} <span className="text-[10px] text-muted font-normal">FRW</span></span>
                                            <span className="text-[10px] text-accent font-mono">#{app.loanNumber || app.id.slice(-6)}</span>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <span className={`badge ${app.status?.toLowerCase()}`}>
                                            {app.status}
                                        </span>
                                    </td>
                                    <td className="text-sm max-w-xs truncate" title={app.purpose}>{app.purpose}</td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {app.status === 'PENDING' && isPresident && (
                                              <>
                                                <button 
                                                  onClick={() => handleLoanAction(app.id, 'approve')}
                                                  className="btn-icon-action"
                                                  style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}
                                                  title={t('loans.authorize')}
                                                >
                                                  <CheckCircle2 size={16} />
                                                </button>
                                                <button 
                                                  onClick={() => handleLoanAction(app.id, 'reject')}
                                                  className="btn-icon-action"
                                                  style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                                                  title={t('loans.decline')}
                                                >
                                                  <X size={16} />
                                                </button>
                                              </>
                                            )}
                                            {app.status === 'PENDING' && (isAdmin || isPresident) && (
                                              <button 
                                                onClick={() => handleLoanAction(app.id, 'cancel')}
                                                className="btn-icon-action"
                                                style={{ color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)' }}
                                                title={t('loans.cancel_app')}
                                              >
                                                <X size={16} />
                                              </button>
                                            )}
                                            {app.status === 'APPROVED' && (isAdmin || isPresident) && (
                                                <button 
                                                  onClick={() => setDisburseModal({ open: true, item: app })}
                                                  className="btn-icon-action"
                                                  style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}
                                                  title={t('loans.confirm_delivery')}
                                                >
                                                  <CheckCircle2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {appTotalPages > 0 && (
                    <div className="pagination-controls">
                        <div className="pagination-info">
                            <span>Page {appPage} of {appTotalPages}</span>
                            <div className="rows-selector-container">
                                <span>Show:</span>
                                <select 
                                    className="rows-select" 
                                    value={rowsPerPageApp} 
                                    onChange={(e) => { setRowsPerPageApp(Number(e.target.value)); setAppPage(1); }}
                                >
                                    {getRowOptions(filteredApps.length).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="pagination-btns">
                            <button className="page-btn" disabled={appPage === 1} onClick={() => setAppPage(1)}>
                                <ChevronLeftIcon size={14} />
                            </button>
                            <button className="page-btn" disabled={appPage === 1} onClick={() => setAppPage(p => p - 1)}>
                                <ChevronLeftIcon size={14} />
                            </button>
                            {[...Array(appTotalPages)].map((_, i) => (
                                <button 
                                    key={i} 
                                    className={`page-btn ${appPage === i+1 ? 'active' : ''}`}
                                    onClick={() => setAppPage(i+1)}
                                >
                                    {i+1}
                                </button>
                            ))}
                            <button className="page-btn" disabled={appPage === appTotalPages} onClick={() => setAppPage(p => p + 1)}>
                                <ChevronRight size={14} />
                            </button>
                            <button className="page-btn" disabled={appPage === appTotalPages} onClick={() => setAppPage(appTotalPages)}>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Disburse Confirmation Modal */}
      {disburseModal.open && (
      <Modal 
        isOpen={disburseModal.open} 
        onClose={() => setDisburseModal({ open: false, item: null })}
        maxWidth="500px"
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(52, 211, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
               <Landmark size={40} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('loans.fund_transfer_verified')}</h2>
          <p className="text-muted mb-6">{t('loans.disbursement_confirmation')} <span className="font-bold text-white">{disburseModal.item?.memberName}</span>. {t('loans.action_activate_help')}</p>
          
          <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 text-left">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted uppercase tracking-wider">{t('loans.requested_amount')}:</span>
                <span className="font-bold">{disburseModal.item?.requestedAmount?.toLocaleString()} FRW</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-xs text-muted uppercase tracking-wider">{t('loans.available_stock')}:</span>
                <span className={`font-bold ${disburseModal.item?.requestedAmount > (dashboardStats?.availableForLoan || 0) ? 'text-red-400' : 'text-emerald-400'}`}>
                    {(dashboardStats?.availableForLoan || 0).toLocaleString()} FRW
                </span>
            </div>
            {disburseModal.item?.requestedAmount > (dashboardStats?.availableForLoan || 0) && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>Insufficient funds in the association stock to disburse this loan.</span>
                </div>
            )}
          </div>

          <div className="mb-6">
            <p className="text-xs text-muted uppercase tracking-wider mb-3" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={13} /> Signed Contract <span style={{ opacity: 0.5 }}>(optional)</span>
            </p>
            <ModernFileUpload
              onFileSelect={(file) => setDisburseModal(prev => ({ ...prev, contractFile: file }))}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
            />
          </div>

          <div className="flex gap-4">
            <button className="wizard-btn wizard-btn-secondary w-full" onClick={() => setDisburseModal({ open: false, item: null, contractFile: null })}>{t('loans.cancel')}</button>
            <button
                className="wizard-btn wizard-btn-primary w-full"
                onClick={handleDisbursement}
                disabled={disburseModal.item?.requestedAmount > (dashboardStats?.availableForLoan || 0)}
                style={{ background: disburseModal.item?.requestedAmount > (dashboardStats?.availableForLoan || 0) ? '#374151' : '#22c55e' }}
            >
                <CheckCircle2 size={18} /> {t('loans.confirm')}
            </button>
          </div>
        </div>
      </Modal>
      )}

      {/* Repayment Modal */}
      {repaymentModal.open && (
      <Modal 
        isOpen={repaymentModal.open} 
        onClose={() => setRepaymentModal({ open: false, item: null, amount: '', reference: '', paymentDate: '' })}
        maxWidth="600px"
      >
        <div className="text-left">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{t('loans.record_repayment')}</h2>
          </div>
          
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6 flex justify-between items-center">
             <div>
                <p className="text-xs text-muted mb-1">{t('loans.remaining_balance')}</p>
                <p className="font-bold text-lg text-accent text-emerald-400">
                    {frw((repaymentModal.item?.remainingPrincipal || 0) + (repaymentModal.item?.remainingInterest || 0), language)}
                </p>
                <p className="text-[10px] text-muted tracking-wide mt-1" style={{ opacity: 0.8 }}>
                    {t('loans.prin')}: {frw(repaymentModal.item?.remainingPrincipal || 0, language)} <span className="opacity-50 mx-1">|</span> {t('loans.int')}: {frw(repaymentModal.item?.remainingInterest || 0, language)}
                </p>
             </div>
             <div className="text-right">
                <p className="text-xs text-muted mb-1">{t('loans.borrower')}</p>
                <p className="font-bold">{repaymentModal.item?.member?.firstName}</p>
             </div>
          </div>

          <form onSubmit={handleRepayment} className="space-y-4">
            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('loans.repayment_amount')}</label>
              <input 
                type="number" required
                className="pill-input"
                max={repaymentModal.item?.remainingPrincipal + (repaymentModal.item?.remainingInterest || 0)}
                value={repaymentModal.amount}
                onChange={(e) => setRepaymentModal({...repaymentModal, amount: e.target.value})}
                placeholder={t('dashboard.enter_amount')}
              />
            </div>
            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('loans.transaction_details')}</label>
              <input 
                type="text" required
                className="pill-input"
                value={repaymentModal.reference}
                onChange={(e) => setRepaymentModal({...repaymentModal, reference: e.target.value})}
                placeholder="e.g. Bank Transfer ID, MoMo..."
              />
            </div>
            
            <div className="pill-group">
              <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('loans.payment_date_man')}</label>
              <input 
                type="date" required
                className="pill-input"
                value={repaymentModal.paymentDate}
                onChange={(e) => setRepaymentModal({...repaymentModal, paymentDate: e.target.value})}
                max={new Date().toISOString().split('T')[0]}
                min={repaymentModal.item?.disbursementDate}
              />
              <p className="text-[10px] text-muted mt-2 opacity-70 italic">{t('loans.date_help')}</p>
            </div>

            <button type="submit" disabled={isSubmittingRepayment || !repaymentModal.amount} className="wizard-btn wizard-btn-primary w-full mt-6 py-4">
              {isSubmittingRepayment ? t('loans.processing') : <><PiggyBank size={18} /> {t('loans.process_repayment')}</>}
            </button>
          </form>
        </div>
      </Modal>
      )}

      {/* Payment History Modal */}
      {historyModal.open && (
      <Modal
        isOpen={historyModal.open}
        onClose={() => setHistoryModal({ open: false, item: null, payments: [], schedule: [], historyTab: 'history' })}
        maxWidth="960px"
      >
        <div className="text-left">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <ClipboardList size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('loans.payment_history')}</h2>
                <p className="text-xs text-muted">{t('loans.records_for')} {historyModal.item?.member?.firstName} {historyModal.item?.member?.lastName} — #{historyModal.item?.loanNumber}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-lg bg-white/5 w-fit">
            <button
              onClick={() => setHistoryModal(prev => ({ ...prev, historyTab: 'history' }))}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all ${historyModal.historyTab === 'history' ? 'bg-accent text-white' : 'text-muted hover:text-white'}`}
            >
              {t('loans.payment_history')}
            </button>
            <button
              onClick={() => setHistoryModal(prev => ({ ...prev, historyTab: 'schedule' }))}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all ${historyModal.historyTab === 'schedule' ? 'bg-accent text-white' : 'text-muted hover:text-white'}`}
            >
              {t('loans.amortization_schedule')}
            </button>
          </div>

          {historyModal.historyTab === 'history' ? (
            <>
              <div className="table-container max-h-[400px] overflow-auto rounded-xl border border-white/5">
                <table className="custom-table">
                  <thead className="sticky top-0 bg-[#0f172a] z-10">
                    <tr>
                      <th className="text-left py-3">{t('loans.date')}</th>
                      <th className="text-right py-3">{t('loans.total_paid')}</th>
                      <th className="text-right py-3">{t('loans.loan_amount')}</th>
                      <th className="text-right py-3">{t('loans.interest')}</th>
                      <th className="text-right py-3">{t('loans.penalty_deducted')}</th>
                      <th className="text-left py-3">{t('loans.reference')}</th>
                      <th className="text-right py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModal.payments.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-12 text-muted italic">{t('loans.no_payments_recorded')}</td></tr>
                    ) : (
                      historyModal.payments.map(p => {
                        const penaltyDeducted = (p.totalAmount || 0) - (p.principalPaid || 0) - (p.interestPaid || 0);
                        const isAmended = p.amendmentStatus === 'AMENDED';
                        return (
                        <tr key={p.id} className="border-b border-white/5" style={isAmended ? { background: 'rgba(239,68,68,0.06)' } : undefined}>
                          <td className="py-4 text-xs" style={isAmended ? { color: '#ef4444', opacity: 0.8 } : undefined}>{new Date(p.paymentDate).toLocaleDateString(getLocale(language))}</td>
                          <td className="py-4 text-right font-bold text-sm" style={isAmended ? { textDecoration: 'line-through', color: '#ef4444', opacity: 0.8 } : undefined}>{frw(p.totalAmount || 0, language)}</td>
                          <td className="py-4 text-right text-xs" style={isAmended ? { color: '#ef4444', opacity: 0.8, textDecoration: 'line-through' } : { color: '#34d399' }}>{frw(p.principalPaid || 0, language)}</td>
                          <td className="py-4 text-right text-xs" style={isAmended ? { color: '#ef4444', opacity: 0.8, textDecoration: 'line-through' } : { color: '#fbbf24' }}>{frw(p.interestPaid || 0, language)}</td>
                          <td className="py-4 text-right text-xs" style={{ color: isAmended ? '#ef4444' : (penaltyDeducted > 0.01 ? '#ef4444' : 'var(--text-muted)'), opacity: isAmended ? 0.8 : 1 }}>
                            {penaltyDeducted > 0.01 ? frw(penaltyDeducted, language) : '—'}
                          </td>
                          <td className="py-4 text-xs text-muted font-mono" style={isAmended ? { opacity: 0.8 } : undefined}>{p.transactionReference}</td>
                          <td className="py-4 text-right">
                            {(!p.amendmentStatus || p.amendmentStatus === 'ORIGINAL') && (
                              <button
                                onClick={() => setRepaymentAmendmentModal({ open: true, record: p, loanNumber: historyModal.item?.loanNumber || '' })}
                                style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700 }}
                                title="Request Amendment"
                              >
                                <Edit3 size={12} /> Amend
                              </button>
                            )}
                            {p.amendmentStatus && p.amendmentStatus !== 'ORIGINAL' && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: p.amendmentStatus === 'AMENDED' ? 'rgba(239,68,68,0.1)' : p.amendmentStatus === 'CORRECTION' ? 'rgba(34,197,94,0.1)' : 'rgba(96,165,250,0.1)', color: p.amendmentStatus === 'AMENDED' ? '#ef4444' : p.amendmentStatus === 'CORRECTION' ? '#22c55e' : '#60a5fa', border: '1px solid currentColor' }}>
                                {p.amendmentStatus}
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{t('loans.total_repayments')}</p>
                  <p className="text-lg font-bold">
                    {frw(historyModal.payments.filter(p => p.amendmentStatus !== 'AMENDED').reduce((acc, p) => acc + (p.totalAmount || 0), 0), language)}
                  </p>
                </div>
                <button onClick={() => setHistoryModal({ open: false, item: null, payments: [], schedule: [], historyTab: 'history' })} className="wizard-btn wizard-btn-secondary px-8">
                  {t('loans.close')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="table-container max-h-[400px] overflow-auto rounded-xl border border-white/5">
                <table className="custom-table">
                  <thead className="sticky top-0 bg-[#0f172a] z-10">
                    <tr>
                      <th className="text-center py-3">#</th>
                      <th className="text-left py-3">{t('loans.date')}</th>
                      <th className="text-right py-3">{t('loans.loan_amount')}</th>
                      <th className="text-right py-3">{t('loans.interest')}</th>
                      <th className="text-right py-3">{t('loans.total_paid')}</th>
                      <th className="text-center py-3">{t('loans.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModal.schedule.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-12 text-muted italic">{t('loans.no_schedule_found')}</td></tr>
                    ) : (
                      historyModal.schedule.map(entry => (
                        <tr key={entry.installmentNumber} className={`border-b border-white/5 ${entry.status === 'PAID' ? 'opacity-60' : ''}`}>
                          <td className="py-3 text-center text-xs font-mono text-muted">{entry.installmentNumber}</td>
                          <td className="py-3 text-xs">{new Date(entry.dueDate).toLocaleDateString(getLocale(language))}</td>
                          <td className="py-3 text-right text-xs text-emerald-400">{frw(entry.scheduledPrincipal || 0, language)}</td>
                          <td className="py-3 text-right text-xs text-amber-400">{frw(entry.scheduledInterest || 0, language)}</td>
                          <td className="py-3 text-right font-bold text-sm">{frw(entry.scheduledTotal || 0, language)}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              entry.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              entry.status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex gap-8">
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{t('loans.loan_amount')}</p>
                    <p className="text-sm font-bold text-emerald-400">{frw(historyModal.item?.principalAmount || 0, language)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{t('loans.interest')}</p>
                    <p className="text-sm font-bold text-amber-400">{frw(historyModal.item?.totalInterestAmount || 0, language)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{t('loans.remaining_balance')}</p>
                    <p className="text-sm font-bold">{frw((historyModal.item?.remainingPrincipal || 0) + (historyModal.item?.remainingInterest || 0), language)}</p>
                  </div>
                </div>
                <button onClick={() => setHistoryModal({ open: false, item: null, payments: [], schedule: [], historyTab: 'history' })} className="wizard-btn wizard-btn-secondary px-8">
                  {t('loans.close')}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
      )}
      {/* Global Confirmation Modal */}
      {confirmModal.open && (
      <Modal 
        isOpen={confirmModal.open} 
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        maxWidth="450px"
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
             <div className={`p-4 rounded-full ${confirmModal.type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>
                <AlertTriangle size={32} />
             </div>
          </div>
          <h2 className="text-xl font-bold mb-2">{confirmModal.title}</h2>
          <p className="text-muted mb-8">{confirmModal.message}</p>
          <div className="flex gap-4">
            <button 
              className="wizard-btn wizard-btn-secondary w-full"
              onClick={() => setConfirmModal({ ...confirmModal, open: false })}
            >
              {t('loans.no_cancel')}
            </button>
            <button 
              className={`wizard-btn w-full ${confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'wizard-btn-primary'}`}
              onClick={confirmModal.onConfirm}
            >
              {t('loans.yes_proceed')}
            </button>
          </div>
        </div>
      </Modal>
      )}

      {/* Signed Contract Upload Modal */}
      {contractUploadModal.open && (
      <Modal
        isOpen={contractUploadModal.open}
        onClose={() => setContractUploadModal({ open: false, loan: null, contractFile: null })}
        maxWidth="500px"
      >
        <div className="text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{contractUploadModal.loan?.signedContractPath ? 'Replace Signed Contract' : 'Upload Signed Contract'}</h2>
              <p className="text-xs text-muted">
                Loan #{contractUploadModal.loan?.loanNumber} — {contractUploadModal.loan?.member?.firstName} {contractUploadModal.loan?.member?.lastName}
              </p>
            </div>
          </div>

          <ModernFileUpload
            onFileSelect={(file) => setContractUploadModal(prev => ({ ...prev, contractFile: file }))}
            existingFile={contractUploadModal.loan?.signedContractPath ? contractUploadModal.loan.signedContractPath.split('/').pop() : null}
            onPreview={() => handlePreviewLoanContract(contractUploadModal.loan.id)}
            onDownload={() => handleDownloadLoanContract(contractUploadModal.loan)}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
          />

          <div className="flex gap-4 mt-6">
            <button
              className="wizard-btn wizard-btn-secondary w-full"
              onClick={() => setContractUploadModal({ open: false, loan: null, contractFile: null })}
            >
              Cancel
            </button>
            <button
              className="wizard-btn wizard-btn-primary w-full"
              onClick={handleUploadLoanContract}
              disabled={!contractUploadModal.contractFile}
            >
              <Upload size={18} /> Save Contract
            </button>
          </div>
        </div>
      </Modal>
      )}

      {/* Result Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        type={feedbackData?.type || 'success'}
        title={feedbackData?.title}
        message={feedbackData?.message}
        details={feedbackData?.details}
        actionLabel={feedbackData?.actionLabel || 'Back to Ledger'}
      />

      {/* Repayment Amendment Modal */}
      <AmendmentRequestModal
        isOpen={repaymentAmendmentModal.open}
        onClose={() => setRepaymentAmendmentModal({ open: false, record: null, loanNumber: '' })}
        transactionType="LOAN_REPAYMENT"
        transaction={repaymentAmendmentModal.record ? { ...repaymentAmendmentModal.record, amount: repaymentAmendmentModal.record.totalAmount } : null}
        amountField="amount"
        label={repaymentAmendmentModal.record ? `Loan #${repaymentAmendmentModal.loanNumber} — ${new Date(repaymentAmendmentModal.record.paymentDate).toLocaleDateString()} — Ref: ${repaymentAmendmentModal.record.transactionReference || '—'}` : ''}
        onSuccess={() => setRepaymentAmendmentModal({ open: false, record: null, loanNumber: '' })}
      />
    </div>
  )
}
