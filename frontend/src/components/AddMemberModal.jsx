import { useState, useEffect } from 'react'
import { 
  X, UserPlus, Mail, Phone, Lock, CreditCard, 
  Calendar, UserCheck, ChevronRight, ChevronLeft, Check,
  PiggyBank, Info, ShieldCheck, User, AlertCircle, FileText
} from 'lucide-react'
import api from '../services/api.js'
import { useLanguage } from '../context/LanguageContext'
import ModernFileUpload from './ModernFileUpload'
import { frw } from '../utils/i18nHelper'

export default function AddMemberModal({ isOpen, onClose, onMemberAdded }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationalId: '',
    guarantorId: '',
    joinDate: new Date().toISOString().split('T')[0],
    dateOfBirth: '',
    password: 'Member@123',
    initialShares: 1,
    transactionReference: '',
    role: 'ROLE_MEMBER'
  })
  const [contractFile, setContractFile] = useState(null)

  const [members, setMembers] = useState([])
  const [sharePrice, setSharePrice] = useState(100000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { t, language } = useLanguage()

  useEffect(() => {
    if (isOpen) {
      fetchMembers()
      setStep(1)
      setError('')
      api.get('/api/v1/admin/config')
        .then(res => {
          const cfg = (res.data || []).find(c => c.configKey === 'SHARE_PRICE')
          if (cfg) setSharePrice(Number(cfg.configValue))
        })
        .catch(() => {})
    }
  }, [isOpen])

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/v1/members')
      setMembers(res.data)
    } catch (err) {
      console.error('Error fetching members:', err)
    }
  }

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  if (!isOpen) return null

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const shares = parseFloat(formData.initialShares)
    if (isNaN(shares) || shares < 0.5) {
      setError(t('members.shares_min_error') || 'Minimum 0.5 shares required.')
      setLoading(false)
      return
    }
    if (!Number.isInteger(shares * 2)) {
      setError(t('members.shares_step_error') || 'Shares must be a multiple of 0.5 (e.g. 0.5, 1, 1.5, 2...).')
      setLoading(false)
      return
    }

    try {
      const formDataToSend = new FormData()

      const requestBlob = new Blob([JSON.stringify({
        ...formData,
        guarantorId: formData.guarantorId || null,
        initialShares: shares
      })], { type: 'application/json' })

      formDataToSend.append('request', requestBlob)

      if (contractFile) {
        formDataToSend.append('contract', contractFile)
      }

      await api.post('/api/v1/members', formDataToSend, {})

      onMemberAdded()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || t('common.system_error'))
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = (formData.initialShares || 1) * sharePrice;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ display: 'flex', flexDirection: 'column' }}>

        <div className="wizard-header" style={{ flexShrink: 0 }}>
          <div className="wizard-header-top">
            <div className="wizard-title-box">
              <div className="wizard-icon">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="wizard-title">{t('members.add_modal_title')}</h3>
                <p className="wizard-subtitle">{t('members.add_modal_subtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="wizard-close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="wizard-stepper">
             <div className="wizard-stepper-line-bg">
                <div 
                  className="wizard-stepper-line-fill" 
                  style={{ width: `${((step - 1) / 2) * 100}%` }}
                />
             </div>
             
             <StepIcon stepNum={1} currentStep={step} icon={<User size={18} />} label={t('members.personal')} />
             <StepIcon stepNum={2} currentStep={step} icon={<ShieldCheck size={18} />} label={t('members.security')} />
             <StepIcon stepNum={3} currentStep={step} icon={<PiggyBank size={18} />} label={t('members.financial')} />
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="wizard-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div className="slider-viewport" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <div 
              className="slider-track" 
              style={{ transform: `translateX(-${(step - 1) * 100}%)` }}
            >
              {/* STEP 1: PERSONAL */}
              <div className="slider-step">
                <div className="wizard-form-grid" style={{ marginBottom: '1.5rem' }}>
                  <PillInput 
                    label={t('members.first_name')} 
                    placeholder={t('members.first_name_placeholder')}
                    value={formData.firstName}
                    onChange={(val) => setFormData({...formData, firstName: val})}
                    required
                  />
                  <PillInput 
                    label={t('members.last_name')} 
                    placeholder={t('members.last_name_placeholder')}
                    value={formData.lastName}
                    onChange={(val) => setFormData({...formData, lastName: val})}
                    required
                  />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <PillInput 
                    type="email"
                    label={t('members.email_address')} 
                    icon={<Mail size={18} />} 
                    placeholder="member@example.com"
                    value={formData.email}
                    onChange={(val) => setFormData({...formData, email: val})}
                    required
                  />
                </div>
                <div className="wizard-form-grid">
                  <PillInput 
                    label={t('members.phone_number')} 
                    icon={<Phone size={18} />} 
                    placeholder="+250 780..."
                    value={formData.phone}
                    onChange={(val) => setFormData({...formData, phone: val})}
                    required
                  />
                  <PillInput 
                    type="date"
                    label={t('members.birth_date')} 
                    icon={<Calendar size={18} />} 
                    value={formData.dateOfBirth}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(val) => setFormData({...formData, dateOfBirth: val})}
                    info={t('members.birth_date_info')}
                    required
                  />
                </div>
              </div>

              {/* STEP 2: SECURITY & JOINING */}
              <div className="slider-step">
                <div style={{ marginBottom: '1.5rem' }}>
                  <PillInput 
                    label={t('members.national_id')} 
                    icon={<CreditCard size={18} />} 
                    placeholder="1 19XX 8 X..."
                    value={formData.nationalId}
                    onChange={(val) => setFormData({...formData, nationalId: val})}
                    info={t('members.national_id_info')}
                    required
                  />
                </div>

                <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
                  <label>{t('members.guarantor')}</label>
                  <div className="pill-input-wrapper">
                    <div className="pill-input-icon"><UserCheck size={18} /></div>
                    <select 
                      className="pill-input"
                      style={{ appearance: 'none' }}
                      value={formData.guarantorId}
                      onChange={(e) => setFormData({...formData, guarantorId: e.target.value})}
                    >
                      <option value="">{t('members.guarantor_placeholder')}</option>
                      {members
                        .filter(m => m.role !== 'ROLE_ADMIN' && m.role !== 'ROLE_PRESIDENT' && m.type !== 'SOCIAL')
                        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.firstName} {m.lastName}{m.guarantorName ? ` (${m.guarantorName})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <PillInput 
                  type="date"
                  label={t('members.joining_date')} 
                  icon={<Calendar size={18} />} 
                  value={formData.joinDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(val) => setFormData({...formData, joinDate: val})}
                  info={t('members.joining_date_info')}
                  required
                />

                <div className="pill-group" style={{ marginTop: '1.5rem' }}>
                    <label style={{ marginBottom: '1rem', display: 'block' }}>{t('members.signed_contract')}</label>
                    <ModernFileUpload
                      onFileSelect={(file) => setContractFile(file)}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
                    />
                </div>
              </div>

              {/* STEP 3: FINANCIAL */}
              <div className="slider-step">
                <div className="wizard-finance-card" style={{ marginBottom: '1.5rem' }}>
                   <div>
                      <p className="wizard-subtitle" style={{ color: '#fde047', marginBottom: '0.25rem' }}>{t('members.mandatory_share_price')}</p>
                      <h4 className="wizard-finance-price">{frw(sharePrice, language)}</h4>
                   </div>
                   <div className="wizard-finance-icon">
                      <PiggyBank size={32} />
                   </div>
                </div>

                <div className="wizard-form-grid" style={{ marginBottom: '1.5rem' }}>
                   <PillInput
                    type="number"
                    min="0.5" step="0.5"
                    label={t('members.initial_shares')}
                    value={formData.initialShares}
                    onChange={(val) => setFormData({...formData, initialShares: val === '' ? '' : val})}
                    info={t('members.initial_shares_info')}
                    required
                  />
                  <div className="pill-group pill-group-read-only">
                    <label>{t('members.registration_total')}</label>
                    <div className="pill-input-wrapper">
                      <div className="pill-input" style={{ display: 'flex', alignItems: 'center' }}>
                         {frw(totalAmount, language)}
                      </div>
                    </div>
                  </div>
                </div>

                <PillInput 
                  label={t('members.transaction_reference')} 
                  icon={<Info size={18} />} 
                  placeholder={t('members.transaction_reference_placeholder')}
                  value={formData.transactionReference}
                  onChange={(val) => setFormData({...formData, transactionReference: val})}
                />

                {error && (
                  <div className="wizard-error-box" style={{ marginTop: '1.5rem' }}>
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="wizard-actions" style={{ flexShrink: 0 }}>
             {step > 1 && (
               <button 
                  type="button" 
                  className="wizard-btn wizard-btn-secondary"
                  onClick={prevStep}
               >
                 <ChevronLeft size={20} /> {t('members.back')}
               </button>
             )}

             {step < 3 ? (
               <button 
                  type="button" 
                  className="wizard-btn wizard-btn-primary"
                  onClick={nextStep}
               >
                 {t('members.continue')} <ChevronRight size={20} />
               </button>
             ) : (
                <button
                  type="button"
                  disabled={loading}
                  className="wizard-btn wizard-btn-success"
                  onClick={handleSubmit}
                >
                  {loading ? t('members.processing') : (
                    <>{t('members.enrollment_success')} <Check size={20} /></>
                  )}
                </button>
             )}
          </div>
        </form>
      </div>
    </div>
  )
}

function StepIcon({ stepNum, currentStep, icon, label }) {
  const isActive = currentStep >= stepNum;
  const isCurrent = currentStep === stepNum;
  
  let stateClass = 'inactive';
  if (isCurrent) stateClass = 'current';
  else if (isActive) stateClass = 'active';

  return (
    <div className="wizard-step">
      <div className={`wizard-step-icon ${stateClass}`}>
        {isActive && !isCurrent && stepNum < 3 ? <Check size={18} /> : icon}
      </div>
      <span className={`wizard-step-label ${stateClass === 'current' || stateClass === 'active' ? 'active' : 'inactive'}`}>
        {label}
      </span>
    </div>
  )
}

function PillInput({ label, icon, placeholder, value, onChange, type = "text", info, required, ...props }) {
  // Using focus state locally to toggle accent color on the icon if needed
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="pill-group">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label>{label}</label>
        {info && (
          <div className="info-icon-wrapper" style={{ position: 'relative' }}>
            <Info size={14} className="info-icon-trigger" />
            <div className="tooltip-simple">{info}</div>
          </div>
        )}
      </div>
      <div className="pill-input-wrapper">
        {icon && (
          <div className="pill-input-icon" style={{ color: isFocused ? 'var(--accent)' : '' }}>
            {icon}
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          className="pill-input"
          value={value}
          required={required}
          min={props.min}
          max={props.max}
          step={props.step}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>
    </div>
  )
}
