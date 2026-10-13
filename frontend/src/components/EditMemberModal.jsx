import { useState, useEffect } from 'react'
import { X, UserCheck, Shield, Mail, Phone, CreditCard, Calendar, Save, AlertCircle, FileText } from 'lucide-react'
import api from '../services/api.js'
import { useLanguage } from '../context/LanguageContext'
import ModernFileUpload from './ModernFileUpload'

export default function EditMemberModal({ isOpen, onClose, member, onMemberUpdated }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationalId: '',
    guarantorId: '',
    joinDate: '',
    dateOfBirth: '',
    role: ''
  })
  const [contractFile, setContractFile] = useState(null)
  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { t } = useLanguage()

  useEffect(() => {
    if (isOpen && member) {
      setFormData({
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        email: member.email || '',
        phone: member.phone || '',
        nationalId: member.nationalId || '',
        guarantorId: member.guarantorId || '',
        joinDate: member.joinDate ? member.joinDate.split('T')[0] : '',
        dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
        role: member.role || ''
      })
      setContractFile(null)
      fetchMembers()
      fetchRoles()
      setError('')
    }
  }, [isOpen, member])

  const fetchRoles = async () => {
    try {
      const res = await api.get('/api/v1/members/roles')
      setRoles(res.data || [])
    } catch (err) {
      console.error('Error fetching roles:', err)
    }
  }

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/v1/members')
      setMembers(res.data.filter(m => m.id !== member.id))
    } catch (err) {
      console.error('Error fetching members for guarantor list:', err)
    }
  }

  if (!isOpen || !member) return null

  const handlePreviewContract = async () => {
    try {
      const res = await api.get(`/api/v1/members/${member.id}/contract`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      window.open(url, '_blank')
    } catch (err) {
      console.error('Failed to preview contract:', err)
    }
  }

  const handleDownloadContract = async () => {
    try {
      const res = await api.get(`/api/v1/members/${member.id}/contract`, {
        responseType: 'blob'
      })
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const ext = member.signedContractPath
        ? '.' + member.signedContractPath.split('.').pop()
        : contentType.includes('pdf') ? '.pdf' : contentType.includes('wordprocessingml') ? '.docx' : ''
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `contract-${member.firstName}-${member.lastName}${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download contract:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const formDataToSend = new FormData()

      const requestBlob = new Blob([JSON.stringify({
        ...formData,
        guarantorId: formData.guarantorId || null
      })], { type: 'application/json' })

      formDataToSend.append('request', requestBlob)

      if (contractFile) {
        formDataToSend.append('contract', contractFile)
      }

      await api.put(`/api/v1/members/${member.id}`, formDataToSend, {})
      onMemberUpdated()
      onClose()
    } catch (err) {
      const backendMessage = err.response?.data?.message
      setError(backendMessage || t('common.system_error'))
      console.error('Error updating member:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        <div className="wizard-header" style={{ flexShrink: 0 }}>
          <div className="wizard-header-top" style={{ marginBottom: 0 }}>
            <div className="wizard-title-box">
              <div className="wizard-icon">
                <Edit2 size={24} />
              </div>
              <div>
                <h3 className="wizard-title">{t('members.edit_modal_title')}</h3>
                <p className="wizard-subtitle">{member.firstName} {member.lastName}</p>
              </div>
            </div>
            <button onClick={onClose} className="wizard-close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="wizard-body" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '2rem', overflowY: 'auto' }}>
            
            <div className="wizard-form-grid" style={{ marginBottom: '1.5rem' }}>
              <PillInput 
                label={t('members.first_name')} 
                value={formData.firstName}
                onChange={(val) => setFormData({...formData, firstName: val})}
                required
              />
              <PillInput 
                label={t('members.last_name')} 
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
                value={formData.email}
                onChange={(val) => setFormData({...formData, email: val})}
                required
              />
            </div>
            <div className="wizard-form-grid" style={{ marginBottom: '1.5rem' }}>
              <PillInput 
                label={t('members.phone_number')} 
                icon={<Phone size={18} />} 
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
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <PillInput 
                label={t('members.national_id')} 
                icon={<CreditCard size={18} />} 
                value={formData.nationalId}
                onChange={(val) => setFormData({...formData, nationalId: val})}
                required
              />
            </div>
            
            <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
              <label>{t('members.association_role')}</label>
              <div className="pill-input-wrapper">
                <div className="pill-input-icon"><Shield size={18} /></div>
                <select 
                  className="pill-input"
                  style={{ appearance: 'none' }}
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>
                      {r.name === 'ROLE_MEMBER' ? t('members.regular_member') : 
                       r.name === 'ROLE_PRESIDENT' ? t('members.president') :
                       r.name === 'ROLE_FINANCE' ? t('members.finance_officer') : 
                       r.name.replace('ROLE_', '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
              <label>{t('members.guarantor')}</label>
              <div className="pill-input-wrapper">
                <div className="pill-input-icon"><UserCheck size={18} /></div>
                <select 
                  className="pill-input"
                  style={{ appearance: 'none' }}
                  value={formData.guarantorId || ''}
                  onChange={(e) => setFormData({...formData, guarantorId: e.target.value})}
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

            <div style={{ marginBottom: '1.5rem' }}>
              <PillInput 
                type="date"
                label={t('members.joining_date')} 
                icon={<Calendar size={18} />} 
                value={formData.joinDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(val) => setFormData({...formData, joinDate: val})}
                required
              />
            </div>

            {/* Signed Contract Section */}
            <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <FileText size={16} style={{ color: 'var(--accent)' }} />
                <label style={{ margin: 0 }}>{t('members.signed_contract')}</label>
              </div>
              <ModernFileUpload
                onFileSelect={(file) => setContractFile(file)}
                existingFile={member.signedContractPath ? member.signedContractPath.split('/').pop() : null}
                onPreview={handlePreviewContract}
                onDownload={handleDownloadContract}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif"
              />
            </div>

            {error && (
              <div className="wizard-error-box" style={{ marginBottom: '1.5rem' }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}
          </div>

          <div className="wizard-actions" style={{ flexShrink: 0, marginTop: 'auto' }}>
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
                <>{t('members.update_success')} <Save size={20} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PillInput({ label, icon, placeholder, value, onChange, type = "text", required, ...props }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="pill-group">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label>{label}</label>
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
          max={props.max}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>
    </div>
  )
}

function Edit2(props) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width={props.size || 24} 
      height={props.size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
