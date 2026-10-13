import { createContext, useContext, useState, useEffect } from 'react';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import ky from '../i18n/ky.json';
import { useAuth } from './AuthContext';
import authService from '../services/auth.service';

const LanguageContext = createContext(null);

const translations = { en, fr, ky };

export const LanguageProvider = ({ children }) => {
  const { user, updateUser } = useAuth();
  const [language, setLang] = useState('en');

  // Sync with user preferences on login or when they change
  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== language) {
      setLang(user.preferredLanguage);
    }
  }, [user?.preferredLanguage]);

  const setLanguage = async (newLang) => {
    if (!translations[newLang]) return;
    
    setLang(newLang);
    
    // If user is logged in, persist to backend
    if (user) {
      try {
        const updated = await authService.updatePreferences({ language: newLang });
        if (updated) {
          updateUser({ preferredLanguage: newLang });
        }
      } catch (err) {
        console.error('Failed to sync language preference to server:', err);
      }
    }
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        // Fallback to English if current language is missing the key
        let fallback = translations['en'];
        for (const fk of keys) {
          if (fallback && fallback[fk]) {
            fallback = fallback[fk];
          } else {
            return key; // Final fallback: return the key itself
          }
        }
        return fallback;
      }
    }
    return value;
  };

  return (
    <LanguageContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
