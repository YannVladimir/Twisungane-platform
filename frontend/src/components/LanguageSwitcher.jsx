import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSwitcher({ isCollapsed }) {
  const { language, setLanguage, t } = useLanguage();

  const langs = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'fr', label: 'FR', full: 'French' },
    { code: 'ky', label: 'KY', full: 'Kinyarwanda' }
  ];

  if (isCollapsed) {
    return (
      <div className="language-selector collapsed" title={t('common.language') || 'Language'}>
        <Globe size={18} />
        <div className="language-dropdown">
          {langs.map(l => (
            <button 
              key={l.code} 
              className={language === l.code ? 'active' : ''}
              onClick={() => setLanguage(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="language-selector-premium">
      <Globe size={16} className="text-muted" />
      <div className="lang-options">
        {langs.map(l => (
          <button
            key={l.code}
            onClick={() => setLanguage(l.code)}
            className={`lang-btn ${language === l.code ? 'active' : ''}`}
            title={l.full}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
