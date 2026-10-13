import { useState, useEffect } from 'react'
import { X, PiggyBank, Check, AlertCircle, UserCheck } from 'lucide-react'
import api from '../services/api.js'
import { useLanguage } from '../context/LanguageContext'
import { frw } from '../utils/i18nHelper'

export default function AddSharesModal({ isOpen, onClose, member, onSharesAdded }) {
  const [shares, setShares] = useState(1);
  const [reference, setReference] = useState('');
  const [datePurchased, setDatePurchased] = useState('');
  const [guarantorId, setGuarantorId] = useState('');
  const [members, setMembers] = useState([]);
  const [sharePrice, setSharePrice] = useState(100000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t, language } = useLanguage();

  useEffect(() => {
    if (isOpen && member) {
      setGuarantorId(member.guarantorId || '');
      setShares(1);
      setReference('');
      setDatePurchased(new Date().toISOString().split('T')[0]);
      setError('');
      api.get('/api/v1/members')
        .then(res => setMembers((res.data || []).filter(m => m.id !== member.id)))
        .catch(() => {});
      api.get('/api/v1/admin/config')
        .then(res => {
          const cfg = (res.data || []).find(c => c.configKey === 'sharePrice');
          if (cfg) setSharePrice(Number(cfg.configValue));
        })
        .catch(() => {});
    }
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const guarantorChanged = guarantorId !== (member.guarantorId || '');
      if (guarantorChanged) {
        const formDataToSend = new FormData();
        const requestBlob = new Blob([JSON.stringify({
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone,
          nationalId: member.nationalId,
          joinDate: member.joinDate,
          dateOfBirth: member.dateOfBirth,
          role: member.role,
          guarantorId: guarantorId || null
        })], { type: 'application/json' });
        formDataToSend.append('request', requestBlob);
        await api.put(`/api/v1/members/${member.id}`, formDataToSend, {});
      }

      const amount = shares * sharePrice;
      const dateParam = datePurchased ? `&datePurchased=${datePurchased}` : '';
      await api.post(`/api/v1/members/${member.id}/shares?amount=${amount}&reference=${reference}${dateParam}`, {});

      onSharesAdded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || t('common.system_error'));
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = shares * sharePrice;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        
        <div className="wizard-header">
          <div className="wizard-header-top" style={{ marginBottom: 0 }}>
            <div className="wizard-title-box">
              <div className="wizard-icon">
                <PiggyBank size={24} />
              </div>
              <div>
                <h3 className="wizard-title">{t('members.add_shares_title')}</h3>
                <p className="wizard-subtitle">{member.firstName} {member.lastName}</p>
              </div>
            </div>
            <button onClick={onClose} className="wizard-close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="wizard-body">
          <div style={{ padding: '2rem' }}>
            
            <div className="wizard-finance-card" style={{ marginBottom: '1.5rem', background: 'rgba(234, 179, 8, 0.05)' }}>
               <div>
                  <p className="wizard-subtitle" style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t('members.mandatory_share_price')}</p>
                  <h4 className="wizard-finance-price" style={{ color: 'var(--accent)' }}>{frw(sharePrice, language)}</h4>
               </div>
            </div>

            <div className="wizard-form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="pill-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label>{t('members.shares_to_add')}</label>
                </div>
                <div className="pill-input-wrapper">
                  <input 
                    type="number" min="0.5" step="0.5" required autoFocus
                    className="pill-input"
                    style={{ fontSize: '1.25rem', fontWeight: '900' }}
                    value={shares}
                    onChange={(e) => {
                      const val = e.target.value;
                      setShares(val === '' ? '' : parseFloat(val));
                    }}
                  />
                </div>
              </div>

              <div className="pill-group pill-group-read-only">
                <label>{t('members.total_cost')}</label>
                <div className="pill-input-wrapper">
                  <div className="pill-input" style={{ display: 'flex', alignItems: 'center', fontSize: '1.25rem', fontWeight: '900' }}>
                     {frw(Number(shares) * sharePrice, language)}
                  </div>
                </div>
              </div>
            </div>

            <div className="wizard-form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="pill-group">
                <label>{t('members.transaction_reference')}</label>
                <div className="pill-input-wrapper">
                  <input
                    type="text" placeholder={t('members.transaction_reference_placeholder')}
                    className="pill-input"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="pill-group">
                <label>{t('members.purchase_date')}</label>
                <div className="pill-input-wrapper">
                  <input
                    type="date" required
                    className="pill-input"
                    value={datePurchased}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDatePurchased(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
              <label>{t('members.guarantor')}</label>
              <div className="pill-input-wrapper">
                <div className="pill-input-icon"><UserCheck size={18} /></div>
                <select
                  className="pill-input"
                  style={{ appearance: 'none' }}
                  value={guarantorId}
                  onChange={(e) => setGuarantorId(e.target.value)}
                >
                  <option value="">{t('members.guarantor_placeholder')}</option>
                  {members
                    .filter(m => m.role !== 'ROLE_ADMIN' && m.role !== 'ROLE_PRESIDENT' && m.type !== 'SOCIAL' && m.id !== member?.id)
                    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}{m.guarantorName ? ` (${m.guarantorName})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="wizard-error-box" style={{ marginBottom: '1.5rem' }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}
          </div>

          <div className="wizard-actions">
            <button 
              type="button" 
              className="wizard-btn wizard-btn-secondary"
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button 
              type="submit" disabled={loading}
              className="wizard-btn wizard-btn-primary"
            >
              {loading ? t('members.processing') : (
                <>{t('members.record_payment')} <Check size={20} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
