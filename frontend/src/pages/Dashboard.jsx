import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Users, PiggyBank, ReceiptText, ShieldCheck, Activity, AlertTriangle, Heart, FilePieChart, ArrowDownLeft, ArrowUpRight, Clock, ExternalLink, ChevronLeft as ChevronLeftIcon, ChevronRight, History, TrendingUp, Wallet, Landmark, CalendarDays } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, LabelList } from 'recharts'
import api from '../services/api.js'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { frw } from '../utils/i18nHelper'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [activities, setActivities] = useState([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const { user } = useAuth()
  const { t, language } = useLanguage()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/v1/dashboard/stats')
        setStats(res.data)
      } catch (err) {
        setFetchError('Could not load dashboard statistics. Please refresh the page.')
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

  useEffect(() => {
    const fetchActivities = async () => {
      if (!['ROLE_ADMIN', 'ROLE_PRESIDENT', 'ROLE_FINANCE'].includes(user?.role)) {
        setLoadingActivities(false)
        return
      }
      try {
        const res = await api.get('/api/v1/audit-logs?page=0&size=7')
        setActivities(res.data.content || [])
      } catch (err) {
        setFetchError('Could not load recent activity. Please refresh the page.')
      } finally {
        setLoadingActivities(false)
      }
    }
    fetchActivities()
  }, [user])



  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

  return (
    <div className="dashboard-content animate-in space-y-8 pb-20">
      <header className="page-header">
        <div className="header-info">
          <h1>{t('dashboard.system_overview')}</h1>
          <p className="text-muted">{t('dashboard.system_overview_sub')}</p>
        </div>
      </header>

      {fetchError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} />
          <span>{fetchError}</span>
          <button onClick={() => setFetchError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Primary Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="reveal-up stagger-1">
          <StatCard 
            title={t('dashboard.total_shares')} 
            value={frw(stats?.totalShares || 0, language)} 
            icon={<PiggyBank size={18} />}
            loading={loadingStats}
            detail={`${Math.floor((stats?.totalShareCount || 0) * 2) / 2} ${t('dashboard.interest_shares')} ${t('dashboard.shares_among')} ${stats?.activeMembers || 0} ${t('dashboard.members')}`}
          />
        </div>
        <div className="reveal-up stagger-2">
          <StatCard 
            title={t('dashboard.active_loans')} 
            value={frw(stats?.activeLoans || 0, language)} 
            icon={<ArrowUpRight size={18} />}
            loading={loadingStats}
            detail={`${t('dashboard.supporting')} ${stats?.activeLoanUsers || 0} ${t('dashboard.members')}`}
          />
        </div>
        <div className="reveal-up stagger-3">
          <StatCard 
            title={t('dashboard.social_fund')} 
            value={frw(stats?.socialFundTotal || 0, language)} 
            icon={<Heart size={18} />}
            loading={loadingStats}
            detail={`${Math.floor((stats?.socialShareCount || 0) * 2) / 2} ${t('dashboard.interest_shares')}`}
          />
        </div>
      </section>

      {/* Analytics Main Grid */}
      <section className="dashboard-main-v2">
        <div className="analytics-primary flex flex-col" style={{ gap: '2rem' }}>
          {/* Cash Flow Chart */}
          <div className="reveal-up stagger-1">
            <div className="glass-card overflow-hidden">
            <div className="glass-card-header p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg">{t('dashboard.monthly_cash_flow')}</h3>
                  <p className="text-xs text-muted">{t('dashboard.income_expense_period')}</p>
                </div>
              </div>
            </div>
            <div className="w-full p-6 pt-0" style={{ height: '300px' }}>
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.flowChart || []}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                      tickFormatter={(val) => `${(val/1000)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorIncome)" 
                      strokeWidth={3} 
                      animationDuration={1500}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expense" 
                      stroke="#f43f5e" 
                      fillOpacity={1} 
                      fill="url(#colorExpense)" 
                      strokeWidth={3} 
                      animationDuration={2000}
                    />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Interest Projection */}
          <div className="reveal-up stagger-2">
            <div className="glass-card">
              <div className="glass-card-header p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-main" style={{ fontSize: '18px', margin: 0, lineHeight: 1.2 }}>{t('dashboard.interest_projection')}</h3>
                    <p className="text-muted" style={{ fontSize: '12px', margin: 0, marginTop: '2px' }}>{t('dashboard.revenue_forecasting')}</p>
                  </div>
                </div>
              </div>
              <div className="w-full pt-0" style={{ height: '290px', padding: '8px 24px 16px 8px' }}>
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.interestProjectionChart || []} margin={{ top: 28, right: 10, left: 0, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                       <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }} />
                       <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickFormatter={(val) => val > 0 ? `${(val/1000).toFixed(0)}k` : ''} />
                       <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 14px' }} itemStyle={{ fontSize: '12px' }} formatter={(val) => [frw(val, language), undefined]} />
                       <Bar dataKey="historical" name={t('dashboard.collected')} stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} animationDuration={1500}>
                          <LabelList dataKey="historical" position="top" style={{ fill: '#10b981', fontSize: '10px', fontWeight: 700 }} formatter={(v) => v > 0 ? `${(v/1000).toFixed(1)}k` : ''} />
                       </Bar>
                       <Bar dataKey="projected" name={t('dashboard.projected')} stackId="a" fill="#818cf8" fillOpacity={0.5} radius={[4, 4, 0, 0]} animationDuration={2000}>
                          <LabelList dataKey="projected" position="top" style={{ fill: '#818cf8', fontSize: '10px', fontWeight: 700 }} formatter={(v) => v > 0 ? `${(v/1000).toFixed(1)}k` : ''} />
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Repayment Schedule Calendar */}
          <div className="reveal-up stagger-3">
            <PaymentCalendar upcomingPayments={stats?.upcomingPayments || []} />
          </div>
        </div>

        {/* Redesigned Sidebar Pulse */}
        <div className="analytics-sidebar flex flex-col" style={{ gap: '2rem' }}>
          {/* Availability Widget Moved to Top of Sidebar */}
          <div className="reveal-up stagger-1">
            <div className="glass-card overflow-hidden border-[var(--border-color)] relative" style={{ background: 'var(--card-bg)' }}>
               <div className="absolute right-0 top-0 w-48 h-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }}></div>
               
               <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="text-indigo-500" style={{ display: 'flex' }}>
                     <Landmark size={20} />
                  </div>
                  <div>
                     <h3 className="font-bold text-main" style={{ fontSize: '16px', margin: 0, lineHeight: 1.2 }}>{t('dashboard.available_liquidity')}</h3>
                     <p className="text-muted" style={{ fontSize: '11px', margin: 0, marginTop: '2px' }}>{t('dashboard.ready_for_loans')}</p>
                  </div>
               </div>
               
               <div className="p-6 pt-2 pb-4">
                  <div style={{ padding: '0.75rem 0 1.25rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>{t('dashboard.available_now')}</span>
                     <span className="font-black text-main" style={{ fontSize: '22px', letterSpacing: '-0.05em', color: (stats?.totalLiquidity || 0) < 500000 ? '#f43f5e' : (stats?.totalLiquidity || 0) <= 2000000 ? '#b45309' : '#10b981' }}>
                       {frw(stats?.totalLiquidity || 0, language)}
                     </span>
                  </div>
                  
                  <div style={{ padding: '1rem 0', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">📦 {t('dashboard.shares_pool')}</span>
                        <span className="font-bold text-main">{frw(stats?.sharesPool || 0, language)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">❤️ {t('dashboard.social_fund_credit')}</span>
                        <span className="font-bold text-main">{frw(stats?.socialFundTotal || 0, language)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">💰 {t('dashboard.interest_pool')}</span>
                        <span className="font-bold text-main">{frw(stats?.interestPool || 0, language)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">🏦 {t('dashboard.bank_fees')}</span>
                        <span className="font-bold text-main">{frw(stats?.bankFeesBalance || 0, language)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">🔒 {t('dashboard.obligatory_reserve')}</span>
                        <span className="font-bold text-main">{frw(stats?.obligatoryReservePool || 0, language)}</span>
                     </div>
                     <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted font-semibold">📤 {t('dashboard.active_loans_out')}</span>
                        <span className="font-bold" style={{ color: '#f43f5e' }}>- {frw(stats?.activeLoans || 0, language)}</span>
                     </div>
                  </div>
               </div>
               
               <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(16,185,129,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                     <span className="text-muted font-semibold uppercase" style={{ letterSpacing: '0.08em' }}>{t('dashboard.reserve_status')}</span>
                     <span className="font-bold px-3 py-1 rounded" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>✓ {t('dashboard.optimal')}</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Equity Growth Tracker */}
          {['ROLE_ADMIN', 'ROLE_PRESIDENT'].includes(user?.role) && (
            <div className="sticky top-8 z-20 reveal-up stagger-2">
              <EquityGrowthChart 
                data={stats?.equityGrowthChart || []} 
                loading={loadingStats} 
              />
            </div>
          )}

          {['ROLE_ADMIN', 'ROLE_PRESIDENT', 'ROLE_FINANCE'].includes(user?.role) && (
            <div className="reveal-up stagger-3">
              <div className="glass-card flex flex-col shadow-xl">
              <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--item-bg)] border border-[var(--border-color)] text-main shadow-sm">
                      <History size={18} />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">{t('dashboard.system_pulse')}</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                     <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                     <span className="text-[10px] text-red-600 font-bold tracking-widest uppercase">{t('dashboard.live')}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-0 relative">
                {loadingActivities ? (
                   <div className="p-6">
                     {[1,2,3,4,5].map(i => <div key={i} className="flex gap-4 mb-6"><div className="w-4 h-4 rounded-full bg-[var(--item-bg)] border border-[var(--border-color)]"></div><div className="flex-1 skeleton-item h-12 rounded-xl"></div></div>)}
                   </div>
                ) : activities.length === 0 ? (
                   <div className="text-center py-20 opacity-40">No activity feed</div>
                ) : (
                   activities.slice(0, 5).map((log, idx) => {
                     const actionObj = log.action || '';
                     let colorObj = { fill: 'var(--accent)', bg: 'rgba(99,102,241,0.1)' };
                     if (actionObj.includes('DISBURSED') || actionObj.includes('APPROVED') || actionObj.includes('REGISTERED') || actionObj.includes('SUBMITTED')) colorObj = { fill: '#6366f1', bg: 'rgba(99,102,241,0.1)' };
                     if (actionObj.includes('RECORDED') || actionObj.includes('REPAYMENT') || actionObj.includes('PURCHASE') || actionObj.includes('PAID')) colorObj = { fill: '#10b981', bg: 'rgba(16,185,129,0.1)' };
                     if (actionObj.includes('REJECTED') || actionObj.includes('EXPENSE')) colorObj = { fill: '#f43f5e', bg: 'rgba(244,63,94,0.1)' };
                     
                     return (
                      <div key={log.id} style={{ display: 'flex', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="group transition-colors hover:bg-[rgba(255,255,255,0.01)] last:border-b-0">
                         {/* Colored Accent Strip */}
                         <div style={{ width: '4px', borderRadius: '4px', background: colorObj.fill, flexShrink: 0 }}></div>
                         
                         {/* Log Content */}
                         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <p style={{ fontSize: '13px', fontWeight: 500, margin: 0, color: 'var(--text-main)', lineHeight: 1.5 }}>
                              {log.message}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '11px', color: 'var(--text-muted)' }}>
                               <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--item-bg)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                                  <Clock size={11} /> {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                               <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500 }}>
                                  <Users size={12} opacity={0.6} /> {log.actorName}
                               </span>
                            </div>
                         </div>
                      </div>
                     )
                   })
                )}
              </div>
              
              <div className="p-6 pt-0 mt-auto">
                  <button 
                    onClick={() => {
                      const event = new CustomEvent('nav-change', { detail: 'activities' });
                      window.dispatchEvent(event);
                    }}
                    className="w-full py-3 rounded-xl bg-accent text-accent-content text-xs font-black hover:scale-[1.02] transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2"
                  >
                    {t('dashboard.full_timeline')} <ExternalLink size={14} />
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </section>
    </div>
  )
}

function EquityGrowthChart({ data = [], loading }) {
  const { t } = useLanguage();
  if (loading) return (
     <div className="glass-card p-6">
        <div className="skeleton h-48 rounded-xl"></div>
     </div>
  );

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="font-bold text-main" style={{ fontSize: '16px', margin: 0 }}>{t('dashboard.equity_growth')}</h3>
            <p className="text-muted" style={{ fontSize: '11px', margin: 0 }}>{t('dashboard.cumulative_shares')}</p>
          </div>
        </div>
      </div>
      <div className="p-2" style={{ height: '220px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} 
            />
            <YAxis 
               axisLine={false}
               tickLine={false}
               tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
               tickFormatter={(val) => val > 0 ? `${(val/1000000).toFixed(1)}M` : ''}
            />
            <Tooltip 
              contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
              itemStyle={{ fontSize: '10px' }}
              labelStyle={{ fontSize: '10px', color: '#888' }}
              formatter={(val) => [`${Number(val).toLocaleString()} FRW`, t('dashboard.total_equity')]}
            />
            <Area 
              type="monotone" 
              dataKey="total" 
              stroke="#6366f1" 
              fillOpacity={1} 
              fill="url(#colorEquity)" 
              strokeWidth={3} 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, icon, loading, detail }) {
  const { language } = useLanguage();
  if (loading) {
    return (
      <div className="stat-card skeleton-card">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-value"></div>
        <div className="skeleton skeleton-trend"></div>
      </div>
    )
  }
  return (
    <div className="stat-card group hover:scale-[1.02] transition-all flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <p className="stat-title">{title}</p>
          <div className="p-2 rounded-lg bg-white/5 text-muted group-hover:text-accent group-hover:bg-accent/10 transition-all">
            {icon}
          </div>
        </div>
        <div className="stat-value-group">
          <span className="stat-value tracking-tighter">{value}</span>
          <span className="stat-unit">{unit}</span>
        </div>
      </div>
      {detail && (
        <div className="mt-3 flex items-center gap-2">
           <div style={{ color: '#b45309' }}>
             <Activity size={14} strokeWidth={2.5} />
           </div>
           <span style={{ fontSize: '12px', fontWeight: '600', color: '#b45309' }}>{detail}</span>
        </div>
      )}
    </div>
  )
}

function PaymentCalendar({ upcomingPayments = [] }) {
  const { t, language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activePopup, setActivePopup] = useState(null); // tracks which day's popup is open
  
  // Close popup when clicking outside
  useEffect(() => {
    if (!activePopup) return;
    const close = () => setActivePopup(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [activePopup]);
  
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); 
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const paymentsByDay = {};
  if (upcomingPayments && Array.isArray(upcomingPayments)) {
     upcomingPayments.forEach(payment => {
       if (payment.dueDate) {
         // Safely parse "YYYY-MM-DD" to avoid timezone drift hiding the data
         const parts = payment.dueDate.split('-');
         if (parts.length >= 3) {
            const pYear = parseInt(parts[0], 10);
            const pMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
            const pDay = parseInt(parts[2], 10);
            
            if (pYear === year && pMonth === month) {
              if (!paymentsByDay[pDay]) paymentsByDay[pDay] = [];
              paymentsByDay[pDay].push(payment);
            }
         }
       }
     });
  }

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = [
    t('months.january') || 'January', t('months.february') || 'February', t('months.march') || 'March',
    t('months.april') || 'April', t('months.may') || 'May', t('months.june') || 'June',
    t('months.july') || 'July', t('months.august') || 'August', t('months.september') || 'September',
    t('months.october') || 'October', t('months.november') || 'November', t('months.december') || 'December'
  ];

  const formatAmount = (amount) => {
    return frw(amount, language);
  }
  
  const generateColor = (name) => {
    const colors = [
      { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.35)' },
      { background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.35)' },
      { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' },
      { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)' },
      { background: 'rgba(217,70,239,0.12)', color: '#e879f9', border: '1px solid rgba(217,70,239,0.35)' },
      { background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.35)' },
      { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.35)' },
      { background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.35)' },
    ];
    let hash = 0;
    if (name) {
       for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-[var(--border-color)]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
           <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <CalendarDays size={20} />
           </div>
           <div>
             <h3 className="font-bold text-main" style={{ fontSize: '18px', margin: 0, lineHeight: 1.2 }}>{t('dashboard.repayment_schedule')}</h3>
             <p className="text-muted" style={{ fontSize: '12px', margin: 0, marginTop: '2px' }}>{t('dashboard.upcoming_payments')}</p>
           </div>
         </div>
         <div className="bg-[var(--card-bg)] px-4 py-2 rounded-lg border border-[var(--border-color)] shadow-sm" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <button onClick={handlePrevMonth} className="text-muted hover:text-accent transition-colors" style={{ display: 'flex', alignItems: 'center' }}><ChevronLeftIcon size={16}/></button>
           <span className="font-bold text-main" style={{ fontSize: '14px', minWidth: '120px', textAlign: 'center' }}>{monthNames[month]} {year}</span>
           <button onClick={handleNextMonth} className="text-muted hover:text-accent transition-colors" style={{ display: 'flex', alignItems: 'center' }}><ChevronRight size={16}/></button>
         </div>
      </div>
      
      <div className="p-6 bg-[var(--item-bg)]">
        <div className="mb-3 text-center font-bold text-muted uppercase tracking-widest" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', fontSize: '10px' }}>
           {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => <div key={d}>{t(`common.${d}`) || d}</div>)}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
           {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="rounded-xl bg-[var(--card-bg)] opacity-30 border border-transparent" style={{ minHeight: '90px' }}></div>
           ))}
           {days.map(day => {
             const dayPayments = paymentsByDay[day] || [];
             const d = new Date();
             const isToday = d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
             
             return (
               <div key={`day-${day}`} className={`rounded-xl border p-2 transition-all cursor-default relative overflow-hidden ${isToday ? 'border-accent bg-accent/5' : 'border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--item-hover)]'}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '90px', boxShadow: isToday ? 'inset 0 0 20px rgba(var(--accent-rgb),0.1)' : 'none' }}>
                 <div className="mb-2 relative z-10" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <span className={`font-bold leading-none ${isToday ? 'text-accent' : 'text-main'}`} style={{ fontSize: '12px' }}>{day}</span>
                   {dayPayments.length > 0 && <span className="font-bold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded shadow-sm" style={{ fontSize: '9px' }}>{dayPayments.length} due</span>}
                 </div>
                 
                 <div className="flex-grow relative z-10" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '0.375rem' }}>
                   {dayPayments.length === 1 ? (
                      // Single user: vivid inline-styled color chip
                      (() => {
                        const p = dayPayments[0];
                        const colorStyle = generateColor(p.member);
                        return (
                          <div style={{ ...colorStyle, display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 6px', borderRadius: '6px', fontSize: '9px', cursor: 'default' }}>
                            <div style={{ fontWeight: 700, fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.member.split(' ')[0]}</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 600, opacity: 0.9 }}>{formatAmount(p.amountExpected)} FRW</div>
                          </div>
                        )
                      })()
                   ) : dayPayments.length > 1 ? (
                      // Multiple users: clickable badge → popup
                      (() => {
                        const total = dayPayments.reduce((sum, p) => sum + Number(p.amountExpected), 0);
                        const popupKey = `${year}-${month}-${day}`;
                        const isOpen = activePopup === popupKey;
                        return (
                          <div style={{ position: 'relative' }}>
                            {/* Compact badge — click to toggle popup */}
                            <div
                              onClick={(e) => { e.stopPropagation(); setActivePopup(isOpen ? null : popupKey); }}
                              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 6px', borderRadius: '6px', fontSize: '9px', cursor: 'pointer', userSelect: 'none' }}
                            >
                              <div style={{ fontWeight: 700, fontSize: '10px' }}>{dayPayments.length} payments ▾</div>
                              <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatAmount(total)} FRW</div>
                            </div>
                            {/* Popup panel */}
                            {isOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '6px', minWidth: '190px', zIndex: 999, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px', boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}
                              >
                                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6, color: 'var(--text-main)', marginBottom: '8px' }}>{dayPayments.length} Due This Day</div>
                                {dayPayments.map((p, idx) => {
                                  const cs = generateColor(p.member);
                                  return (
                                    <div key={idx} style={{ ...cs, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', gap: '8px', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{p.member}</span>
                                      <span style={{ fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatAmount(p.amountExpected)}</span>
                                    </div>
                                  );
                                })}
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: 'var(--text-main)' }}>
                                  <span>Total:</span>
                                  <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatAmount(total)} FRW</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()
                   ) : null}
                 </div>
               </div>
             )
           })}
        </div>
      </div>
    </div>
  )
}

