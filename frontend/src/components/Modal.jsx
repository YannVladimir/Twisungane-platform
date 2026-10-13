import React from 'react';
import { X } from 'lucide-react';
import './FeedbackModal.css';

/**
 * Generic Modal component providing a consistent overlay and container.
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {function} onClose - Function to call when closing the modal.
 * @param {React.ReactNode} children - The content of the modal.
 * @param {string} maxWidth - Optional max-width for the modal content (default '480px').
 * @param {boolean} showClose - Whether to show the close button (default true).
 */
const Modal = ({ 
  isOpen, 
  onClose, 
  children, 
  maxWidth = '480px',
  showClose = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="feedback-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div 
        className="feedback-modal-content glass-card animate-pop-in" 
        style={{ maxWidth, padding: '2.5rem' }}
        onClick={e => e.stopPropagation()}
      >
        {showClose && (
          <button onClick={onClose} className="feedback-modal-close">
            <X size={20} />
          </button>
        )}
        
        <div className="modal-inner-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
