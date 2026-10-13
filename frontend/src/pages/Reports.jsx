import React, { useState, useEffect } from 'react';
import {
  FileText, Download, User, ShieldCheck, Activity, Users,
  AlertCircle, TrendingUp, Heart, ReceiptText, AlertTriangle,
  Landmark, CheckCircle, XCircle, Clock, BarChart2,
  Scale, TrendingDown, Settings, ClipboardList, ChevronDown, ChevronRight,
  Info, BookOpen
} from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { frw, getLocale } from '../utils/i18nHelper';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const CHART_COLORS = ['#eab308', '#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444'];
const PAGE_SIZE = 15;

const NAV_ITEMS = [
  {
    category: 'operational',
    icon: <TrendingUp size={11} />,
    items: [
      { key: 'monthly',           label: 'monthly',           Icon: Activity    },
      { key: 'annual-audit',      label: 'annual_audit',      Icon: BookOpen    },
      { key: 'outstanding-loans', label: 'outstanding_loans', Icon: Landmark    },
      { key: 'aging',             label: 'aging',             Icon: AlertCircle },
      { key: 'loan-demand',       label: 'loan_demand',       Icon: TrendingUp  },
      { key: 'interest-accrual',  label: 'interest_accrual',  Icon: TrendingUp  },
    ],
  },
  {
    category: 'member_social',
    icon: <Users size={11} />,
    items: [
      { key: 'members',             label: 'members',             Icon: Users       },
      { key: 'yield-analysis',      label: 'yield_analysis',      Icon: BarChart2   },
      { key: 'social-fund',         label: 'social_fund',         Icon: Heart       },
      { key: 'contribution-ledger', label: 'contribution_ledger', Icon: ReceiptText },
    ],
  },
  {
    category: 'risk_compliance',
    icon: <ShieldCheck size={11} />,
    items: [
      { key: 'penalty-summary',   label: 'penalty_summary',   Icon: AlertTriangle },
      { key: 'guarantors',        label: 'guarantors',        Icon: Scale         },
      { key: 'negative-interest', label: 'negative_interest', Icon: TrendingDown  },
    ],
  },
  {
    category: 'administration',
    icon: <Settings size={11} />,
    items: [
      { key: 'audit-log', label: 'audit_log', Icon: ClipboardList },
    ],
  },
];



const spinStyle = (size = 28, color = 'var(--accent)') => ({
  width: size, height: size,
  border: `${size > 20 ? 3 : 2}px solid var(--border-color)`,
  borderTopColor: color,
  borderRadius: '50%', display: 'inline-block',
});

const SummaryCard = ({ label, value, variant = '' }) => (
  <div className="report-summary-card">
    <p className="report-summary-card-label">{label}</p>
    <p className={`report-summary-card-value ${variant}`}>{value}</p>
  </div>
);

const StatusBadge = ({ status, t }) => {
  const map = {
    ACTIVE: 'active', PAID: 'paid', WAIVED: 'waived',
    PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected',
  };
  return <span className={`r-badge ${map[status] || ''}`}>{t(`loans.${status?.toLowerCase()}`) || status}</span>;
};

const ContribBadge = ({ type, t }) => {
  const map = {
    SOCIAL:             ['social',   t('expenditure.type_social')],
    FRAIS_BANCAIRE:     ['fees',     t('expenditure.type_banking_fee')],
    OBLIGATORY_RESERVE: ['reserve',  t('expenditure.type_reserve')],
    PENALTY:            ['penalty',  t('expenditure.type_penalty')],
  };
  const [cls, label] = map[type] || ['', type];
  return <span className={`r-badge ${cls}`}>{label}</span>;
};

const EmptyState = ({ message, t }) => (
  <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
    <BarChart2 size={36} style={{ opacity: 0.3 }} />
    <p style={{ fontSize: '0.875rem' }}>{message || t('common.no_data')}</p>
  </div>
);

const LoadingPanel = ({ t }) => (
  <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
    <span className="animate-spin" style={spinStyle(32)} />
    <p style={{ fontSize: '0.875rem' }}>{t('reports.aggregating_data')}</p>
  </div>
);

const PaginationHelper = ({ page, setPage, totalItems, t, pageSize = PAGE_SIZE }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} {t('loans.of')} {totalItems}
      </span>
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="page-btn">‹</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…'); acc.push(p); return acc; }, [])
          .map((p, i) => p === '…'
            ? <span key={i} style={{ padding: '0 4px', color: 'var(--text-muted)', lineHeight: '32px' }}>…</span>
            : <button key={p} onClick={() => setPage(p)} className={`page-btn${page === p ? ' active' : ''}`}>{p}</button>
          )}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="page-btn">›</button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Reports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [downloading, setDownloading] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear());
  const [activeTab,  setActiveTab]  = useState('monthly');
  const [reportData, setReportData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [negativeInterestYear, setNegativeInterestYear] = useState(new Date().getFullYear());
  const [yieldYear, setYieldYear] = useState(new Date().getFullYear());
  const [auditYear, setAuditYear] = useState(new Date().getFullYear());
  const [hasShares, setHasShares] = useState(false);

  // Per-panel page states
  const [membersPage,      setMembersPage]      = useState(1);
  const [loansPage,        setLoansPage]        = useState(1);
  const [demandPage,       setDemandPage]       = useState(1);
  const [yieldPage,        setYieldPage]        = useState(1);
  const [claimsPage,       setClaimsPage]       = useState(1);
  const [contribPage,      setContribPage]      = useState(1);
  const [penaltyPage,      setPenaltyPage]      = useState(1);
  const [guarantorPage,    setGuarantorPage]    = useState(1);
  const [negIntPage,       setNegIntPage]       = useState(1);
  const [auditLogPage,     setAuditLogPage]     = useState(1);
  const [interestPage,     setInterestPage]     = useState(1);

  const resetAllPages = () => {
    setMembersPage(1); setLoansPage(1); setDemandPage(1); setYieldPage(1);
    setClaimsPage(1); setContribPage(1); setPenaltyPage(1); setGuarantorPage(1);
    setNegIntPage(1); setAuditLogPage(1); setInterestPage(1);
  };

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/api/v1/reports/data/my-shares?memberId=${user.id}`)
      .then(res => setHasShares(res.data.hasShares)).catch(() => setHasShares(false));
  }, []);

  const canViewAdminReports = ['ROLE_PRESIDENT', 'ROLE_ADMIN', 'ROLE_FINANCE'].includes(user.role);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setReportData(null);
    setActiveTab(tab);
    resetAllPages();
  };

  // Re-fetch when tab changes
  useEffect(() => {
    if (canViewAdminReports) fetchReportData(activeTab);
  }, [activeTab]);

  // Re-fetch only financial status when date changes
  useEffect(() => {
    if (canViewAdminReports && activeTab === 'monthly') fetchReportData('monthly');
  }, [selectedMonth, selectedYear]);

  // Re-fetch negative interest when year changes
  useEffect(() => {
    if (canViewAdminReports && activeTab === 'negative-interest') fetchReportData('negative-interest');
  }, [negativeInterestYear]);

  // Re-fetch yield analysis when year changes
  useEffect(() => {
    if (canViewAdminReports && activeTab === 'yield-analysis') fetchReportData('yield-analysis');
  }, [yieldYear]);

  // Re-fetch annual audit when year changes
  useEffect(() => {
    if (canViewAdminReports && activeTab === 'annual-audit') fetchReportData('annual-audit');
  }, [auditYear]);

  const ENDPOINTS = {
    'monthly':            `/api/v1/reports/data/monthly-status?month=${selectedMonth}&year=${selectedYear}`,
    'members':            `/api/v1/reports/data/member-balances`,
    'aging':              `/api/v1/reports/data/loan-aging`,
    'outstanding-loans':  `/api/v1/reports/data/outstanding-loans`,
    'social-fund':        `/api/v1/reports/data/social-fund`,
    'contribution-ledger':`/api/v1/reports/data/contribution-ledger`,
    'penalty-summary':    `/api/v1/reports/data/penalty-summary`,
    'annual-audit':       `/api/v1/reports/data/annual-audit?year=${auditYear}`,
    'interest-accrual':   `/api/v1/reports/data/interest-accrual`,
    'loan-demand':        `/api/v1/reports/data/loan-demand`,
    'yield-analysis':     `/api/v1/reports/data/yield-analysis?year=${yieldYear}`,
    'guarantors':         `/api/v1/reports/data/guarantors`,
    'negative-interest':  `/api/v1/reports/data/negative-interest?year=${negativeInterestYear}`,
    'audit-log':          `/api/v1/reports/data/audit-log`,
  };

  const fetchReportData = async (type) => {
    const endpoint = ENDPOINTS[type];
    if (!endpoint) return;
    setLoading(true);
    try {
      const res = await api.get(endpoint);
      setReportData(res.data);
    } catch (e) {
      console.error('Report fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (type, params = {}) => {
    const id = `${type}-${params.month || 'statement'}`;
    setDownloading(id);
    try {
      const endpoint = type === 'statement'
        ? `/api/v1/reports/member-statement?memberId=${user.id}`
        : type === 'annual'
        ? `/api/v1/reports/annual-audit?year=${params.year}`
        : `/api/v1/reports/monthly-status?month=${params.month}&year=${params.year}`;
      const res = await api.get(endpoint, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `${type}_${params.month || 'statement'}.pdf`);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {
      alert(t('reports.failed_generate') || 'Failed to generate report.');
    } finally {
      setDownloading(null);
    }
  };

  // ── Panel: Monthly Financial Status ────────────────────────────────────────
  const MonthlyPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const monthName = t(`months.${new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' }).toLowerCase()}`);
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <Activity size={20} style={{ color: 'var(--accent)' }} />
            {monthName} {selectedYear} — {t('reports.financial_overview')}
          </h3>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.total_shares_pool')} value={frw(reportData.totalShares, language)} variant="accent" />
          <SummaryCard label={t('reports.active_loans_out')}  value={frw(reportData.totalLoans, language)}  variant="danger" />
          <SummaryCard label={t('reports.active_members')}    value={reportData.memberCount}       variant="info"   />
        </div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={reportData.composition || []} cx="50%" cy="50%"
                innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value">
                {(reportData.composition || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => frw(v, language)}
                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend verticalAlign="bottom" height={32} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ── Panel: Outstanding Loans ────────────────────────────────────────────────
  const OutstandingLoansPanel = () => {
    if (!reportData || !Array.isArray(reportData)) return <EmptyState t={t} />;
    const totalPrincipal = reportData.reduce((s, l) => s + Number(l.remainingPrincipal), 0);
    const totalInterest  = reportData.reduce((s, l) => s + Number(l.remainingInterest), 0);
    const avgMonths = reportData.length
      ? Math.round(reportData.reduce((s, l) => s + Number(l.monthsActive), 0) / reportData.length) : 0;
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <Landmark size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.outstanding_loans')}
          </h3>
          <span className="r-badge active">{reportData.length} {t('loans.active')}</span>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('dashboard.active_loans')}       value={reportData.length}      variant="info"    />
          <SummaryCard label={t('reports.principal_owed')}     value={frw(totalPrincipal, language)}    variant="danger"  />
          <SummaryCard label={t('reports.interest_owed')}      value={frw(totalInterest, language)}     variant="warning" />
          <SummaryCard label={t('reports.avg_loan_age')}       value={`${avgMonths} ${t('common.mo') || 'mo'}`}      variant=""        />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('loans.member')}</th>
                <th>{t('loans.loan_number')}</th>
                <th style={{ textAlign: 'right' }}>{t('loans.paid_principal')}</th>
                <th style={{ textAlign: 'right' }}>{t('loans.interest')}</th>
                <th style={{ textAlign: 'right' }}>{t('loans.balance')}</th>
                <th>{t('loans.progress') || 'Progress'}</th>
                <th style={{ textAlign: 'right' }}>{t('loans.months') || 'Months'}</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                    <BarChart2 size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
                    {t('loans.no_history_found')}
                  </td>
                </tr>
              ) : reportData.slice((loansPage - 1) * PAGE_SIZE, loansPage * PAGE_SIZE).map((loan, i) => {
                const rank = (loansPage - 1) * PAGE_SIZE + i + 1;
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rank}</td>
                    <td style={{ fontWeight: 600 }}>{loan.memberName}</td>
                    <td><span className="r-badge info">{loan.loanNumber}</span></td>
                    <td style={{ textAlign: 'right' }} className="r-mono">{frw(loan.remainingPrincipal, language)}</td>
                    <td style={{ textAlign: 'right', color: '#f59e0b' }} className="r-mono">{frw(loan.remainingInterest, language)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }} className="r-mono">{frw(loan.totalRemaining, language)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div className="r-progress-track">
                          <div className="r-progress-fill success" style={{ width: `${loan.progressPercent}%` }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{loan.progressPercent}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{loan.monthsActive}m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationHelper page={loansPage} setPage={setLoansPage} totalItems={reportData.length} t={t} />
      </div>
    );
  };

  // ── Panel: Loan Aging ───────────────────────────────────────────────────────
  const AgingPanel = () => {
    if (!reportData || !Array.isArray(reportData)) return <EmptyState t={t} />;
    const localizedData = reportData.map(e => ({
      ...e,
      name: t(`reports.${e.name?.toLowerCase()}`) || e.name
    }));
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <AlertCircle size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.portfolio_health')}
          </h3>
        </div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={localizedData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip formatter={(v) => frw(v, language)}
                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {reportData.map((e, i) => (
                  <Cell key={i} fill={
                    e.name === 'Healthy'    ? '#10b981' :
                    e.name === 'Defaulted'  ? '#ef4444' : '#f59e0b'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="report-alert-warning">
          <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', margin: 0 }}>
            {t('reports.penalty_disclaimer')}
          </p>
        </div>
      </div>
    );
  };
  // ── Panel: Loan Demand Forecast ─────────────────────────────────────────────
  const LoanDemandPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { availableCash, totalDemand, deficit, fundableCount, queue = [] } = reportData;
    const isDeficit = Number(deficit) < 0; 
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <TrendingUp size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.loan_demand')}
          </h3>
          <span className={`r-badge ${fundableCount > 0 ? 'success' : 'warning'}`}>{fundableCount} {t('reports.fundable')}</span>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.available_cash')}  value={frw(availableCash, language)} variant="success" />
          <SummaryCard label={t('reports.pending_demand')}  value={frw(totalDemand, language)}   variant="warning" />
          <SummaryCard label={t('reports.current_deficit')} value={frw(deficit, language)}       variant="danger"  />
        </div>
        {queue.length === 0 ? (
          <EmptyState t={t} message={t('loans.no_apps_found')} />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('reports.applicant_name')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.requested_amount')}</th>
                  <th>{t('loans.status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('loans.date')}</th>
                  <th style={{ textAlign: 'center' }}>{t('reports.can_fund')}</th>
                </tr>
              </thead>
              <tbody>
                {queue.slice((demandPage - 1) * PAGE_SIZE, demandPage * PAGE_SIZE).map((app, i) => {
                  const rank = (demandPage - 1) * PAGE_SIZE + i + 1;
                  return (
                    <tr key={i} style={{ background: app.canFund ? 'inherit' : 'var(--strip-bg)' }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rank}</td>
                      <td style={{ fontWeight: 600, color: app.canFund ? 'inherit' : 'var(--text-muted)' }}>{app.memberName}</td>
                      <td style={{ textAlign: 'right' }} className="r-mono">{frw(app.requestedAmount, language)}</td>
                      <td><StatusBadge status={app.status} t={t} /></td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {new Date(app.applicationDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {app.canFund ? (
                          <CheckCircle size={18} style={{ color: '#10b981', margin: '0 auto' }} />
                        ) : (
                          <XCircle size={18} style={{ color: '#ef4444', margin: '0 auto' }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationHelper page={demandPage} setPage={setDemandPage} totalItems={queue.length} t={t} />
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Yield Analysis ───────────────────────────────────────────────────
  const YieldAnalysisPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { year, yields = [], totalNetYield } = reportData;
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <BarChart2 size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.yield_analysis')} — {year}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('reports.year') || 'Year'}:</label>
            <select
              value={yieldYear}
              onChange={(e) => setYieldYear(Number(e.target.value))}
              className="report-select"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.total_actual_yield') || 'Total Actual Yield'} value={frw(totalNetYield, language)} variant={Number(totalNetYield) > 0 ? 'success' : 'danger'} />
          <SummaryCard label={t('reports.active_members')}  value={yields.length}      variant="info" />
        </div>
        
        {yields.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('loans.member')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.interest_earned')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.deduction') || 'Deduction'}</th>
                  <th style={{ textAlign: 'right' }}>{t('dashboard.social_fund')}</th>
                  <th style={{ textAlign: 'right' }}>{t('dashboard.bank_fees')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.net_yield') || 'Net Yield'}</th>
                </tr>
              </thead>
              <tbody>
                {yields.slice((yieldPage - 1) * PAGE_SIZE, yieldPage * PAGE_SIZE).map((y, i) => {
                  const rank = (yieldPage - 1) * PAGE_SIZE + i + 1;
                  const isPositive = Number(y.netYield) >= 0;
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rank}</td>
                      <td style={{ fontWeight: 600 }}>{y.memberName}</td>
                      <td style={{ textAlign: 'right', color: '#10b981' }} className="r-mono">{frw(y.earnedInterest, language)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="r-mono">{frw(y.deduction, language)}</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b' }} className="r-mono">{frw(y.socialPaid, language)}</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b' }} className="r-mono">{frw(y.bankFeesPaid, language)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isPositive ? '#10b981' : '#ef4444' }} className="r-mono">
                        {frw(y.netYield, language)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationHelper page={yieldPage} setPage={setYieldPage} totalItems={yields.length} t={t} />
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Member Balances ──────────────────────────────────────────────────
  const MembersPanel = () => {
    if (!reportData || !Array.isArray(reportData)) return <EmptyState t={t} />;
    const paged = reportData.slice((membersPage - 1) * PAGE_SIZE, membersPage * PAGE_SIZE);
    const totalShares = reportData.reduce((s, m) => s + Number(m.shares), 0);
    const withLoans   = reportData.filter(m => m.loanBalance > 0).length;
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <Users size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.members')}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              ({reportData.length} {t('dashboard.members')})
            </span>
          </h3>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.total_members') || 'Total Members'}  value={reportData.length}  variant="info"    />
          <SummaryCard label={t('reports.total_shares_pool')}   value={frw(totalShares, language)}   variant="accent"  />
          <SummaryCard label={t('reports.with_loans') || 'With Loans'}     value={withLoans}          variant="warning" />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('loans.member')}</th>
                <th style={{ textAlign: 'right' }}>{t('dashboard.total_shares')}</th>
                <th style={{ textAlign: 'right' }}>{t('loans.total_active_out')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((m, i) => {
                const rank = (membersPage - 1) * PAGE_SIZE + i + 1;
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rank}</td>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }} className="r-mono">
                      {frw(m.shares, language)}
                    </td>
                    <td style={{ textAlign: 'right', color: m.loanBalance > 0 ? '#ef4444' : 'var(--text-muted)' }} className="r-mono">
                      {m.loanBalance > 0 ? frw(m.loanBalance, language) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationHelper page={membersPage} setPage={setMembersPage} totalItems={reportData.length} t={t} />
      </div>
    );
  };

  // ── Panel: Social Fund ──────────────────────────────────────────────────────
  const SocialFundPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { totalPaid, totalClaims, pendingClaims, avgPerClaim, byEventType = [], recentClaims = [] } = reportData;
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <Heart size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.social_fund')}
          </h3>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.interest_distributed')}  value={frw(totalPaid, language)}   variant="accent"  />
          <SummaryCard label={t('reports.claims_settled') || 'Claims Settled'}  value={totalClaims}      variant="success" />
          <SummaryCard label={t('loans.pending') || 'Pending'}         value={pendingClaims}    variant="warning" />
          <SummaryCard label={t('reports.avg_per_claim') || 'Avg per Claim'}   value={frw(avgPerClaim, language)} variant=""        />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {byEventType.length > 0 ? (
            <div style={{ height: 200 }}>
              <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.by_event_type') || 'By Event Type'}</p>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byEventType} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                    {byEventType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => frw(v, language)}
                    contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState t={t} message={t('reports.no_claims') || 'No paid claims yet.'} />
          )}
          <div>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.breakdown') || 'Breakdown'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {byEventType.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem' }}>{e.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }} className="r-mono">{frw(e.value, language)}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>×{e.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {recentClaims.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.recent_claims') || 'Recent Claims'}</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="report-data-table">
                <thead>
                  <tr>
                    <th>{t('loans.member')}</th>
                    <th>{t('reports.event') || 'Event'}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenditure.amount')}</th>
                    <th>{t('loans.status')}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenditure.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClaims.slice((claimsPage - 1) * PAGE_SIZE, claimsPage * PAGE_SIZE).map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.memberName}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.label}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }} className="r-mono">{frw(c.amount, language)}</td>
                      <td><StatusBadge status={c.status} t={t} /></td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {new Date(c.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationHelper page={claimsPage} setPage={setClaimsPage} totalItems={recentClaims.length} t={t} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Contribution Ledger ──────────────────────────────────────────────
  const ContributionLedgerPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { summary = [], totalCollected, recentContributions = [] } = reportData;
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <ReceiptText size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.contribution_ledger')}
          </h3>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.total_collected') || 'Total Collected'} value={frw(totalCollected, language)} variant="accent" />
          {summary.map((s, i) => (
            <SummaryCard key={i} label={s.name} value={frw(s.total, language)} variant="" />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={(v) => v.split(' ')[0]} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                <Tooltip formatter={(v) => frw(v, language)}
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {summary.map((e, i) => <Cell key={i} fill={e.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {summary.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem' }}>{s.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }} className="r-mono">{frw(s.total, language)}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>×{s.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {recentContributions.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.recent_transactions') || 'Recent Transactions'}</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="report-data-table">
                <thead>
                  <tr>
                    <th>{t('loans.member')}</th>
                    <th>{t('expenditure.type')}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenditure.amount')}</th>
                    <th style={{ textAlign: 'right' }}>{t('reports.period') || 'Period'}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenditure.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentContributions.slice((contribPage - 1) * PAGE_SIZE, contribPage * PAGE_SIZE).map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.memberName}</td>
                      <td><ContribBadge type={c.type} t={t} /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }} className="r-mono">{frw(c.amount, language)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.period}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {new Date(c.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationHelper page={contribPage} setPage={setContribPage} totalItems={recentContributions.length} t={t} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Penalty Summary ──────────────────────────────────────────────────
  const PenaltySummaryPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { countActive, countPaid, countWaived, amountOutstanding, amountCollected, amountWaived, breakdown = [], activePenalties = [] } = reportData;
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <AlertTriangle size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.penalty_summary')}
          </h3>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.outstanding')}   value={frw(amountOutstanding, language)} variant="danger"  />
          <SummaryCard label={t('reports.collected')}     value={frw(amountCollected, language)}   variant="success" />
          <SummaryCard label={t('reports.waived')}        value={frw(amountWaived, language)}      variant="warning" />
          <SummaryCard label={t('reports.active_cases')}  value={countActive}            variant="danger"  />
          <SummaryCard label={t('loans.paid') || 'Paid'}    value={countPaid}              variant="success" />
          <SummaryCard label={t('reports.waived') || 'Waived'}  value={countWaived}            variant="warning" />
        </div>
        {breakdown.length > 0 && (
          <>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.by_penalty_type') || 'By Penalty Type'}</p>
            <div style={{ height: 200, marginBottom: '1.5rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                  <Bar dataKey="active" name={t('loans.active')} fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="paid"   name={t('loans.paid')}   fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="waived" name={t('reports.waived')} fill="#f59e0b" radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        {activePenalties.length > 0 && (
          <>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              {t('reports.active_penalties')} — {t('reports.recent_transactions')}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="report-data-table">
                <thead>
                  <tr>
                    <th>{t('loans.member')}</th>
                    <th>{t('expenditure.type')}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenditure.amount')}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenditure.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activePenalties.slice((penaltyPage - 1) * PAGE_SIZE, penaltyPage * PAGE_SIZE).map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{p.memberName}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.label}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 700 }} className="r-mono">{frw(p.amount, language)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {new Date(p.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationHelper page={penaltyPage} setPage={setPenaltyPage} totalItems={activePenalties.length} t={t} />
            </div>
          </>
        )}
        {activePenalties.length === 0 && (
          <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <p style={{ fontSize: '0.875rem', margin: 0, color: '#10b981' }}>{t('reports.no_outstanding_penalties') || 'All penalties have been settled. No outstanding cases.'}</p>
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Annual Audit ────────────────────────────────────────────────────
  const AnnualAuditPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const {
      year, memberCount, totalSharesPool, sharesAddedInYear, activeLoansOutstanding,
      loansCount, totalPrincipalDisbursed, totalPrincipalRepaid, totalInterestRepaid,
      snapshotCount, totalInterestExpected, totalInterestDistributed,
      contribsByType = {}, totalContributions,
      socialPaid, socialClaimsCount,
      totalExpenses, expenseCount,
      penaltiesIssued, penaltiesCollected, penaltyCount,
      netIncome, memberShares = []
    } = reportData;

    const contribLabels = {
      SOCIAL: t('dashboard.social_fund_credit'), FRAIS_BANCAIRE: t('dashboard.bank_fees'),
      OBLIGATORY_RESERVE: t('dashboard.obligatory_reserve'), PENALTY: t('loans.penalty'),
    };
    const isPositive = Number(netIncome) >= 0;
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <BookOpen size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.annual_audit')} — {year}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select value={auditYear} onChange={(e) => setAuditYear(Number(e.target.value))}
              className="report-select" style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => downloadReport('annual', { year: auditYear })}
              disabled={downloading?.startsWith('annual')}
              className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {downloading?.startsWith('annual')
                ? <span className="animate-spin" style={spinStyle(13, 'white')} />
                : <Download size={13} />}
              PDF
            </button>
          </div>
        </div>

        {/* Overview */}
        <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('dashboard.system_overview')}</p>
        <div className="report-summary-grid" style={{ marginBottom: '1.25rem' }}>
          <SummaryCard label={t('reports.active_members')}    value={memberCount}                  variant="info"    />
          <SummaryCard label={t('reports.total_shares_pool')} value={frw(totalSharesPool, language)}         variant="accent"  />
          <SummaryCard label={t('dashboard.equity_growth')}  value={frw(sharesAddedInYear, language)}       variant=""        />
          <SummaryCard label={t('reports.outstanding_loans')} value={frw(activeLoansOutstanding, language)}  variant="danger"  />
        </div>

        {/* 2-column grid: Loan + Interest */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.categories.operational')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {[
                [t('loans.loans_count') || 'Loans', loansCount, ''],
                [t('reports.principal_owed'), frw(totalPrincipalDisbursed, language), 'danger'],
                [t('loans.paid_principal'), frw(totalPrincipalRepaid, language), 'success'],
                [t('dashboard.interest_pool'), frw(totalInterestRepaid, language), 'accent'],
              ].map(([label, val, variant], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'var(--item-bg)', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span className={`report-summary-card-value ${variant}`} style={{ fontSize: '0.82rem' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.interest_accrual')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {[
                [t('reports.snapshot_count') || 'Snapshots', snapshotCount, ''],
                [t('reports.interest_expected') || 'Expected', frw(totalInterestExpected, language), ''],
                [t('reports.interest_distributed') || 'Distributed', frw(totalInterestDistributed, language), 'success'],
                [t('reports.interest_pending') || 'Pending', frw(Math.max(0, Number(totalInterestExpected) - Number(totalInterestDistributed)), language), 'warning'],
              ].map(([label, val, variant], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'var(--item-bg)', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span className={`report-summary-card-value ${variant}`} style={{ fontSize: '0.82rem' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contributions */}
        <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.contribution_ledger')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {Object.entries(contribsByType).map(([type, amount], i) => (
            <div key={i} style={{ background: 'var(--item-bg)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '0.6rem 0.875rem' }}>
              <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.25rem' }}>{contribLabels[type] || type}</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)', margin: 0, fontFamily: 'Outfit' }} className="r-mono">{frw(amount, language)}</p>
            </div>
          ))}
          <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '0.75rem', padding: '0.6rem 0.875rem' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.25rem', fontWeight: 700 }}>{t('common.total') || 'Total'}</p>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)', margin: 0, fontFamily: 'Outfit' }} className="r-mono">{frw(totalContributions, language)}</p>
          </div>
        </div>

        {/* Social + Expenses + Penalties row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          {[
            { label: t('dashboard.social_fund'), items: [[t('reports.claims_settled'), socialClaimsCount], [t('dashboard.collected'), frw(socialPaid, language)]], color: '#f97316' },
            { label: t('nav.expenditure'), items: [[t('reports.recent_transactions'), expenseCount], [t('common.total') || 'Total', frw(totalExpenses, language)]], color: '#ef4444' },
            { label: t('loans.penalty'), items: [[t('reports.penalty_cases'), penaltyCount], [t('dashboard.collected'), frw(penaltiesCollected, language)]], color: '#f59e0b' },
          ].map((sec, i) => (
            <div key={i} style={{ background: 'var(--item-bg)', border: '1px solid var(--border-color)', borderRadius: '0.875rem', padding: '0.875rem' }}>
              <p style={{ fontSize: '0.65rem', color: sec.color, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: '0.5rem' }}>{sec.label}</p>
              {sec.items.map(([k, v], j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Net Income */}
        <div style={{ padding: '1rem 1.25rem', background: isPositive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {isPositive ? <TrendingUp size={20} style={{ color: '#10b981' }} /> : <TrendingDown size={20} style={{ color: '#ef4444' }} />}
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('reports.net_yield')} — {year}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('reports.net_income_formula') || 'Interest + Contributions − Social Payouts − Expenses'}</p>
            </div>
          </div>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: isPositive ? '#10b981' : '#ef4444', margin: 0, fontFamily: 'Outfit' }}>{frw(netIncome, language)}</p>
        </div>

        {/* Member Standings */}
        {memberShares.length > 0 && (
          <>
            <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{t('reports.nav.members')}</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="report-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('loans.member')}</th>
                    <th style={{ textAlign: 'right' }}>{t('dashboard.total_shares')}</th>
                    <th style={{ textAlign: 'right' }}>{t('loans.total_active_out')}</th>
                  </tr>
                </thead>
                <tbody>
                  {memberShares.slice((interestPage - 1) * PAGE_SIZE, interestPage * PAGE_SIZE).map((m, i) => {
                    const rank = (interestPage - 1) * PAGE_SIZE + i + 1;
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rank}</td>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }} className="r-mono">{frw(m.shares, language)}</td>
                        <td style={{ textAlign: 'right', color: Number(m.loanBalance) > 0 ? '#ef4444' : 'var(--text-muted)' }} className="r-mono">
                          {Number(m.loanBalance) > 0 ? frw(m.loanBalance, language) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationHelper page={interestPage} setPage={setInterestPage} totalItems={memberShares.length} t={t} />
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Panel: Interest Accrual & Distribution ─────────────────────────────────
  const InterestAccrualPanel = () => {
    const [expanded, setExpanded] = useState(new Set());
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { snapshots = [], totalExpected, totalPaid, totalPending, totalLoans } = reportData;

    const toggle = (i) => setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <TrendingUp size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.interest_accrual')}
          </h3>
          <span className="r-badge info">{totalLoans} {t('loans.loans_count')}</span>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.nav.outstanding_loans')}    value={totalLoans}          variant="info"    />
          <SummaryCard label={t('reports.interest_expected')}   value={frw(totalExpected, language)}  variant="accent"  />
          <SummaryCard label={t('reports.interest_distributed')}   value={frw(totalPaid, language)}      variant="success" />
          <SummaryCard label={t('reports.interest_pending')}    value={frw(totalPending, language)}   variant="warning" />
        </div>
        {snapshots.length === 0 ? (
          <EmptyState t={t} message={t('reports.no_snapshots_found') || 'No interest snapshots recorded yet.'} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>{t('loans.loan_number')}</th>
                  <th>{t('loans.borrower')}</th>
                  <th style={{ textAlign: 'right' }}>{t('loans.loan_amount')}</th>
                  <th style={{ textAlign: 'right' }}>{t('loans.interest')}</th>
                  <th style={{ textAlign: 'right' }}>{t('loans.paid')}</th>
                  <th>{t('loans.status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.timestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => {
                  const isOpen = expanded.has(i);
                  const pct = Number(s.totalInterest) > 0
                    ? Math.round(Number(s.snapshotPaid) / Number(s.totalInterest) * 100) : 0;
                  return (
                    <React.Fragment key={i}>
                      <tr className="r-accordion-trigger" onClick={() => toggle(i)}>
                        <td style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </td>
                        <td><span className="r-badge info">{s.loanNumber}</span></td>
                        <td style={{ fontWeight: 600 }}>{s.borrowerName}</td>
                        <td style={{ textAlign: 'right' }} className="r-mono">{frw(s.principalAmount, language)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent)' }} className="r-mono">{frw(s.totalInterest, language)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <div className="r-progress-track">
                              <div className="r-progress-fill success" style={{ width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={s.loanStatus} t={t} />
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {new Date(s.snapshotDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="r-accordion-body">
                          <td colSpan={8}>
                            <div className="r-accordion-inner">
                              <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                {t('reports.distribution_to_members') || 'Distribution to'} {s.distributionCount} {t('dashboard.members')} — {t('reports.snapshot_at') || 'snapshot at'} {new Date(s.snapshotDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}
                              </p>
                              <table className="report-data-table" style={{ fontSize: '0.8rem' }}>
                                <thead>
                                  <tr>
                                    <th>{t('loans.member')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('reports.shares_at_time') || 'Shares at Time'}</th>
                                    <th style={{ textAlign: 'right' }}>{t('reports.interest_expected')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('loans.paid')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('reports.cashed_out') || 'Cashed Out'}</th>
                                    <th style={{ textAlign: 'right' }}>{t('reports.interest_pending')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(s.distributions || []).map((d, j) => (
                                    <tr key={j}>
                                      <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{d.memberName}</td>
                                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="r-mono">{frw(d.sharesAtTime, language)}</td>
                                      <td style={{ textAlign: 'right' }} className="r-mono">{frw(d.expectedInterest, language)}</td>
                                      <td style={{ textAlign: 'right', color: '#10b981' }} className="r-mono">{frw(d.paidInterest, language)}</td>
                                      <td style={{ textAlign: 'right', color: '#f59e0b' }} className="r-mono">{frw(d.cashedOut, language)}</td>
                                      <td style={{ textAlign: 'right', color: Number(d.pending) > 0 ? '#ef4444' : 'var(--text-muted)' }} className="r-mono">
                                        {Number(d.pending) > 0 ? frw(d.pending, language) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Guarantors ───────────────────────────────────────────────────────
  const GuarantorPanel = () => {
    if (!reportData || !Array.isArray(reportData)) return <EmptyState t={t} />;
    const totalExposure = reportData.reduce((s, g) => s + Number(g.totalExposure), 0);
    const activeCount = reportData.filter(g => g.hasActive).length;
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <Scale size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.guarantors')}
          </h3>
          <span className="r-badge info">{reportData.length} {t('reports.nav.guarantors').toLowerCase()}</span>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.total_guarantors') || 'Total Guarantors'}   value={reportData.length}  variant="info"   />
          <SummaryCard label={t('reports.with_active_loans') || 'With Active Loans'}  value={activeCount}        variant="danger" />
          <SummaryCard label={t('reports.total_exposure') || 'Total Exposure'}     value={frw(totalExposure, language)} variant="accent" />
        </div>
        {reportData.length === 0 ? (
          <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <p style={{ fontSize: '0.875rem', margin: 0, color: '#10b981' }}>{t('reports.no_guarantors') || 'No guarantors on record.'}</p>
          </div>
        ) : (
          <div>
            {reportData.slice((guarantorPage - 1) * PAGE_SIZE, guarantorPage * PAGE_SIZE).map((g, i) => (
              <div key={i} className="r-guarantor-card">
                <div className="r-guarantor-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(234,179,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                      {g.guarantorName.charAt(0)}
                    </div>
                    <div>
                      <p className="r-guarantor-name">{g.guarantorName}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                        {g.totalLoans} {t('loans.loans_count')} {t('reports.guaranteed') || 'guaranteed'}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('reports.total_exposure') || 'Total Exposure'}</p>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: g.hasActive ? '#ef4444' : 'var(--text-muted)', margin: 0, fontFamily: 'Outfit' }}>{frw(g.totalExposure, language)}</p>
                  </div>
                </div>
                <table className="report-data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>{t('loans.borrower')}</th>
                      <th>{t('loans.loan_number')}</th>
                      <th style={{ textAlign: 'right' }}>{t('loans.loan_amount')}</th>
                      <th style={{ textAlign: 'right' }}>{t('loans.balance')}</th>
                      <th>{t('loans.status')}</th>
                      <th style={{ textAlign: 'right' }}>{t('expenditure.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(g.guaranteedLoans || []).map((loan, j) => (
                      <tr key={j}>
                        <td style={{ fontWeight: 600 }}>{loan.borrowerName}</td>
                        <td><span className="r-badge info">{loan.loanNumber}</span></td>
                        <td style={{ textAlign: 'right' }} className="r-mono">{frw(loan.principalAmount, language)}</td>
                        <td style={{ textAlign: 'right', color: Number(loan.remainingAmount) > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }} className="r-mono">
                          {Number(loan.remainingAmount) > 0 ? frw(loan.remainingAmount, language) : '—'}
                        </td>
                        <td>
                          <span className={`r-badge ${loan.loanStatus === 'ACTIVE' ? 'active' : loan.loanStatus === 'PAID' ? 'paid' : 'written-off'}`}>
                            {t(`loans.${loan.loanStatus?.toLowerCase()}`) || loan.loanStatus}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {new Date(loan.applicationDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <PaginationHelper page={guarantorPage} setPage={setGuarantorPage} totalItems={reportData.length} t={t} />
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Negative Interest ────────────────────────────────────────────────
  const NegativeInterestPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { year, threshold, members = [], totalDeficit, affectedCount } = reportData;
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <TrendingDown size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.negative_interest')} — {year}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('reports.year') || 'Year'}:</label>
            <select
              value={negativeInterestYear}
              onChange={(e) => setNegativeInterestYear(Number(e.target.value))}
              className="report-select"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="r-info-banner">
          <Info size={16} style={{ color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', margin: 0 }}>
            {t('reports.statute_rule') || 'Statute Rule DED-001'} : {t('reports.negative_interest_help') || 'Each member must earn at least 50k.'}
            {' '}
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{frw(threshold, language)}</span>
          </p>
        </div>
        <div className="report-summary-grid">
          <SummaryCard label={t('reports.threshold') || 'Threshold'}      value={frw(threshold, language)}   variant="info"   />
          <SummaryCard label={t('reports.active_members')} value={affectedCount}  variant="danger" />
          <SummaryCard label={t('reports.current_deficit')}  value={frw(totalDeficit, language)} variant="danger" />
        </div>
        {members.length === 0 ? (
          <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <p style={{ fontSize: '0.875rem', margin: 0, color: '#10b981' }}>
              {t('reports.no_negative_interest') || 'All members met the threshold.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('loans.member')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.interest_earned')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.threshold') || 'Threshold'}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.deficit_owed') || 'Deficit Owed'}</th>
                  <th>{t('reports.shortfall') || 'Shortfall'}</th>
                </tr>
              </thead>
              <tbody>
                {members.slice((negIntPage - 1) * PAGE_SIZE, negIntPage * PAGE_SIZE).map((m, i) => {
                  const rank = (negIntPage - 1) * PAGE_SIZE + i + 1;
                  const pct = Number(threshold) > 0
                    ? Math.min(100, Math.round(Number(m.earned) / Number(threshold) * 100)) : 0;
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rank}</td>
                      <td style={{ fontWeight: 600 }}>{m.memberName}</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b' }} className="r-mono">{frw(m.earned, language)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="r-mono">{frw(threshold, language)}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 700 }} className="r-mono">{frw(m.deficit, language)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div className="r-progress-track">
                            <div className="r-progress-fill danger" style={{ width: `${100 - pct}%` }} />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{100 - pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationHelper page={negIntPage} setPage={setNegIntPage} totalItems={members.length} />
          </div>
        )}
      </div>
    );
  };

  // ── Panel: Audit Log ────────────────────────────────────────────────────────
  const AuditLogPanel = () => {
    if (!reportData || Array.isArray(reportData)) return <EmptyState t={t} />;
    const { logs = [], total } = reportData;
    const paged = logs.slice((auditLogPage - 1) * PAGE_SIZE, auditLogPage * PAGE_SIZE);

    const getActionClass = (action = '') => {
      const a = action.toUpperCase();
      if (a.includes('LOAN')) return 'loan';
      if (a.includes('CONTRIB')) return 'contrib';
      if (a.includes('PENALTY')) return 'penalty';
      if (a.includes('MEMBER') || a.includes('USER')) return 'member';
      if (a.includes('SOCIAL') || a.includes('CLAIM')) return 'social';
      return 'system';
    };

    return (
      <div>
        <div className="report-panel-header">
          <h3 className="report-panel-title">
            <ClipboardList size={20} style={{ color: 'var(--accent)' }} />
            {t('reports.nav.audit_log')}
          </h3>
          <span className="r-badge info">{total} {t('reports.entries') || 'entries'}</span>
        </div>
        {logs.length === 0 ? (
          <EmptyState t={t} message={t('reports.no_audit_logs') || 'No audit log entries found.'} />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="report-data-table">
                <thead>
                  <tr>
                    <th>{t('reports.timestamp')}</th>
                    <th>{t('loans.member')}</th>
                    <th>{t('reports.action_type')}</th>
                    <th>{t('reports.entity')}</th>
                    <th>{t('expenditure.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((log, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleDateString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'))} {new Date(log.timestamp).toLocaleTimeString(language === 'fr' ? 'fr-FR' : (language === 'ky' ? 'rw-RW' : 'en-GB'), { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{log.actorName}</td>
                      <td>
                        <span className={`r-action-badge ${getActionClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {log.targetType}{log.targetId ? ` #${log.targetId.substring(0, 8)}` : ''}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationHelper page={auditLogPage} setPage={setAuditLogPage} totalItems={logs.length} t={t} />
          </>
        )}
      </div>
    );
  };

  // ── Panel Router ───────────────────────────────────────────────────────────
  const renderPanel = () => {
    if (loading) return <LoadingPanel t={t} />;
    if (!reportData) return <EmptyState t={t} message={t('reports.select_type')} />;
    switch (activeTab) {
      case 'monthly':            return <MonthlyPanel />;
      case 'annual-audit':       return <AnnualAuditPanel />;
      case 'outstanding-loans':  return <OutstandingLoansPanel />;
      case 'aging':              return <AgingPanel />;
      case 'loan-demand':        return <LoanDemandPanel />;
      case 'yield-analysis':     return <YieldAnalysisPanel />;
      case 'members':            return <MembersPanel />;
      case 'social-fund':        return <SocialFundPanel />;
      case 'contribution-ledger':return <ContributionLedgerPanel />;
      case 'penalty-summary':    return <PenaltySummaryPanel />;
      case 'interest-accrual':   return <InterestAccrualPanel />;
      case 'guarantors':         return <GuarantorPanel />;
      case 'negative-interest':  return <NegativeInterestPanel />;
      case 'audit-log':          return <AuditLogPanel />;
      default:                   return <EmptyState />;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1>{t('reports.title')}</h1>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            {t('reports.subtitle')}
          </p>
        </div>
      </div>

      <div className="reports-main-grid">

        {/* ── Left Column ────────────────────────────────────────────────── */}
        <div className="reports-left-col">

          {/* Report Navigation — top */}
          {canViewAdminReports && (
            <div className="report-nav" style={{ marginTop: 0 }}>
              {NAV_ITEMS.map((group) => (
                <div key={group.category}>
                  <div className="report-nav-category">
                    {group.icon}
                    {t(`reports.categories.${group.category}`)}
                  </div>
                  {group.items.map(({ key, label, Icon }) => (
                    <div key={key}>
                      <button
                        onClick={() => handleTabChange(key)}
                        className={`report-nav-item${activeTab === key ? ' active' : ''}`}
                      >
                        <span className="report-nav-dot" />
                        <Icon size={14} style={{ flexShrink: 0 }} />
                        {t(`reports.nav.${label}`)}
                      </button>
                      {key === 'monthly' && activeTab === 'monthly' && (
                        <div className="report-nav-filter">
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
                              className="report-select" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}>
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                <option key={m} value={m}>
                                  {t(`months.${new Date(2026, m - 1).toLocaleString('en-US', { month: 'long' }).toLowerCase()}`).substring(0, 3)}
                                </option>
                              ))}
                            </select>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                              className="report-select" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}>
                              <option value={2026}>2026</option>
                              <option value={2025}>2025</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Divider — only when something renders below the nav */}
          {(hasShares || canViewAdminReports) && (
            <div style={{ height: 1, background: 'var(--border-color)', margin: '1.25rem 0' }} />
          )}

          {/* My Documents — only for members with shares */}
          {hasShares && (
            <>
              <h2 className="report-section-title">
                <User size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {t('reports.my_documents') || 'My Documents'}
              </h2>
              <div className="glass-card report-card-accent" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.2rem', fontSize: '0.95rem' }}>{t('reports.individual_statement') || 'Individual Statement'}</h3>
                    <p className="text-muted" style={{ fontSize: '0.72rem', margin: 0 }}>
                      {t('reports.statement_help') || 'Full history: shares, loans, interest.'}
                    </p>
                  </div>
                  <div className="report-icon-badge"><FileText size={18} /></div>
                </div>
                <button onClick={() => downloadReport('statement')}
                  disabled={downloading === 'statement-statement'}
                  className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}>
                  {downloading === 'statement-statement'
                    ? <span className="animate-spin" style={spinStyle(14, 'var(--text-main)')} />
                    : <Download size={14} />}
                  {t('reports.download') || 'Download PDF'}
                </button>
              </div>
            </>
          )}

          {/* Statutory Reports */}
          {canViewAdminReports && (
            <>
              <h2 className="report-section-title" style={{ marginTop: '1.25rem' }}>
                <ShieldCheck size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {t('reports.statutory_reports') || 'Statutory Reports'}
              </h2>
              <div className="report-filter-card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label className="report-select-label">{t('reports.month') || 'Month'}</label>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="report-select">
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <option key={m} value={m}>
                          {t(`months.${new Date(2026, m - 1).toLocaleString('en-US', { month: 'long' }).toLowerCase()}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="report-select-label">{t('reports.year') || 'Year'}</label>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="report-select">
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                    </select>
                  </div>
                </div>
                <button onClick={() => downloadReport('monthly', { month: selectedMonth, year: selectedYear })}
                  disabled={downloading?.startsWith('monthly')}
                  className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}>
                  {downloading?.startsWith('monthly')
                    ? <span className="animate-spin" style={spinStyle(16, 'white')} />
                    : <Download size={16} />}
                  {t('reports.generate_monthly') || 'Generate Monthly PDF'}
                </button>
                <button onClick={() => downloadReport('annual', { year: selectedYear })}
                  disabled={downloading?.startsWith('annual')}
                  className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', marginTop: '0.5rem' }}>
                  {downloading?.startsWith('annual')
                    ? <span className="animate-spin" style={spinStyle(16, 'var(--text-main)')} />
                    : <BookOpen size={16} />}
                  {t('reports.generate_annual') || 'Generate Annual Audit PDF'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Right Column ───────────────────────────────────────────────── */}
        {canViewAdminReports && (
          <div>
            <div className="glass-card" style={{ minHeight: 460 }}>
              {renderPanel()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
