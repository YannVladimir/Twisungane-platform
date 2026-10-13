import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, Loader2, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, login } = useAuth();
  const { t, setLanguage } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || t('auth.invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-card">
        <div className="login-header">
          <img src="/twisungane-logo.webp" alt="Logo" className="login-logo" />
          <h1>{t('auth.title')}</h1>
          <p className="subtitle">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="auth-error">{error}</div>}
          
          <div className="input-group">
            <Mail size={18} className="input-icon" />
            <input 
              type="email" 
              placeholder={t('auth.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input 
              type="password" 
              placeholder={t('auth.password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><LogIn size={20} /> {t('auth.sign_in')}</>}
          </button>
        </form>

        <div className="login-footer">
          <button type="button" onClick={() => setLanguage('en')} className="lang-btn"><Globe size={14} /> English</button>
          <button type="button" onClick={() => setLanguage('ky')} className="lang-btn"><Globe size={14} /> Kinyarwanda</button>
          <button type="button" onClick={() => setLanguage('fr')} className="lang-btn"><Globe size={14} /> French</button>
        </div>
      </div>
    </div>
  );
}
