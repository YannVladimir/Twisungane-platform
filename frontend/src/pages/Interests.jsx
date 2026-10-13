import { useState, useEffect } from 'react'
import { Activity, ShieldCheck, Search, Filter, History, ChevronRight, X, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, Wallet, FileText, AlertTriangle, PiggyBank } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal'
import { useLanguage } from '../context/LanguageContext'
import { frw, getLocale } from '../utils/i18nHelper'
import useDebounce from '../hooks/useDebounce'

export default function Interests() {
  const [interests, setInterests] = useState([])
  const [contributions, setContributions] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [fetchError, setFetchError] = useState(null)
  const [selectedDetails, setSelectedDetails] = useState(null)
  const [detailsPage, setDetailsPage] = useState(1)
  const detailsPerPage = 10
  const { t, language } = useLanguage()
  const debouncedFilter = useDebounce(filterText)
  
  // Distribution Actions
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', action: null })
  const [splitWizard, setSplitWizard] = useState({ open: false, preview: null, loading: false })
  const [actionLoading, setActionLoading] = useState(false)
  const [topupModal, setTopupModal] = useState({ open: false, member: null, loading: false, amount: '', submitting: false })

  // Data Table State
  const [sortConfig, setSortConfig] = useState({ key: 'memberName', direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [myPortfolio, setMyPortfolio] = useState(null)

  const user = JSON.parse(localStorage.getItem('user'))
  const isAdmin = user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_PRESIDENT' || user?.role === 'ROLE_FINANCE'

  useEffect(() => {
    fetchInterests()
  }, [])

  const fetchInterests = async () => {
    try {
      setLoading(true)
      setFetchError(null)
      if (isAdmin) {
        const [intRes, contRes, loanRes] = await Promise.all([
          api.get('/api/v1/interests'),
          api.get('/api/v1/contributions'),
          api.get('/api/v1/loans/all')
        ])
        setInterests(intRes.data)
        setContributions(contRes.data)
        setLoans(loanRes.data)
      } else {
        const [intRes, contRes, loanRes] = await Promise.all([
          api.get('/api/v1/interests/my-portfolio'),
          api.get('/api/v1/contributions'),
          api.get(`/api/v1/loans/history?memberId=${user.memberId || user.id}`)
        ])
        setMyPortfolio(intRes.data)
        setContributions(contRes.data.filter(c => c.memberId === (user.memberId || user.id)))
        setLoans(loanRes.data)
      }
    } catch (err) {
      setFetchError(t('interests.fetch_error'))
    } finally {
      setLoading(false)
    }
  }

  const filteredInterests = interests.filter(i =>
    !debouncedFilter ||
    i.memberName?.toLowerCase().includes(debouncedFilter.toLowerCase()) ||
    i.nationalId?.includes(debouncedFilter)
  )

  const handleDistributeAll = async () => {
    try {
        setSplitWizard({ open: true, loading: true, preview: null })
        const res = await api.get('/api/v1/interests/split-preview')
        setSplitWizard({ open: true, loading: false, preview: res.data })
    } catch(e) {
        console.error(e)
        setSplitWizard({ open: false, loading: false, preview: null })
    }
  }

  const exportSplitToCSV = () => {
    if (!splitWizard.preview?.splits) return;
    
    const headers = ['Member Name', 'National ID', 'Available Interest', 'Paid Reserve (Year)', 'Reserve Need', 'To Reserve', 'To Cash', 'Topup Needed', 'Topup Amount'];
    const rows = splitWizard.preview.splits.map(s => [
        s.memberName,
        s.nationalId,
        s.availableInterest,
        s.reserveAlreadyPaid,
        s.reserveRemainingNeeded,
        s.amountToReserve,
        s.amountToCash,
        s.topupNeeded ? 'YES' : 'NO',
        s.topupAmount
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `interest_split_${splitWizard.preview.year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const executeSplit = async () => {
      try {
          setActionLoading(true)
          await api.post('/api/v1/interests/split-execute', splitWizard.preview.splits)
          setSplitWizard({ open: false, preview: null, loading: false })
          fetchInterests()
      } catch(e) {
          console.error(e)
      } finally {
          setActionLoading(false)
      }
  }

  const handleDistributeMember = (member) => {
    const amount = (member.totalPaidInterest || 0) - (member.totalCashedOutInterest || 0)
    setConfirmModal({
        open: true,
        title: t('interests.cash_out_btn'),
        message: `${t('common.confirm_action')} ${frw(amount, language)} ${t('common.to')} ${member.memberName}?`,
        action: async () => {
             try {
                setActionLoading(true)
                await api.post(`/api/v1/interests/distribute/${member.memberId}`, {})
                setConfirmModal({ open: false })
                fetchInterests()
            } catch(e) {
                console.error(e)
            } finally {
                setActionLoading(false)
            }
        }
    })
  }

  const openTopupModal = (member) => {
    setTopupModal({ open: true, member, loading: false, amount: '', submitting: false })
  }

  const handleRecordTopup = async () => {
    if (!topupModal.member || !topupModal.amount) return
    try {
      setTopupModal(prev => ({ ...prev, submitting: true }))
      await api.post(`/api/v1/interests/topup/${topupModal.member.memberId}`, {
        amount: topupModal.amount
      })
      setTopupModal({ open: false, member: null, loading: false, amount: '', submitting: false })
      fetchInterests()
    } catch (e) {
      console.error(e)
      setTopupModal(prev => ({ ...prev, submitting: false }))
    }
  }

  // Data Table Logic
  const sortData = (data, config) => {
    if (!config.key) return data;
    return [...data].sort((a, b) => {
      let aVal, bVal;
      
      switch(config.key) {
        case 'memberName':
          aVal = a.memberName?.toLowerCase() || '';
          bVal = b.memberName?.toLowerCase() || '';
          break;
        case 'totalExpectedInterest':
          aVal = a.totalExpectedInterest || 0;
          bVal = b.totalExpectedInterest || 0;
          break;
        case 'totalPaidInterest':
          aVal = a.totalPaidInterest || 0;
          bVal = b.totalPaidInterest || 0;
          break;
        case 'totalUnpaidInterest':
          aVal = a.totalUnpaidInterest || 0;
          bVal = b.totalUnpaidInterest || 0;
          break;
        default:
          aVal = a[config.key];
          bVal = b[config.key];
      }

      if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const sortedData = sortData(filteredInterests, sortConfig)
  const paginatedData = sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const totalPages = Math.ceil(filteredInterests.length / rowsPerPage)

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  }

  const getRowOptions = (total) => {
    const base = [10, 20, 30, 40, 50, 100];
    return base.filter((val, idx) => idx === 0 || total > base[idx-1]);
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown size={12} className="sort-icon text-muted" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="sort-icon text-accent" /> : <ChevronDown size={12} className="sort-icon text-accent" />;
  }

  const totalExpected = interests.reduce((acc, i) => acc + (i.totalExpectedInterest || 0), 0)
  const totalPaid = interests.reduce((acc, i) => acc + (i.totalPaidInterest || 0), 0)
  const totalCashedOut = interests.reduce((acc, i) => acc + (i.totalCashedOutInterest || 0), 0)
  const totalPenalties = contributions.filter(c => c.type === 'PENALTY').reduce((acc, c) => acc + (c.amount || 0), 0)

  const calculateLoanProjections = () => {
    const active = loans.filter(l => l.status === 'ACTIVE');
    if (active.length === 0) return { final: null, activeCount: 0 };

    let completionDates = [];

    active.forEach(loan => {
      const disbursement = new Date(loan.disbursementDate);
      const monthsToPay = Math.ceil((loan.principalAmount || 0) / 50000);
      
      for (let i = 1; i <= monthsToPay; i++) {
        const paymentDate = new Date(disbursement);
        paymentDate.setMonth(paymentDate.getMonth() + i);
        if (i === monthsToPay) completionDates.push(paymentDate);
      }
    });

    const final = completionDates.length > 0 ? new Date(Math.max(...completionDates)) : null;

    return { final, activeCount: active.length };
  };

  const { final: finalPayment, activeCount } = calculateLoanProjections();

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
           <div style={{ color: '#b45309' }}>
             <Activity size={14} strokeWidth={2.5} />
           </div>
           <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', letterSpacing: '-0.01em' }}>{detail}</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="animate-in pb-10">
      <header className="page-header">
        <div className="header-info">
          <h1>{isAdmin ? t('interests.title_admin') : t('interests.title_member')}</h1>
          <p className="text-muted">
            {isAdmin 
              ? t('interests.sub_admin')
              : t('interests.sub_member')}
          </p>
        </div>
      </header>

      {fetchError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <AlertTriangle size={16} />
          <span>{fetchError}</span>
          <button onClick={() => setFetchError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="reveal-up stagger-1">
          <StatCard 
            title={isAdmin ? t('interests.gross_expected') : t('interests.my_expected')}
            value={isAdmin ? frw(totalExpected, language) : frw(myPortfolio?.totalExpectedInterest || 0, language)}
            unit="FRW"
            icon={<Activity size={18} />}
            loading={loading}
            detail={isAdmin ? `${t('interests.cashed_out')}: ${frw(totalCashedOut, language)}` : `${t('interests.cashed_out')}: ${frw(myPortfolio?.totalCashedOutInterest || 0, language)}`}
          />
        </div>
        <div className="reveal-up stagger-2">
          <StatCard 
            title={isAdmin ? t('interests.distributed') : t('interests.credited')}
            value={isAdmin ? frw(totalPaid, language) : frw(myPortfolio?.totalPaidInterest || 0, language)}
            unit="FRW"
            icon={<ShieldCheck size={18} />}
            loading={loading}
            detail={isAdmin ? `${t('reports.penalty_summary')}: ${frw(totalPenalties, language)}` : t('interests.credited_detail')}
          />
        </div>
        <div className="reveal-up stagger-3">
          <StatCard 
            title={isAdmin ? t('interests.pending_liquidity') : t('interests.pending_distribution')}
            value={isAdmin ? frw(totalExpected - totalPaid, language) : frw(myPortfolio?.totalUnpaidInterest || 0, language)}
            unit="FRW"
            icon={<History size={18} />}
            loading={loading}
            detail={`${t('loans.total_active')}: ${activeCount} | ${t('loans.projected_completion')}: ${finalPayment ? finalPayment.toLocaleDateString(getLocale(language)) : 'N/A'}`}
          />
        </div>
      </div>

      {isAdmin ? (
        <div className="glass-card mt-8 stagger-2 p-0 overflow-hidden relative">
            <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                    <Activity size={20} className="text-accent"/>
                    <h2 className="text-xl">{t('interests.individual_returns')}</h2>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        className="wizard-btn wizard-btn-primary py-2 px-4 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        onClick={handleDistributeAll}
                        style={{ height: '42px' }}
                    >
                        <Wallet size={16} /> {t('interests.distribute_btn')}
                    </button>
                    <div className="search-box" style={{ maxWidth: '300px', marginBottom: 0 }}>
                        <Search size={18} />
                        <input 
                            type="text" placeholder={t('interests.search_placeholder')} 
                            value={filterText} onChange={e => setFilterText(e.target.value)}
                        />
                    </div>
                </div>
            </div>
            <div className="table-container">
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th className="sortable" onClick={() => handleSort('memberName')}>
                                {t('interests.investor')} <SortIcon columnKey="memberName" />
                            </th>
                            <th className="sortable text-right" onClick={() => handleSort('totalExpectedInterest')}>
                                {t('interests.lifetime_expected')} <SortIcon columnKey="totalExpectedInterest" />
                            </th>
                            <th className="sortable text-right" onClick={() => handleSort('totalPaidInterest')}>
                                {t('interests.credited_paid')} <SortIcon columnKey="totalPaidInterest" />
                            </th>
                            <th className="text-right">
                                {t('interests.available_interest')}
                            </th>
                            <th className="text-right">
                                {t('interests.reserve_int')}
                            </th>
                            <th className="text-right">{t('loans.action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                           <tr><td colSpan="6" className="text-center py-10 text-muted">Loading portfolios...</td></tr>
                        ) : paginatedData.length === 0 ? (
                           <tr><td colSpan="6" className="text-center py-10 text-muted">No payout records found.</td></tr>
                        ) : paginatedData.map((inv, index) => (
                            <tr key={inv.memberId}>
                                <td className="text-muted font-mono" style={{ fontSize: '0.75rem' }}>{(currentPage - 1) * rowsPerPage + index + 1}</td>
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="avatar" style={{ 
                                            width: '40px', height: '40px', fontSize: '1rem',
                                            background: inv.isSocialAccount ? 'rgba(168, 85, 247, 0.2)' : undefined, 
                                            color: inv.isSocialAccount ? '#a855f7' : undefined 
                                        }}>
                                            {inv.isSocialAccount ? <ShieldCheck size={18} /> : inv.memberName?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold">{inv.memberName}</p>
                                                {inv.isSocialAccount && <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>{t('common.system').toUpperCase()}</span>}
                                            </div>
                                            <p className="text-xs text-muted">{inv.nationalId}</p>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <p className="font-bold">{frw(inv.totalExpectedInterest || 0, language)}</p>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <p className="font-bold text-green-500">{frw(inv.totalPaidInterest || 0, language)}</p>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <p className="font-bold text-emerald-400">
                                        {frw((inv.totalPaidInterest || 0) - (inv.totalCashedOutInterest || 0), language)}
                                    </p>
                                    <div className="text-[10px] text-muted opacity-70 flex flex-col items-end">
                                        <span>{t('contributions.shares')}: {frw(inv.totalCapitalInterest || 0, language)}</span>
                                        <span>{t('dashboard.obligatory_reserve')}: {frw(inv.totalReserveInterest || 0, language)}</span>
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <p className="font-bold text-amber-500">
                                        {frw(inv.totalReserveInterest || 0, language)}
                                    </p>
                                </td>
                                <td>
                                    <div className="flex justify-end items-center gap-3">
                                        {((inv.totalPaidInterest || 0) - (inv.totalCashedOutInterest || 0)) > 0 && !inv.isSocialAccount && (
                                            <button
                                                className="wizard-btn wizard-btn-secondary px-3 py-1 text-[11px] h-8 font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40"
                                                onClick={() => handleDistributeMember(inv)}
                                            >
                                                <Wallet size={14} /> {t('interests.cash_out_btn')}
                                            </button>
                                        )}
                                        {!inv.isSocialAccount && (
                                            <button
                                                className="wizard-btn wizard-btn-secondary px-3 py-1 text-[11px] h-8 font-medium bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40"
                                                onClick={() => openTopupModal(inv)}
                                            >
                                                <PiggyBank size={14} /> {t('interests.topup_btn')}
                                            </button>
                                        )}
                                        <button 
                                            className="btn-icon-action" 
                                            style={{ color: 'var(--accent)', background: 'var(--accent-glow)' }}
                                            onClick={() => { setSelectedDetails(inv); setDetailsPage(1); }}
                                            title={t('interests.view_details')}
                                        >
                                            <History size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 0 && (
                <div className="pagination-controls">
                    <div className="pagination-info">
                        <span>{t('loans.page')} {currentPage} {t('loans.of')} {totalPages} ({filteredInterests.length} {t('common.total')})</span>
                        <div className="rows-selector-container">
                            <span>{t('loans.show')}:</span>
                            <select 
                                className="rows-select" 
                                value={rowsPerPage} 
                                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            >
                                {getRowOptions(filteredInterests.length).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="pagination-btns">
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                            <ChevronLeft size={14} style={{ transform: 'translateX(-1px)' }} />
                        </button>
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                            <ChevronLeft size={14} />
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button 
                                key={i} 
                                className={`page-btn ${currentPage === i+1 ? 'active' : ''}`}
                                onClick={() => setCurrentPage(i+1)}
                            >
                                {i+1}
                            </button>
                        ))}
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                            <ChevronRight size={14} />
                        </button>
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
                            <ChevronRight size={14} style={{ transform: 'translateX(1px)' }} />
                        </button>
                    </div>
                </div>
            )}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
            <h2 className="section-title flex items-center gap-2">
                <History size={20} className="text-accent" />
                {t('interests.my_history')}
            </h2>
            
            {loading ? (
                <div className="flex justify-center p-20"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div></div>
            ) : !myPortfolio || myPortfolio.details?.length === 0 ? (
                <div className="glass-card py-20 text-center opacity-60" style={{ borderStyle: 'dashed' }}>
                    <p className="text-muted italic">{t('interests.no_history')}</p>
                </div>
            ) : (
                <div className="dashboard-grid">
                    {myPortfolio.details.map((det, idx) => (
                        <div key={idx} className="glass-card hover-card animate-in" style={{ padding: '2rem' }}>
                            <div className="flex justify-between items-start mb-6">
                                <div className="badge" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>{t('interests.success_badge')}</div>
                                <span className="text-xs text-muted">{new Date(det.snapshotDate).toLocaleDateString(getLocale(language))}</span>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                    <span className="text-xs text-muted uppercase tracking-widest">{t('interests.loan_ref')}</span>
                                    <span className="font-mono text-xs">{det.loanReference}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] text-muted uppercase mb-1">{t('interests.total_expected')}</p>
                                        <p className="font-bold">{frw(det.expectedInterest || 0, language)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-muted uppercase mb-1">{t('interests.amount_credited')}</p>
                                        <p className="font-bold text-green-500">{frw(det.paidInterest || 0, language)}</p>
                                    </div>
                                </div>
                                {/* Distribution Progress */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-muted">{t('interests.collection_progress')}</span>
                                        <span className="text-green-500 font-bold">{Math.round((det.paidInterest / (det.expectedInterest || 1)) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className="bg-green-500 h-full transition-all duration-1000" 
                                            style={{ width: `${(det.paidInterest / (det.expectedInterest||1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      )}

      {/* Details Modal */}
      {selectedDetails && (() => {
        const detailsTotalPages = Math.ceil((selectedDetails.details?.length || 0) / detailsPerPage)
        const paginatedDetails = (selectedDetails.details || []).slice((detailsPage - 1) * detailsPerPage, detailsPage * detailsPerPage)
        return (
        <Modal
            isOpen={!!selectedDetails}
            onClose={() => setSelectedDetails(null)}
            maxWidth="600px"
        >
            <div className="text-left">
                <div className="flex justify-between items-center mb-6 text-white text-lg">
                    <div>
                        <h3 className="text-xl font-bold">{selectedDetails.memberName}</h3>
                        <p className="text-sm text-muted">{t('interests.payout_history')}</p>
                    </div>
                </div>
                <div className="space-y-4 pr-2">
                    {paginatedDetails.length === 0 ? (
                        <p className="text-center text-muted py-10">No loan participations yet.</p>
                    ) : paginatedDetails.map((det, idx) => (
                        <div
                            key={idx}
                            className="p-4 rounded-xl border border-white/5 space-y-3 hover-card transition-all"
                            style={{ background: idx % 2 === 0 ? 'var(--item-bg)' : 'var(--item-hover)' }}
                        >
                            <div className="flex justify-between items-center text-sm">
                                <code className="text-accent bg-accent/10 px-2 py-1 rounded font-mono">{t('interests.loan_ref')}: {det.loanReference}</code>
                                <span className="text-muted text-xs bg-white/5 px-2 py-1 rounded">{new Date(det.snapshotDate).toLocaleDateString(getLocale(language))}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <div>
                                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{t('interests.total_expected')}</p>
                                    <p className="font-bold">{frw(det.expectedInterest || 0, language)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{t('interests.amount_credited')}</p>
                                    <p className="font-bold text-green-500">{frw(det.paidInterest || 0, language)}</p>
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-black/20 rounded-full h-1.5 mt-2 overflow-hidden shadow-inner">
                                <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, ((det.paidInterest || 0) / (det.expectedInterest || 1)) * 100)}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
                {detailsTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-white/10">
                        <button
                            className="page-btn"
                            disabled={detailsPage === 1}
                            onClick={() => setDetailsPage(p => p - 1)}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-bold text-muted">{t('loans.page')} {detailsPage} {t('loans.of')} {detailsTotalPages}</span>
                        <button
                            className="page-btn"
                            disabled={detailsPage === detailsTotalPages}
                            onClick={() => setDetailsPage(p => p + 1)}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
                <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                    <button className="wizard-btn wizard-btn-secondary" onClick={() => setSelectedDetails(null)}>{t('loans.close')}</button>
                </div>
            </div>
        </Modal>
        )
      })()}

      {/* Split Wizard Modal */}
      <Modal 
        isOpen={splitWizard.open} 
        onClose={() => !actionLoading && setSplitWizard({ ...splitWizard, open: false })}
        maxWidth="900px"
      >
        <div className="text-left">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold">{t('interests.split_title')}</h2>
                    <p className="text-muted text-sm">{t('interests.split_sub').replace('{{year}}', splitWizard.preview?.year)}</p>
                </div>
                <button 
                    className="wizard-btn wizard-btn-secondary h-10 px-4"
                    onClick={exportSplitToCSV}
                    disabled={splitWizard.loading}
                >
                    <FileText size={16} /> {t('interests.export_csv')}
                </button>
            </div>

            {splitWizard.loading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted">Analyzing portfolios and reserve requirements...</p>
                </div>
            ) : (
                <>
                    <div className="max-h-[50vh] overflow-y-auto border border-white/10 rounded-xl mb-6">
                        <table className="custom-table">
                            <thead className="sticky top-0 bg-[#0f1015]">
                                <tr>
                                    <th>{t('loans.member')}</th>
                                    <th className="text-right">{t('contributions.available')}</th>
                                    <th className="text-right">{t('interests.gap_title')}</th>
                                    <th className="text-right text-accent">{t('interests.to_reserve')}</th>
                                    <th className="text-right text-emerald-400">{t('interests.to_cash')}</th>
                                    <th className="text-center">{t('loans.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splitWizard.preview?.splits.map(s => (
                                    <tr key={s.memberId}>
                                        <td>
                                            <p className="font-bold text-sm">{s.memberName}</p>
                                            <p className="text-[10px] text-muted">{s.nationalId}</p>
                                        </td>
                                        <td className="text-right font-mono text-xs">{frw(s.availableInterest || 0, language)}</td>
                                        <td className="text-right font-mono text-xs">{frw(s.reserveRemainingNeeded || 0, language)}</td>
                                        <td className="text-right font-bold text-accent">{frw(s.amountToReserve || 0, language)}</td>
                                        <td className="text-right font-bold text-emerald-400">{frw(s.amountToCash || 0, language)}</td>
                                        <td className="text-center">
                                            {s.topupNeeded ? (
                                                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>{t('interests.topup_needed').replace('{{amount}}', frw(s.topupAmount || 0, language))}</span>
                                            ) : (
                                                <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>{t('interests.requirement_met')}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="stat-card" style={{ background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">{t('interests.to_reserve')}</p>
                            <p className="text-2xl font-bold text-accent">{frw(splitWizard.preview?.totalInterestToReserve || 0, language)}</p>
                        </div>
                        <div className="stat-card" style={{ background: 'rgba(52, 211, 153, 0.05)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>
                            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">{t('interests.to_cash')}</p>
                            <p className="text-2xl font-bold text-emerald-400">{frw(splitWizard.preview?.totalInterestToCash || 0, language)}</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button 
                            className="wizard-btn wizard-btn-secondary w-full py-3" 
                            onClick={() => setSplitWizard({ ...splitWizard, open: false })}
                            disabled={actionLoading}
                        >
                            {t('loans.cancel')}
                        </button>
                        <button 
                            className="wizard-btn wizard-btn-primary w-full py-3"
                            onClick={executeSplit}
                            disabled={actionLoading}
                        >
                            {actionLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('interests.confirm_split')}
                        </button>
                    </div>
                </>
            )}
        </div>
      </Modal>

      {/* Top-Up Modal */}
      <Modal
        isOpen={topupModal.open}
        onClose={() => !topupModal.submitting && setTopupModal({ open: false, member: null, loading: false, amount: '', submitting: false })}
        maxWidth="480px"
      >
        <div className="text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <PiggyBank size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('interests.topup_title')}</h2>
              <p className="text-xs text-muted">{t('interests.topup_sub').replace('{{name}}', topupModal.member?.memberName || '')}</p>
            </div>
          </div>

          <div className="stat-card mb-6" style={{ background: 'rgba(52, 211, 153, 0.05)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">{t('interests.available_interest')}</p>
            <p className="text-lg font-bold text-emerald-400">
              {frw((topupModal.member?.totalPaidInterest || 0) - (topupModal.member?.totalCashedOutInterest || 0), language)}
            </p>
          </div>

          <div className="pill-group mb-6">
            <label className="text-xs text-muted mb-2 block tracking-wider uppercase">{t('interests.topup_amount_label')}</label>
            <input
              type="number" required min="1"
              className="pill-input"
              value={topupModal.amount}
              onChange={(e) => setTopupModal(prev => ({ ...prev, amount: e.target.value }))}
              placeholder={t('dashboard.enter_amount')}
            />
          </div>

          <button
            className="wizard-btn wizard-btn-primary w-full py-3"
            disabled={topupModal.submitting || !topupModal.amount}
            onClick={handleRecordTopup}
          >
            {topupModal.submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><PiggyBank size={16} /> {t('interests.topup_record_btn')}</>}
          </button>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal isOpen={confirmModal.open} onClose={() => !actionLoading && setConfirmModal({ open: false })}>
        <div className="text-center p-2">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">{confirmModal.title}</h2>
            <p className="text-muted mb-8 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-4">
                <button className="wizard-btn wizard-btn-secondary w-full" onClick={() => setConfirmModal({ open: false })} disabled={actionLoading}>{t('loans.cancel')}</button>
                <button className="wizard-btn wizard-btn-primary w-full" onClick={confirmModal.action} disabled={actionLoading}>
                    {actionLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('loans.confirm')}
                </button>
            </div>
        </div>
      </Modal>
    </div>
  )
}
