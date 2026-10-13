import { useState, useEffect } from 'react'
import { Settings, Save, RefreshCw, AlertTriangle, Shield, Percent, Target } from 'lucide-react'
import api from '../services/api.js'
import { useLanguage } from '../context/LanguageContext'

export default function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configs, setConfigs] = useState([])
  const [message, setMessage] = useState('')
  const { t } = useLanguage()

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/admin/config')
      const serverConfigs = res.data || []
      
      const findVal = (key, defaultVal) => {
        const found = serverConfigs.find(c => c.configKey === key)
        return found ? found.configValue : defaultVal
      }

      setConfigs([
        { key: 'LOAN_INTEREST_RATE', value: findVal('LOAN_INTEREST_RATE', '0.10'), label: t('admin_settings.loan_interest_rate'), unit: '%' },
        { key: 'MONTHLY_PRINCIPAL_BASE', value: findVal('MONTHLY_PRINCIPAL_BASE', '50000'), label: t('admin_settings.monthly_principal_base'), unit: 'FRW' },
        { key: 'MIN_MONTHLY_INSTALLMENT', value: findVal('MIN_MONTHLY_INSTALLMENT', '55000'), label: t('admin_settings.min_monthly_installment'), unit: 'FRW' },
        { key: 'LOAN_MULTIPLIER', value: findVal('LOAN_MULTIPLIER', '2'), label: t('admin_settings.multiplier_label'), unit: '' }
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const payload = configs.map(c => ({
        key: c.key,
        value: c.value
      }))
      await api.put('/api/v1/admin/config', payload)
      setMessage(t('admin_settings.success_message') || 'Settings updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-accent" size={32} />
      </div>
    )
  }

  const standardConfigs = configs.filter(c => c.key !== 'LOAN_MULTIPLIER')
  const multiplierConfig = configs.find(c => c.key === 'LOAN_MULTIPLIER')

  return (
    <div className="page-content animate-in">
      <header className="page-header">
        <div className="header-info">
          <h1>{t('admin_settings.title')}</h1>
          <p className="text-muted">{t('admin_settings.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          <span>{saving ? t('common.saving') : t('common.save_changes')}</span>
        </button>
      </header>

      {message && (
        <div className="alert-success mb-6 p-4 rounded-xl flex items-center gap-3 animate-in">
          <Shield size={20} />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 stagger-1">
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-6">
            <Percent className="text-accent" size={24} />
            <h3 className="m-0">{t('admin_settings.loan_parameters')}</h3>
          </div>
          
          <div className="space-y-6">
            {standardConfigs.map(config => (
              <div key={config.key} className="form-group">
                <label>{config.label}</label>
                <div className="input-group">
                  <input 
                    type="text" 
                    value={config.value} 
                    onChange={(e) => {
                      const newConfigs = [...configs]
                      newConfigs.find(c => c.key === config.key).value = e.target.value
                      setConfigs(newConfigs)
                    }}
                  />
                  <span className="input-suffix bg-white/5 px-4 flex items-center">{config.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-blue-400" size={24} />
            <h3 className="m-0">{t('admin_settings.global_limits')}</h3>
          </div>

          <div className="space-y-4">
            <div className="info-banner-warning p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex gap-3">
              <AlertTriangle className="text-orange-400 shrink-0" size={24} />
              <p className="text-sm text-orange-200">
                {t('admin_settings.integrity_warning')}
              </p>
            </div>

            {multiplierConfig && (
              <div className="form-group border-t border-white/10 pt-4 mt-6">
                <label>{t('admin_settings.multiplier_label')}</label>
                <select 
                  className="bg-transparent border border-white/20 text-white p-3 rounded-lg w-full bg-slate-900"
                  value={multiplierConfig.value}
                  onChange={(e) => {
                    const newConfigs = [...configs]
                    newConfigs.find(c => c.key === 'LOAN_MULTIPLIER').value = e.target.value
                    setConfigs(newConfigs)
                  }}
                >
                  <option value="2" className="bg-slate-900">{t('admin_settings.multiplier_standard')}</option>
                  <option value="3" className="bg-slate-900">{t('admin_settings.multiplier_premium')}</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
