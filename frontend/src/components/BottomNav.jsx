import { LayoutDashboard, Users, PiggyBank, ReceiptText, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNav({ activeTab, setActiveTab }) {
  const { t } = useLanguage();
  const user = JSON.parse(localStorage.getItem('user'));
  const isPresident = user?.role === 'ROLE_PRESIDENT';

  const items = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: t('nav.home') },
    { id: 'members', icon: <Users size={20} />, label: t('nav.members') },
    { id: 'loans', icon: <PiggyBank size={20} />, label: t('nav.loans') },
    { id: 'contributions', icon: <ReceiptText size={20} />, label: t('nav.payments') },
    ...(isPresident ? [{ id: 'approvals', icon: <ShieldCheck size={20} />, label: t('nav.approvals') }] : []),
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => setActiveTab(item.id)}
        >
          {item.icon}
          <span className="mobile-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
