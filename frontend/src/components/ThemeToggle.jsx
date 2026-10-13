import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import authService from '../services/auth.service';

export default function ThemeToggle({ hideLabel }) {
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // 1. Check user preference from backend (via context)
    // 2. Fallback to localStorage
    const savedTheme = user?.preferredTheme || localStorage.getItem('theme');
    
    if (savedTheme === 'light') {
      setIsLight(true);
      document.body.classList.add('light-mode');
    } else {
      setIsLight(false);
      document.body.classList.remove('light-mode');
    }
  }, [user?.preferredTheme]);

  const toggleTheme = async () => {
    const nextTheme = !isLight;
    const themeStr = nextTheme ? 'light' : 'dark';
    
    setIsLight(nextTheme);
    if (nextTheme) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    
    localStorage.setItem('theme', themeStr);

    if (user) {
      try {
        await authService.updatePreferences({ theme: themeStr });
        updateUser({ preferredTheme: themeStr });
      } catch (err) {
        console.error('Failed to sync theme preference to server:', err);
      }
    }
  };

  const label = isLight ? t('nav.theme_dark') : t('nav.theme_light');

  return (
    <button onClick={toggleTheme} className="theme-toggle-btn" title={hideLabel ? label : ''}>
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
      {!hideLabel && <span>{isLight ? t('nav.theme') + ': ' + t('nav.theme_dark') : t('nav.theme') + ': ' + t('nav.theme_light')}</span>}
    </button>
  );
}
