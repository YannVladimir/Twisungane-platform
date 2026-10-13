import { useState, useEffect, Suspense } from 'react'
import { 
  LayoutDashboard, Users, PiggyBank, ReceiptText, ShieldCheck, 
  Settings, Globe, LogOut, ChevronLeft, Menu, AlertTriangle, 
  Heart, FilePieChart, Activity, ArrowUpRight, History, Loader2
} from 'lucide-react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useLanguage } from './context/LanguageContext'
import { getLocale } from './utils/i18nHelper'
import ThemeToggle from './components/ThemeToggle'
import BottomNav from './components/BottomNav'
import LanguageSwitcher from './components/LanguageSwitcher'
import axios from 'axios'

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const { t, language } = useLanguage()

  const getActiveTab = () => {
    const path = location.pathname
    if (path === '/dashboard' || path === '/dashboard/') return 'dashboard'
    const parts = path.split('/')
    return parts[parts.length - 1]
  }

  const activeTab = getActiveTab()

  const handleTabChange = (tab) => {
    if (tab === 'dashboard') {
      navigate('/dashboard')
    } else {
      navigate(`/dashboard/${tab}`)
    }
  }

  useEffect(() => {
    const handleNav = (e) => {
      if (e.detail) {
        handleTabChange(e.detail);
      }
    };
    window.addEventListener('nav-change', handleNav);
    return () => window.removeEventListener('nav-change', handleNav);
  }, [navigate]);
  return (
    <div className={`app-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Premium Sidebar - Hidden on mobile */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <img src="/twisungane-logo.webp" alt="Twisungane Logo" className="logo" />
            {!isCollapsed && <h1 className="logo-text">TWISUNGANE</h1>}
          </div>
          <button className="collapse-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        
        <nav className="nav-menu">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label={t('nav.dashboard')} 
            isActive={activeTab === 'dashboard'} 
            onClick={() => handleTabChange('dashboard')} 
            isCollapsed={isCollapsed}
          />
          <NavItem 
            icon={<Users size={20} />} 
            label={t('nav.members')} 
            isActive={activeTab === 'members'} 
            onClick={() => handleTabChange('members')} 
            isCollapsed={isCollapsed}
          />
          <NavItem 
            icon={<PiggyBank size={20} />} 
            label={t('nav.loans')} 
            isActive={activeTab === 'loans'} 
            onClick={() => handleTabChange('loans')} 
            isCollapsed={isCollapsed}
          />
          {user?.role === 'ROLE_PRESIDENT' && (
            <NavItem
              icon={<ShieldCheck size={20} />}
              label={t('nav.approvals')}
              isActive={activeTab === 'approvals'}
              onClick={() => handleTabChange('approvals')}
              isCollapsed={isCollapsed}
            />
          )}
          <NavItem 
            icon={<Activity size={20} />} 
            label={t('nav.interests')} 
            isActive={activeTab === 'interests'} 
            onClick={() => handleTabChange('interests')} 
            isCollapsed={isCollapsed}
          />
          <NavItem 
            icon={<ReceiptText size={20} />} 
            label={t('nav.contributions')} 
            isActive={activeTab === 'contributions'} 
            onClick={() => handleTabChange('contributions')} 
            isCollapsed={isCollapsed}
          />
          <NavItem 
            icon={<ArrowUpRight size={20} />} 
            label={t('nav.expenditure')} 
            isActive={activeTab === 'expenditure'} 
            onClick={() => handleTabChange('expenditure')} 
            isCollapsed={isCollapsed}
          />
          <NavItem 
            icon={<FilePieChart size={20} />} 
            label={t('nav.reports')} 
            isActive={activeTab === 'reports'} 
            onClick={() => handleTabChange('reports')} 
            isCollapsed={isCollapsed}
          />
          <div className="nav-divider"></div>
          {(user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_PRESIDENT' || user?.role === 'ROLE_FINANCE') && (
            <NavItem 
              icon={<History size={20} />} 
              label={t('nav.activities')} 
              isActive={activeTab === 'activities'} 
              onClick={() => handleTabChange('activities')} 
              isCollapsed={isCollapsed}
            />
          )}
          {user?.role === 'ROLE_ADMIN' && (
            <NavItem 
              icon={<Settings size={20} />} 
              label={t('nav.settings')} 
              isActive={activeTab === 'settings'} 
              onClick={() => handleTabChange('settings')} 
              isCollapsed={isCollapsed}
            />
          )}
        </nav>

        <div className="secondary-actions">
          <ThemeToggle hideLabel={isCollapsed} />
          <LanguageSwitcher isCollapsed={isCollapsed} />
          <button onClick={logout} className="nav-item" title={isCollapsed ? t('nav.logout') : ""}>
            <LogOut size={20} />
            {!isCollapsed && <span>{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-bar">
          <div className="container-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div className="welcome-text">
              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.25rem' }}>{t('common.welcome')}, <span className="highlight">{user?.firstName || 'User'}</span></h2>
              <p className="text-muted">{new Date().toLocaleDateString(getLocale(language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="user-profile">
              <div className="avatar">{user?.firstName?.charAt(0) || 'U'}</div>
            </div>
          </div>
        </header>

        <div className="container-premium">
          <Suspense fallback={
            <div className="flex justify-center items-center min-h-[40vh]">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Floating Bottom Nav for Mobile */}
      <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} />
    </div>
  )
}

function NavItem({ icon, label, isActive, onClick, isCollapsed }) {
  return (
    <button 
      className={`nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`} 
      onClick={onClick} 
      title={isCollapsed ? label : ''}
    >
      {icon}
      {!isCollapsed && <span>{label}</span>}
    </button>
  )
}

