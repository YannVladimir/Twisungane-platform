import { useState, useEffect } from 'react'
import { X, ArrowRightLeft, Check, AlertCircle, UserMinus, UserPlus } from 'lucide-react'
import api from '../services/api.js'
import { useLanguage } from '../context/LanguageContext'
import { frw } from '../utils/i18nHelper'

export default function TransferSharesModal({ isOpen, onClose, sender, members, onTransferComplete }) {
  const [recipientId, setRecipientId] = useState('');
  const [shares, setShares] = useState(1);
  const [reference, setReference] = useState('');
  const [sharePrice, setSharePrice] = useState(100000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t, language } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;
    api.get('/api/v1/admin/config')
      .then(res => {
        const cfg = (res.data || []).find(c => c.configKey === 'sharePrice');
        if (cfg) setSharePrice(Number(cfg.configValue));
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen || !sender) return null;

  // Filter out the sender from the recipients list
  const possibleRecipients = members.filter(m => m.id !== sender.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipientId) {
      setError(t('members.select_member'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const amountFRW = shares * sharePrice;

      await api.post(`/api/v1/members/${sender.id}/transfer/${recipientId}?amount=${amountFRW}&reference=${reference}`, {});

      onTransferComplete();
      onClose();
      // Reset
      setRecipientId('');
      setShares(1);
      setReference('');
    } catch (err) {
      setError(err.response?.data?.message || t('common.system_error'));
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = shares * sharePrice;
  const senderBalance = sender.totalShares || 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '440px' }}>
        
        <div className="wizard-header">
          <div className="wizard-header-top" style={{ marginBottom: 0 }}>
            <div className="wizard-title-box">
              <div className="wizard-icon" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                <ArrowRightLeft size={24} />
              </div>
              <div>
                <h3 className="wizard-title">{t('members.transfer_title')}</h3>
                <p className="wizard-subtitle">{t('common.administrator_action')}</p>
              </div>
            </div>
            <button onClick={onClose} className="wizard-close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="wizard-body">
          <div style={{ padding: '2rem' }}>
            
            {/* Sender Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(234, 179, 8, 0.05)', borderRadius: '16px', border: '1px solid rgba(234, 179, 8, 0.1)', marginBottom: '1.5rem' }}>
               <div className="avatar" style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 }}>
                  {sender.firstName?.charAt(0)}
               </div>
               <div style={{ flexGrow: 1 }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('members.sending_from')}</p>
                  <p style={{ fontWeight: 800, margin: 0 }}>{sender.firstName} {sender.lastName}</p>
               </div>
               <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('members.balance')}</p>
                  <p style={{ fontWeight: 800, margin: 0, color: 'var(--accent)' }}>{(senderBalance / sharePrice).toFixed(1)} <span style={{ fontSize: '0.65rem' }}>{t('members.shares_unit')}</span></p>
               </div>
            </div>

            {/* Recipient Selection */}
            <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
              <label>{t('members.transfer_to_recipient')}</label>
              <div className="pill-input-wrapper">
                <div className="pill-input-icon"><UserPlus size={18} /></div>
                <select 
                  className="pill-input"
                  style={{ appearance: 'none' }}
                  required
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                >
                  <option value="">{t('members.select_member')}</option>
                  {possibleRecipients.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({(m.totalShares/100000).toFixed(1)} {t('members.shares_unit').toLowerCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount Grid */}
             <div className="wizard-form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="pill-group">
                <label>{t('members.shares_to_move')}</label>
                <div className="pill-input-wrapper">
                  <input 
                    type="number" min="0.5" step="0.5" max={senderBalance / sharePrice} required
                    className="pill-input"
                    style={{ fontSize: '1.25rem', fontWeight: '900' }}
                    value={shares}
                    onChange={(e) => setShares(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="pill-group pill-group-read-only">
                <label>{t('members.market_value')}</label>
                <div className="pill-input-wrapper">
                  <div className="pill-input" style={{ display: 'flex', alignItems: 'center', fontSize: '1.25rem', fontWeight: '900' }}>
                     {frw(shares * sharePrice, language)}
                  </div>
                </div>
              </div>
            </div>

            <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
              <label>{t('members.audit_reference')}</label>
              <div className="pill-input-wrapper">
                <input 
                  type="text" placeholder={t('members.audit_reference_placeholder')}
                  className="pill-input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
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
              type="submit" disabled={loading || !recipientId || shares <= 0 || shares > (senderBalance / sharePrice)}
              className="wizard-btn wizard-btn-primary"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {loading ? t('members.processing') : (
                <>{t('members.execute_transfer')} <ArrowRightLeft size={20} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
