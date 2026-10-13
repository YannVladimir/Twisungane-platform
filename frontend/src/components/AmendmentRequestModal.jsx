import { useState } from 'react'
import { AlertTriangle, ArrowRight, XCircle, Info } from 'lucide-react'
import Modal from './Modal'
import amendmentService from '../services/amendment.service'

// TRANSACTION_TYPE_LABELS maps backend enum values to human-readable labels
const TYPE_LABELS = {
  SHARE_RECORD: 'Share Purchase / Transfer',
  CONTRIBUTION: 'Contribution',
  LOAN_REPAYMENT: 'Loan Repayment',
  GROUP_EXPENSE: 'Group Expense',
  PENALTY: 'Penalty',
  SOCIAL_CLAIM: 'Social Claim',
}

/**
 * AmendmentRequestModal
 *
 * Props:
 *   isOpen             — boolean
 *   onClose            — () => void
 *   transactionType    — one of the TransactionType enum strings
 *   transaction        — the original transaction object (must have .id and .amount / matching amount field)
 *   amountField        — which field on `transaction` holds the amount (default: "amount")
 *   label              — optional human-readable description of the transaction shown in the modal
 *   onSuccess          — (amendment) => void  called after successful submission
 */
export default function AmendmentRequestModal({
  isOpen,
  onClose,
  transactionType,
  transaction,
  amountField = 'amount',
  label,
  onSuccess,
}) {
  const [correctAmount, setCorrectAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const originalAmount = transaction?.[amountField] ?? 0

  const handleClose = () => {
    setCorrectAmount('')
    setReason('')
    setError(null)
    setSubmitted(false)
    setLoading(false)
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)

    if (!correctAmount || isNaN(parseFloat(correctAmount))) {
      setError('Please enter a valid correct amount.')
      return
    }
    if (parseFloat(correctAmount) <= 0) {
      setError('Correct amount must be greater than zero.')
      return
    }
    if (!reason.trim()) {
      setError('Please describe the reason for this amendment.')
      return
    }
    if (parseFloat(correctAmount) === parseFloat(originalAmount)) {
      setError('The correct amount is the same as the original. No amendment is needed.')
      return
    }

    setLoading(true)
    try {
      const result = await amendmentService.requestAmendment({
        transactionType,
        originalTransactionId: transaction.id,
        originalAmount: parseFloat(originalAmount),
        correctAmount: parseFloat(correctAmount),
        reason: reason.trim(),
      })
      setSubmitted(true)
      onSuccess?.(result)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit amendment request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!transaction) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="520px">
      {submitted ? (
        // Success state
        <div className="text-center">
          <div className="success-icon-wrapper">
            <div className="success-icon-bg" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <AlertTriangle size={40} strokeWidth={2.5} style={{ color: '#fff' }} />
            </div>
            <div className="success-pulse" style={{ background: '#f59e0b' }}></div>
          </div>
          <div className="success-text-section">
            <h2 className="success-title">Amendment Requested</h2>
            <p className="success-message">
              Your amendment request has been submitted and is awaiting President review.
              No changes have been made yet — the correction will only be applied after approval.
            </p>
            <div className="success-details-box glass-inset">
              <div className="success-detail-row">
                <span className="label text-muted">Type</span>
                <span className="value font-bold">{TYPE_LABELS[transactionType] || transactionType}</span>
              </div>
              <div className="success-detail-row">
                <span className="label text-muted">Original amount</span>
                <span className="value" style={{ color: '#ef4444', fontWeight: 700 }}>
                  {Number(originalAmount).toLocaleString()} FRW
                </span>
              </div>
              <div className="success-detail-row">
                <span className="label text-muted">Correct amount</span>
                <span className="value" style={{ color: '#22c55e', fontWeight: 700 }}>
                  {Number(correctAmount).toLocaleString()} FRW
                </span>
              </div>
            </div>
          </div>
          <button onClick={handleClose} className="success-action-btn" style={{ width: '100%' }}>
            Close <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        // Request form
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Request Amendment</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {TYPE_LABELS[transactionType] || transactionType}
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div style={{
            padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.5rem',
            background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
          }}>
            <Info size={16} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Amendments do not delete the original record. A reversal entry and a correcting entry
              will be created after President approval, keeping a full audit trail.
            </p>
          </div>

          {/* Transaction summary */}
          {label && (
            <div style={{
              padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.5rem',
              background: 'var(--item-bg)', border: '1px solid var(--border-color)',
            }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Transaction
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{label}</p>
            </div>
          )}

          {/* Original amount (read-only display) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Original Amount (recorded)
            </label>
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px',
              background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: '1.1rem', fontWeight: 800, color: '#ef4444',
              fontFamily: 'Outfit, sans-serif',
            }}>
              {Number(originalAmount).toLocaleString()} FRW
            </div>
          </div>

          {/* Correct amount input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Correct Amount *
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={correctAmount}
              onChange={e => setCorrectAmount(e.target.value)}
              placeholder="Enter the correct amount in FRW"
              style={{
                width: '100%', padding: '0.85rem 1rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)', fontSize: '1rem', outline: 'none',
                fontFamily: 'Outfit, sans-serif', fontWeight: 700, boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(234,179,8,0.5)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Reason for Amendment *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe what was wrong and what the correct value should be..."
              style={{
                width: '100%', padding: '0.85rem 1rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(234,179,8,0.5)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Delta preview */}
          {correctAmount && !isNaN(parseFloat(correctAmount)) && parseFloat(correctAmount) !== parseFloat(originalAmount) && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem',
              background: parseFloat(correctAmount) > parseFloat(originalAmount)
                ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
              border: parseFloat(correctAmount) > parseFloat(originalAmount)
                ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(34,197,94,0.2)',
            }}>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Net correction:&nbsp;
                <span style={{
                  color: parseFloat(correctAmount) > parseFloat(originalAmount) ? '#ef4444' : '#22c55e',
                }}>
                  {parseFloat(correctAmount) > parseFloat(originalAmount) ? '+' : ''}
                  {(parseFloat(correctAmount) - parseFloat(originalAmount)).toLocaleString()} FRW
                </span>
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleClose}
              style={{
                flex: 1, padding: '0.9rem', borderRadius: '12px',
                background: 'var(--item-bg)', border: '1px solid var(--border-color)',
                color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              }}
            >
              <XCircle size={16} /> Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 2, padding: '0.9rem', borderRadius: '12px', border: 'none',
                background: loading ? 'rgba(245,158,11,0.4)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#000', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(245,158,11,0.3)',
              }}
            >
              {loading ? 'Submitting...' : <><AlertTriangle size={16} /> Submit for President Review</>}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
