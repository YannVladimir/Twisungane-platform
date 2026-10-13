import { useState, useEffect } from 'react'
import { Plus, PiggyBank, Search, Filter, Edit2, ShieldCheck, UserCheck, ArrowRightLeft, X, RotateCcw, Calendar, UserPlus, ShieldAlert, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Activity, ArrowUpRight, Heart, Wallet, LogOut, Bell, CheckCircle, XCircle, ChevronDown as ChevronDownIcon, Loader2 } from 'lucide-react'
import api from '../services/api.js'
import AddMemberModal from '../components/AddMemberModal'
import AddSharesModal from '../components/AddSharesModal'
import EditMemberModal from '../components/EditMemberModal'
import TransferSharesModal from '../components/TransferSharesModal'
import MemberExitModal from '../components/MemberExitModal'
import FeedbackModal from '../components/FeedbackModal'
import exitService from '../services/exit.service'
import { useLanguage } from '../context/LanguageContext'
import { frw, getLocale } from '../utils/i18nHelper'

export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddSharesOpen, setIsAddSharesOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  // Pending exit requests (for President / Admin action banner)
  const [pendingExits, setPendingExits] = useState([])
  const [exitActionLoading, setExitActionLoading] = useState(null)
  const [exitPanelCollapsed, setExitPanelCollapsed] = useState(false)
  const [approveConfirmModal, setApproveConfirmModal] = useState({ open: false, item: null })
  const [rejectModal, setRejectModal] = useState({ open: false, item: null, reason: '' })
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { t, language } = useLanguage()
  
  // Filter States
  const [filters, setFilters] = useState({
    status: 'ALL',
    type: 'ALL',
    ageGroup: 'ALL', // ALL, ADULT, MINOR
    shareRange: 'ALL', // ALL, ZERO, TIER1, TIER2, TIER3
    startDate: '',
    endDate: '',
    guarantorId: 'ALL'
  })

  // Data Table State
  const [sortConfig, setSortConfig] = useState({ key: 'firstName', direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalShares: 0,
    obligatoryReservePool: 0,
    socialFundBalance: 0,
    bankFeesBalance: 0
  })

  // Get current user role
  const user = JSON.parse(localStorage.getItem('user'))
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const isPresident = user?.role === 'ROLE_PRESIDENT'
  const canInitiateExit = isAdmin || isPresident

  const fetchData = async () => {
    try {
      const requests = [
        api.get('/api/v1/members'),
        api.get('/api/v1/dashboard/stats'),
      ]
      if (canInitiateExit) requests.push(exitService.getPendingExitRequests())

      const results = await Promise.allSettled(requests)

      if (results[0].status === 'fulfilled') setMembers(results[0].value.data)
      if (results[1].status === 'fulfilled') {
        const s = results[1].value.data
        setStats({
          totalMembers: s.totalMembers || 0,
          activeMembers: s.activeMembers || 0,
          totalShares: s.totalShares || 0,
          obligatoryReservePool: s.obligatoryReservePool || 0,
          socialFundBalance: s.socialFundBalance || 0,
          bankFeesBalance: s.bankFeesBalance || 0
        })
      }
      if (canInitiateExit && results[2]?.status === 'fulfilled') {
        setPendingExits(results[2].value.data)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExitApprove = async (item) => {
    setExitActionLoading(item.id + '_approve')
    try {
      await exitService.approveExit(item.id)
      await fetchData()
      setFeedbackData({
        type: 'success',
        title: t('exit.approved_title'),
        message: t('exit.approved_message'),
        details: [
          { label: t('exit.member_label'), value: item.memberName },
          { label: t('exit.net_payout'), value: frw(item.netSettlementAmount, language) },
        ],
        actionLabel: t('common.close')
      })
      setShowFeedback(true)
    } catch (err) {
      setFeedbackData({ type: 'error', title: t('common.error'), message: err.response?.data?.message || t('common.system_error'), details: [], actionLabel: t('common.close') })
      setShowFeedback(true)
    } finally {
      setExitActionLoading(null)
    }
  }

  const handleExitReject = async () => {
    const { item, reason } = rejectModal
    setRejectModal({ open: false, item: null, reason: '' })
    setExitActionLoading(item.id + '_reject')
    try {
      await exitService.rejectExit(item.id, reason || 'Rejected by president')
      await fetchData()
      setFeedbackData({ type: 'success', title: t('exit.rejected_title'), message: t('exit.rejected_message'), details: [{ label: t('exit.member_label'), value: item.memberName }], actionLabel: t('common.close') })
      setShowFeedback(true)
    } catch (err) {
      setFeedbackData({ type: 'error', title: t('common.error'), message: err.response?.data?.message || t('common.system_error'), details: [], actionLabel: t('common.close') })
      setShowFeedback(true)
    } finally {
      setExitActionLoading(null)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredMembers = members.filter(m => {
    // 1. Search Logic
    const matchesSearch = 
      m.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.nationalId?.includes(searchTerm);
    
    if (!matchesSearch) return false;

    // 2. Status Filter
    if (filters.status !== 'ALL' && m.status !== filters.status) return false;

    // 3. Type Filter
    if (filters.type !== 'ALL' && m.type !== filters.type) return false;

    // 4. Age Group Filter
    if (filters.ageGroup === 'ADULT' && m.isMinor) return false;
    if (filters.ageGroup === 'MINOR' && !m.isMinor) return false;

    // 5. Shares Filter
    const shareCount = (m.totalShares || 0) / 100000;
    if (filters.shareRange === 'ZERO' && shareCount > 0) return false;
    if (filters.shareRange === 'TIER1' && (shareCount < 1 || shareCount > 5)) return false;
    if (filters.shareRange === 'TIER2' && (shareCount < 6 || shareCount > 11)) return false;
    if (filters.shareRange === 'TIER3' && shareCount <= 11) return false;

    // 6. Date Range Filter
    if (filters.startDate && new Date(m.joinDate) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(m.joinDate) > new Date(filters.endDate)) return false;

    // 7. Guarantor Filter
    if (filters.guarantorId !== 'ALL' && m.guarantorId !== filters.guarantorId) return false;

    return true;
  })

  // Data Table Logic
  const sortData = (data, config) => {
    if (!config.key) return data;
    return [...data].sort((a, b) => {
      let aVal, bVal;
      
      switch(config.key) {
        case 'member':
          aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
          bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'nationalId':
          aVal = a.nationalId;
          bVal = b.nationalId;
          break;
        case 'status':
          aVal = a.status?.toLowerCase() || 'active';
          bVal = b.status?.toLowerCase() || 'active';
          break;
        case 'totalShares':
          aVal = a.totalShares || 0;
          bVal = b.totalShares || 0;
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

  const sortedMembers = sortData(filteredMembers, sortConfig)
  const paginatedMembers = sortedMembers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const totalPages = Math.ceil(filteredMembers.length / rowsPerPage)

  const getRowOptions = (total) => {
    const base = [10, 20, 30, 40, 50, 100];
    return base.filter((val, idx) => idx === 0 || total > base[idx-1]);
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown size={12} className="sort-icon" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="sort-icon" /> : <ChevronDown size={12} className="sort-icon" />;
  }

  const handleAddShares = (member) => {
    setSelectedMember(member)
    setIsAddSharesOpen(true)
  }

  const handleEdit = (member) => {
    setSelectedMember(member)
    setIsEditModalOpen(true)
  }

  const handleTransfer = (member) => {
    setSelectedMember(member)
    setIsTransferModalOpen(true)
  }

  const handleExit = (member) => {
    setSelectedMember(member)
    setIsExitModalOpen(true)
  }

  const resetFilters = () => {
    setFilters({
      status: 'ALL',
      type: 'ALL',
      ageGroup: 'ALL',
      shareRange: 'ALL',
      startDate: '',
      endDate: '',
      guarantorId: 'ALL'
    })
    setSearchTerm('')
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== 'ALL' && v !== '').length + (searchTerm ? 1 : 0);

  const visibleExits = pendingExits.filter(e =>
    isPresident || isAdmin ? e.status === 'SETTLEMENT_READY' : e.status === 'APPROVED'
  );

  const StatCard = ({ title, value, unit, icon, loading, detail }) => (
    <div className="stat-card group hover:scale-[1.02] transition-all flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <p className="stat-title">{title}</p>
          <div className="p-2 rounded-lg bg-white/5 text-muted group-hover:text-accent group-hover:bg-accent/10 transition-all shadow-sm">
            {icon}
          </div>
        </div>
        <div className="stat-value-group">
          <span className="stat-value tracking-tighter" style={{ fontSize: '1.875rem', fontWeight: 900 }}>{loading ? '...' : value}</span>
          {unit && <span className="stat-unit" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '4px' }}>{unit}</span>}
        </div>
      </div>
      {detail && (
        <div className="mt-4 flex items-center gap-2">
           <div style={{ color: '#b45309' }}>
             <Activity size={14} strokeWidth={2.5} />
           </div>
           <span style={{ fontSize: '12px', fontWeight: '700', color: '#b45309', letterSpacing: '-0.01em' }}>{detail}</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="animate-in pb-10">
      <header className="page-header">
        <div className="header-info">
          <h1>{t('members.title')}</h1>
          <p className="text-muted">{t('members.subtitle')}</p>
        </div>
        
        {isAdmin && (
          <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={20} />
            <span>{t('members.add_btn')}</span>
          </button>
        )}
      </header>

      <AddMemberModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onMemberAdded={fetchData}
      />

      <AddSharesModal 
        isOpen={isAddSharesOpen} 
        onClose={() => setIsAddSharesOpen(false)}
        member={selectedMember}
        onSharesAdded={fetchData}
      />

      <EditMemberModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        member={selectedMember}
        onMemberUpdated={fetchData}
      />

      <TransferSharesModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        sender={selectedMember}
        members={members}
        onTransferComplete={fetchData}
      />

      <MemberExitModal
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        member={selectedMember}
        onExitInitiated={fetchData}
      />

      {/* ── PENDING EXIT REQUESTS BANNER (role-filtered) ── */}
      {canInitiateExit && visibleExits.length > 0 && (
        <div
          className="animate-in stagger-1"
          style={{
            marginBottom: '2rem',
            borderRadius: '18px',
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.07) 0%, rgba(220,38,38,0.04) 100%)',
            overflow: 'hidden',
            boxShadow: '0 0 40px rgba(239,68,68,0.06)'
          }}
        >
          {/* Banner header */}
          <button
            onClick={() => setExitPanelCollapsed(c => !c)}
            style={{
              width: '100%', padding: '1rem 1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: exitPanelCollapsed ? 'none' : '1px solid rgba(239,68,68,0.12)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, position: 'relative'
              }}>
                <Bell size={17} />
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  background: '#ef4444', color: '#fff',
                  borderRadius: '50%', width: 18, height: 18,
                  fontSize: '0.65rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--bg-color)'
                }}>
                  {visibleExits.length}
                </span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#ef4444' }}>
                  {t('exit.action_required')} — {visibleExits.length} {visibleExits.length === 1 ? t('exit.exit_request_singular') : t('exit.exit_request_plural')}
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t('exit.action_required_sub')}
                </p>
              </div>
            </div>
            <ChevronDown
              size={18}
              style={{
                color: 'var(--text-muted)', transition: 'transform 0.25s',
                transform: exitPanelCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
              }}
            />
          </button>

          {/* Exit request cards */}
          {!exitPanelCollapsed && (
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {visibleExits.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '1.5rem',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {/* Left: member info + financial summary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                      background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1.1rem'
                    }}>
                      {item.memberName?.charAt(0)}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem' }}>{item.memberName}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                          background: item.exitType === 'VOLUNTARY' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: item.exitType === 'VOLUNTARY' ? '#22c55e' : '#ef4444',
                          border: `1px solid ${item.exitType === 'VOLUNTARY' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`
                        }}>
                          {item.exitType === 'VOLUNTARY' ? t('exit.voluntary') : t('exit.expelled')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t('exit.net_payout')}:
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#22c55e', fontFamily: 'Outfit, sans-serif' }}>
                          {frw(item.netSettlementAmount, language)}
                        </span>
                        {item.exitReason && (
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            "{item.exitReason.length > 60 ? item.exitReason.slice(0, 60) + '…' : item.exitReason}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    {item.status === 'SETTLEMENT_READY' && isPresident && (
                      <>
                        <button
                          onClick={() => setApproveConfirmModal({ open: true, item })}
                          disabled={!!exitActionLoading}
                          style={{
                            padding: '0.55rem 1rem', borderRadius: '10px', border: 'none',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff', fontWeight: 700, fontSize: '0.82rem',
                            cursor: exitActionLoading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            boxShadow: '0 3px 10px rgba(34,197,94,0.25)', whiteSpace: 'nowrap'
                          }}
                        >
                          <CheckCircle size={14} />
                          {t('exit.approve_exit')}
                        </button>
                        <button
                          onClick={() => setRejectModal({ open: true, item, reason: '' })}
                          disabled={!!exitActionLoading}
                          style={{
                            padding: '0.55rem 1rem', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444', fontWeight: 700, fontSize: '0.82rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {exitActionLoading === item.id + '_reject'
                            ? <Loader2 size={14} className="animate-spin" />
                            : <XCircle size={14} />}
                          {t('exit.reject_exit')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approve confirmation modal */}
      {approveConfirmModal.open && approveConfirmModal.item && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setApproveConfirmModal({ open: false, item: null })}
          style={{ zIndex: 1000 }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', borderRadius: '20px', padding: '2rem', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 0 60px rgba(34,197,94,0.08)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>{t('exit.confirm_approve_title')}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('exit.confirm_approve_msg')}</p>
              </div>
            </div>

            {/* Member details card */}
            <div style={{ borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: t('exit.member_label'), value: approveConfirmModal.item.memberName, accent: false },
                { label: t('exit.exit_type_label'), value: approveConfirmModal.item.exitType === 'VOLUNTARY' ? t('exit.voluntary') : t('exit.expelled'), accent: false },
                { label: t('exit.total_shares'), value: frw(approveConfirmModal.item.totalShareValue, language), accent: false },
                { label: t('exit.net_payout'), value: frw(approveConfirmModal.item.netSettlementAmount, language), accent: true },
              ].map(({ label, value, accent }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: accent ? '#22c55e' : 'var(--text-primary)', fontFamily: accent ? 'Outfit, sans-serif' : 'inherit' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Warning note */}
            <div style={{ borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.5rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <span style={{ color: '#ef4444', fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>⚠</span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#ef4444', lineHeight: 1.5, fontWeight: 600 }}>
                {t('exit.confirm_approve_warning')}
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setApproveConfirmModal({ open: false, item: null })}
                style={{ flex: 1, padding: '0.9rem', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  const item = approveConfirmModal.item
                  setApproveConfirmModal({ open: false, item: null })
                  handleExitApprove(item)
                }}
                disabled={!!exitActionLoading}
                style={{ flex: 2, padding: '0.9rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}
              >
                {exitActionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {t('exit.approve_exit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModal.open && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setRejectModal({ open: false, item: null, reason: '' })} style={{ zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', borderRadius: '18px', padding: '2rem', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>{t('exit.confirm_reject_title')}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rejectModal.item?.memberName}</p>
              </div>
            </div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('exit.rejection_reason')}
            </label>
            <textarea
              rows={3}
              value={rejectModal.reason}
              onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))}
              placeholder={t('exit.rejection_reason_placeholder')}
              style={{ width: '100%', borderRadius: '10px', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: '1.25rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setRejectModal({ open: false, item: null, reason: '' })} style={{ flex: 1, padding: '0.9rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleExitReject} style={{ flex: 2, padding: '0.9rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <XCircle size={16} /> {t('exit.reject_exit')}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        type={feedbackData?.type || 'success'}
        title={feedbackData?.title}
        message={feedbackData?.message}
        details={feedbackData?.details}
        actionLabel={feedbackData?.actionLabel || t('common.close')}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="reveal-up stagger-1">
          <StatCard 
            title={t('members.equity')} 
            value={frw(stats.totalShares || 0, language)} 
            unit="FRW" 
            icon={<PiggyBank size={18} />}
            loading={loading}
            detail={t('members.equity_sub').replace('{{shares}}', ((stats.totalShares || 0) / 100000).toFixed(0)).replace('{{members}}', stats.activeMembers)}
          />
        </div>
        <div className="reveal-up stagger-2">
          <StatCard 
            title={t('members.reserves')} 
            value={frw(stats.obligatoryReservePool || 0, language)} 
            unit="FRW" 
            icon={<ShieldCheck size={18} />}
            loading={loading}
            detail={t('members.reserves_sub').replace('{{diff}}', new Date().getFullYear() - 2023).replace('{{year}}', new Date().getFullYear())}
          />
        </div>
        <div className="reveal-up stagger-3">
          <StatCard 
            title={t('members.auxiliary')} 
            value={frw((stats.socialFundBalance || 0) + (stats.bankFeesBalance || 0), language)} 
            unit="FRW" 
            icon={<Wallet size={18} />}
            loading={loading}
            detail={t('members.auxiliary_sub').replace('{{social}}', frw(stats.socialFundBalance || 0, language)).replace('{{bank}}', frw(stats.bankFeesBalance || 0, language))}
          />
        </div>
      </div>

      <div className="glass-card table-card mt-8" style={{ borderBottomLeftRadius: showFilters ? 0 : '', borderBottomRightRadius: showFilters ? 0 : '' }}>
        <div className="table-actions">
          <div className="search-box">
            <Search size={20} />
            <input 
              type="text" 
              placeholder={t('members.search_placeholder')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {activeFilterCount > 0 && (
                <button className="btn-clear-filters" onClick={resetFilters}>
                    <RotateCcw size={16} />
                    <span>{t('members.reset_filters')}</span>
                </button>
            )}
            <button 
                className={`btn-secondary ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
                style={{ 
                    position: 'relative',
                    background: 'var(--accent-glow)',
                    color: 'var(--accent)',
                    borderColor: 'var(--accent)'
                }}
            >
                <Filter size={18} />
                <span>{t('members.filter_btn')}</span>
                {activeFilterCount > 0 && !showFilters && (
                    <span style={{ 
                        position: 'absolute', top: '-5px', right: '-5px', 
                        background: 'var(--accent)', color: 'white', 
                        borderRadius: '50%', width: '18px', height: '18px', 
                        fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', border: '2px solid var(--bg-color)'
                    }}>
                        {activeFilterCount}
                    </span>
                )}
            </button>
          </div>
        </div>
      </div>

      {/* Modern Filter Panel */}
      {showFilters && (
        <div className="filter-panel">
            <div className="filter-grid">
                <div className="filter-group">
                    <label className="filter-label">{t('members.filter_status')}</label>
                    <select 
                        className="filter-input" 
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                    >
                        <option value="ALL">{t('members.all_statuses')}</option>
                        <option value="ACTIVE">{t('members.active_members')}</option>
                        <option value="SUSPENDED">{t('members.suspended')}</option>
                        <option value="EXITING">{t('members.exiting')}</option>
                        <option value="EXITED">{t('members.exited')}</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label className="filter-label">{t('members.filter_investment')}</label>
                    <select 
                        className="filter-input"
                        value={filters.shareRange}
                        onChange={(e) => setFilters({...filters, shareRange: e.target.value})}
                    >
                        <option value="ALL">{t('members.all_balances')}</option>
                        <option value="ZERO">{t('members.zero_balance')}</option>
                        <option value="TIER1">{t('members.tier1')}</option>
                        <option value="TIER2">{t('members.tier2')}</option>
                        <option value="TIER3">{t('members.tier3')}</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label className="filter-label">{t('members.filter_guarantor')}</label>
                    <select 
                        className="filter-input"
                        value={filters.guarantorId}
                        onChange={(e) => setFilters({...filters, guarantorId: e.target.value})}
                    >
                        <option value="ALL">{t('members.all_members')}</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label className="filter-label">{t('members.registration_period')}</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                            type="date" className="filter-input" style={{ padding: '0.6rem 0.5rem' }} 
                            value={filters.startDate}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                        />
                        <input 
                            type="date" className="filter-input" style={{ padding: '0.6rem 0.5rem' }} 
                            value={filters.endDate}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                        />
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="glass-card table-card" style={{ marginTop: showFilters ? '0' : '2rem' }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th className="sortable" onClick={() => handleSort('member')}>
                  {t('members.member')} <SortIcon columnKey="member" />
                </th>
                <th className="sortable" onClick={() => handleSort('nationalId')}>
                  {t('members.identification')} <SortIcon columnKey="nationalId" />
                </th>
                <th className="sortable text-center" onClick={() => handleSort('status')}>
                  {t('loans.status')} <SortIcon columnKey="status" />
                </th>
                <th className="sortable text-right" onClick={() => handleSort('totalShares')}>
                  {t('members.portfolio_balance')} <SortIcon columnKey="totalShares" />
                </th>
                <th className="sortable text-right" onClick={() => handleSort('totalObligatoryReserve')}>
                  {t('members.reserve')} <SortIcon columnKey="totalObligatoryReserve" />
                </th>
                <th style={{ textAlign: 'right' }}>{t('loans.action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading members registry...</td></tr>
              ) : paginatedMembers.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No members found matching your search.</td></tr>
              ) : paginatedMembers.map((member, index) => (
                <tr key={member.id}>
                  <td className="text-muted font-mono" style={{ fontSize: '0.75rem' }}>{(currentPage - 1) * rowsPerPage + index + 1}</td>
                  <td>
                    <div className="member-cell">
                      <div className="avatar" style={{ borderRadius: '12px', background: member.type === 'SOCIAL' ? 'rgba(168, 85, 247, 0.2)' : undefined, color: member.type === 'SOCIAL' ? '#a855f7' : undefined }}>
                        {member.type === 'SOCIAL' ? <ShieldCheck size={20} /> : member.firstName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <p className="member-name">{member.firstName} {member.lastName}</p>
                          {member.type === 'SOCIAL' && <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.3)' }}>{t('common.system').toUpperCase()}</span>}
                        </div>
                        <p className="member-email">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{member.nationalId}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('members.join_date')}: {new Date(member.joinDate).toLocaleDateString(getLocale(language))}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {member.type === 'SOCIAL' ? (
                       <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>{t('members.social_fund_badge')}</span>
                    ) : (
                       <span className={`badge ${
                         member.status?.toLowerCase() === 'suspended' ? 'suspended' :
                         member.status?.toLowerCase() === 'exiting' ? 'exiting' :
                         member.status?.toLowerCase() === 'exited' ? 'exited' :
                         'active'
                       }`}>
                         {member.status?.toLowerCase() === 'suspended' ? t('members.suspended') :
                          member.status?.toLowerCase() === 'exiting' ? t('members.exiting') :
                          member.status?.toLowerCase() === 'exited' ? t('members.exited') :
                          t('members.active')}
                       </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                      {frw(member.totalShares || 0, language)}
                    </p>
                    {member.type === 'SOCIAL' ? (
                      <p style={{ fontSize: '0.75rem', color: '#a855f7', margin: 0 }} title="Computed from Social Fund reserve">
                        {t('members.virtual_shares').replace('{{count}}', member.computedShareCount)}
                      </p>
                    ) : (
                      <p style={{ fontSize: '0.75rem', color: 'var(--accent)', margin: 0 }}>
                        {t('members.shares_count').replace('{{count}}', (member.totalShares / 100000).toFixed(1))}
                      </p>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, fontFamily: 'Outfit, sans-serif', color: member.totalObligatoryReserve < 25000 && member.type === 'STANDARD' && member.status === 'ACTIVE' && member.totalShares > 0 ? '#ef4444' : '#f59e0b' }}>
                      {frw(member.totalObligatoryReserve || 0, language)}
                    </p>
                    {member.type === 'STANDARD' && member.status === 'ACTIVE' && member.totalShares > 0 && (
                        <p style={{ fontSize: '0.7rem', color: member.totalObligatoryReserve >= 25000 ? '#34d399' : 'var(--text-muted)', margin: 0 }}>
                            {member.totalObligatoryReserve >= 25000 ? t('members.fully_paid') : t('members.owes').replace('{{amount}}', frw(Math.max(0, 25000 - member.totalObligatoryReserve), language))}
                        </p>
                    )}
                  </td>
                  <td>
                    {member.type === 'STANDARD' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {/* System accounts (Admin / President rows): only allow editing their own profile */}
                        {(member.role === 'ROLE_ADMIN' || member.role === 'ROLE_PRESIDENT') ? (
                          (isAdmin || isPresident) && (
                            <button
                              onClick={() => handleEdit(member)}
                              className="btn-icon-action"
                              style={{ color: 'var(--accent)', background: 'var(--accent-glow)' }}
                              title={t('members.edit_profile')}
                            >
                              <Edit2 size={16} />
                            </button>
                          )
                        ) : (
                          /* Regular members: full action set */
                          <>
                            {isAdmin && (
                              <>
                                <button
                                   onClick={() => handleTransfer(member)}
                                   className="btn-icon-action"
                                   style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}
                                   title={t('members.transfer_shares')}
                                >
                                  <ArrowRightLeft size={16} />
                                </button>
                                <button
                                   onClick={() => handleAddShares(member)}
                                   className="btn-icon-action"
                                   style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' }}
                                   title={t('members.add_shares')}
                                >
                                  <PiggyBank size={16} />
                                </button>
                              </>
                            )}
                            {(isAdmin || isPresident) && (
                              <button
                                onClick={() => handleEdit(member)}
                                className="btn-icon-action"
                                style={{ color: 'var(--accent)', background: 'var(--accent-glow)' }}
                                title={t('members.edit_profile')}
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {canInitiateExit && member.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleExit(member)}
                                className="btn-icon-action"
                                style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                                title={t('exit.initiate_exit')}
                              >
                                <LogOut size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 0 && (
            <div className="pagination-controls">
                <div className="pagination-info">
                    <span>{t('loans.page')} {currentPage} {t('loans.of')} {totalPages} ({filteredMembers.length} {t('common.total')})</span>
                    <div className="rows-selector-container">
                        <span>{t('loans.show')}:</span>
                        <select 
                            className="rows-select" 
                            value={rowsPerPage} 
                            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        >
                            {getRowOptions(filteredMembers.length).map(opt => (
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
    </div>
  )
}
