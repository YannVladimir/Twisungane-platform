import { useState, useEffect } from 'react'
import {
  X, CheckCircle, XCircle, AlertTriangle, ArrowRight,
  Shield, Banknote, Calculator, LogOut, Info,
  ChevronRight, Loader2, BadgeCheck, TriangleAlert
} from 'lucide-react'
import exitService from '../services/exit.service'
import { useLanguage } from '../context/LanguageContext'
import { frw } from '../utils/i18nHelper'

// ─── Step indicator ──────────────────────────────────────────────────────────
const StepDot = ({ step, current, label }) => {
  const done = current > step
  const active = current === step
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.3s',
        background: done ? '#22c55e' : active ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
        color: done || active ? '#fff' : 'var(--text-muted)',
        border: `2px solid ${done ? '#22c55e' : active ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: active ? '0 0 16px rgba(234,179,8,0.4)' : 'none'
      }}>
        {done ? <CheckCircle size={18} /> : step}
      </div>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: active ? 'var(--accent)' : done ? '#22c55e' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}

const StepLine = ({ done }) => (
  <div style={{
    flex: 1, height: 2, marginBottom: 20, transition: 'all 0.3s',
    background: done ? '#22c55e' : 'rgba(255,255,255,0.08)'
  }} />
)

// ─── Main component ──────────────────────────────────────────────────────────
export default function MemberExitModal({ isOpen, onClose, member, onExitInitiated }) {
  const { t, language } = useLanguage()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState(null)
  const [settlement, setSettlement] = useState(null)
  const [exitType, setExitType] = useState('VOLUNTARY')
  const [exitReason, setExitReason] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen && member) {
      setStep(1)
      setEligibility(null)
      setSettlement(null)
      setExitType('VOLUNTARY')
      setExitReason('')
      setError(null)
      setSuccess(false)
      runEligibilityCheck()
    }
  }, [isOpen, member])

  const runEligibilityCheck = async () => {
    setLoading(true)
    try {
      const [eligRes, settleRes] = await Promise.all([
        exitService.checkEligibility(member.id),
        exitService.getSettlement(member.id)
      ])
      setEligibility(eligRes.data)
      setSettlement(settleRes.data)
    } catch (err) {
      setError(err.response?.data?.message || t('common.system_error'))
    } finally {
      setLoading(false)
    }
  }

  const handleInitiate = async () => {
    setLoading(true)
    setError(null)
    try {
      await exitService.initiateExit(member.id, { exitType, exitReason })
      setSuccess(true)
      setStep(3)
      if (onExitInitiated) onExitInitiated()
    } catch (err) {
      setError(err.response?.data?.message || t('common.system_error'))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !member) return null

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 1000 }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '20px', padding: 0,
          border: '1px solid rgba(239,68,68,0.2)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.1)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.75rem 2rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(0,0,0,0) 60%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(239,68,68,0.12)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(239,68,68,0.2)'
            }}>
              <LogOut size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {t('exit.modal_title')}
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {member.firstName} {member.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', width: 36, height: 36, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: 'var(--text-muted)', transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        <div style={{ padding: '1.5rem 2rem 0', display: 'flex', alignItems: 'center' }}>
          <StepDot step={1} current={step} label={t('exit.step_check')} />
          <StepLine done={step > 1} />
          <StepDot step={2} current={step} label={t('exit.step_settlement')} />
          <StepLine done={step > 2} />
          <StepDot step={3} current={step} label={t('exit.step_confirm')} />
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 2rem 2rem' }}>

          {/* STEP 1 — Eligibility */}
          {step === 1 && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent)', margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('exit.checking_eligibility')}
                  </p>
                </div>
              ) : error ? (
                <ErrorBox message={error} />
              ) : eligibility && (
                <div>
                  {/* Status banner */}
                  <div style={{
                    borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    background: eligibility.eligible
                      ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${eligibility.eligible ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: eligibility.eligible ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: eligibility.eligible ? '#22c55e' : '#ef4444'
                    }}>
                      {eligibility.eligible ? <BadgeCheck size={22} /> : <XCircle size={22} />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: eligibility.eligible ? '#22c55e' : '#ef4444' }}>
                        {eligibility.eligible ? t('exit.eligible_title') : t('exit.not_eligible_title')}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {eligibility.eligible ? t('exit.eligible_sub') : t('exit.not_eligible_sub')}
                      </p>
                    </div>
                  </div>

                  {/* Blockers */}
                  {eligibility.blockers?.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('exit.blockers')}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {eligibility.blockers.map((b, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                            padding: '0.75rem 1rem', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)'
                          }}>
                            <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {eligibility.warnings?.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('exit.warnings')}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {eligibility.warnings.map((w, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                            padding: '0.75rem 1rem', borderRadius: '10px',
                            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)'
                          }}>
                            <TriangleAlert size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proceed button */}
                  {eligibility.eligible && (
                    <button
                      onClick={() => setStep(2)}
                      style={{
                        width: '100%', padding: '1rem', borderRadius: '12px', border: 'none',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', transition: 'all 0.2s',
                        boxShadow: '0 4px 20px rgba(239,68,68,0.3)'
                      }}
                    >
                      {t('exit.view_settlement')} <ChevronRight size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Settlement preview + reason */}
          {step === 2 && settlement && (
            <div>
              {/* Settlement breakdown card */}
              <div style={{
                borderRadius: '16px', overflow: 'hidden', marginBottom: '1.5rem',
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)'
              }}>
                {/* Card header */}
                <div style={{
                  padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.03)'
                }}>
                  <Calculator size={18} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('exit.settlement_breakdown')}</span>
                </div>

                {/* Rows */}
                <div style={{ padding: '0.5rem 0' }}>
                  <SettlementRow
                    label={t('exit.total_shares')}
                    sub={`${settlement.shareCount} × ${frw(settlement.sharePricePerUnit, language)}`}
                    value={frw(settlement.totalShareValue, language)}
                    color="var(--accent)"
                    icon={<Banknote size={16} />}
                  />
                  {settlement.totalUnpaidPenalties > 0 && (
                    <SettlementRow
                      label={t('exit.unpaid_penalties')}
                      sub={t('exit.deducted_from_settlement')}
                      value={`− ${frw(settlement.totalUnpaidPenalties, language)}`}
                      color="#ef4444"
                      icon={<AlertTriangle size={16} />}
                    />
                  )}
                  <div style={{ margin: '0.5rem 1.5rem', height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  <SettlementRow
                    label={t('exit.net_payout')}
                    sub={t('exit.amount_to_return')}
                    value={frw(settlement.netSettlementAmount, language)}
                    color="#22c55e"
                    bold
                    icon={<CheckCircle size={16} />}
                  />
                </div>
              </div>

              {/* Exit type selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('exit.exit_type')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {['VOLUNTARY', 'EXPELLED'].map(type => (
                    <button
                      key={type}
                      onClick={() => setExitType(type)}
                      style={{
                        padding: '0.9rem 1rem', borderRadius: '12px', cursor: 'pointer',
                        textAlign: 'left', transition: 'all 0.2s',
                        background: exitType === type ? (type === 'VOLUNTARY' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)') : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${exitType === type ? (type === 'VOLUNTARY' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)') : 'rgba(255,255,255,0.08)'}`,
                        color: exitType === type ? (type === 'VOLUNTARY' ? '#22c55e' : '#ef4444') : 'var(--text-muted)'
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                        {type === 'VOLUNTARY' ? t('exit.voluntary') : t('exit.expelled')}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                        {type === 'VOLUNTARY' ? t('exit.voluntary_sub') : t('exit.expelled_sub')}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason textarea */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('exit.exit_reason')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>({t('common.optional')})</span>
                </label>
                <textarea
                  rows={3}
                  placeholder={t('exit.reason_placeholder')}
                  value={exitReason}
                  onChange={e => setExitReason(e.target.value)}
                  style={{
                    width: '100%', borderRadius: '12px', padding: '0.9rem 1rem', resize: 'vertical',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5
                  }}
                />
              </div>

              {error && <ErrorBox message={error} />}

              {/* HCQ-009 notice */}
              <div style={{
                padding: '0.9rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem',
                background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
              }}>
                <Info size={16} style={{ color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {t('exit.interest_notice')}
                </p>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem'
                  }}
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleInitiate}
                  disabled={loading}
                  style={{
                    flex: 2, padding: '1rem', borderRadius: '12px', border: 'none',
                    background: loading ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(239,68,68,0.35)', transition: 'all 0.2s'
                  }}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                  {loading ? t('common.processing') : t('exit.confirm_initiate')}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Success */}
          {step === 3 && success && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1.5rem',
                background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 40px rgba(34,197,94,0.2)'
              }}>
                <CheckCircle size={40} style={{ color: '#22c55e' }} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {t('exit.success_title')}
              </h3>
              <p style={{ margin: '0 0 2rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {t('exit.success_message')
                  .replace('{{name}}', `${member.firstName} ${member.lastName}`)}
              </p>
              <div style={{
                borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '2rem',
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                textAlign: 'left'
              }}>
                <DetailRow label={t('exit.member_label')} value={`${member.firstName} ${member.lastName}`} />
                <DetailRow label={t('exit.exit_type_label')} value={exitType === 'VOLUNTARY' ? t('exit.voluntary') : t('exit.expelled')} />
                <DetailRow label={t('exit.net_payout')} value={frw(settlement?.netSettlementAmount, language)} highlight />
                <DetailRow label={t('exit.status_label')} value={t('exit.awaiting_president')} />
              </div>
              <div style={{
                padding: '0.9rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem',
                background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
                display: 'flex', gap: '0.75rem', alignItems: 'center'
              }}>
                <Shield size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('exit.next_steps_note')}
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '1rem', borderRadius: '12px', border: 'none',
                  background: 'var(--accent)', color: '#000',
                  fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
                }}
              >
                {t('common.close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────
const SettlementRow = ({ label, sub, value, color, bold, icon }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.85rem 1.5rem', gap: '1rem'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ color, opacity: 0.8 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontWeight: bold ? 700 : 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</p>
        {sub && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
    <span style={{ fontWeight: bold ? 800 : 600, fontSize: bold ? '1.05rem' : '0.9rem', color, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
      {value}
    </span>
  </div>
)

const DetailRow = ({ label, value, highlight }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontSize: '0.88rem', fontWeight: highlight ? 800 : 600, color: highlight ? '#22c55e' : 'var(--text-primary)' }}>{value}</span>
  </div>
)

const ErrorBox = ({ message }) => (
  <div style={{
    padding: '0.9rem 1.25rem', borderRadius: '12px', marginBottom: '1rem',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
  }}>
    <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
    <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444' }}>{message}</p>
  </div>
)
