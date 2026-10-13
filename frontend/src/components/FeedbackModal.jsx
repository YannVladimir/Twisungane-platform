import React from 'react';
import { Check, X, ArrowRight, AlertCircle } from 'lucide-react';
import './FeedbackModal.css';

/**
 * FeedbackModal component to display Success or Error messages.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Function to call when closing the modal.
 * @param {string} type - 'success' or 'error'.
 * @param {string} title - Title of the modal.
 * @param {string} message - Main body message.
 * @param {Array} details - Optional rows of details [{label: string, value: string}].
 * @param {string} actionLabel - Text for the primary action button.
 */
const FeedbackModal = ({ 
  isOpen, 
  onClose, 
  type = 'success', 
  title, 
  message, 
  details, 
  actionLabel = "Continue" 
}) => {
  if (!isOpen) return null;

  const isError = type === 'error';

  return (
    <div className="feedback-modal-overlay">
      <div className={`feedback-modal-content glass-card animate-pop-in feedback-type-${type}`}>
        <button onClick={onClose} className="feedback-modal-close">
          <X size={20} />
        </button>
        
        <div className="feedback-modal-body">
          <div className="feedback-icon-wrapper">
            <div className="feedback-icon-bg shadow-glow">
              {isError ? (
                <AlertCircle size={44} strokeWidth={2.5} className="rotate-in" />
              ) : (
                <Check size={44} strokeWidth={3} className="rotate-in" />
              )}
            </div>
            <div className="feedback-pulse"></div>
          </div>

          <div className="feedback-text-section">
            <h2 className="feedback-title">{title || (isError ? "Error Occurred" : "Success!")}</h2>
            <p className="feedback-message">{message}</p>
            
            {details && details.length > 0 && (
              <div className="feedback-details-box glass-inset">
                {details.map((detail, idx) => (
                  <div key={idx} className="feedback-detail-row">
                    <span className="label text-muted">{detail.label}</span>
                    <span className="value">{detail.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={onClose} className="feedback-action-btn shadow-glow">
            {actionLabel} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
