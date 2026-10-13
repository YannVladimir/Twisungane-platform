import { useState, useRef } from 'react'
import { Upload, X, FileText, CheckCircle, Loader2, Download, Eye } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export default function ModernFileUpload({ 
  onFileSelect, 
  existingFile, 
  onPreview,
  onDownload,
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tiff,.tif",
  maxSize = 10, // MB
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
  const { t } = useLanguage()

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }

  const processFile = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/tif',
    ]
    const allowedExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.bmp', '.tiff', '.tif']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      alert('Allowed formats: PDF, Word (.doc/.docx), or images (.jpg, .png, .webp, .heic, .bmp, .tiff).')
      return
    }
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File too large. Max ${maxSize}MB allowed.`)
      return
    }
    setSelectedFile(file)
    simulateUpload(file)
  }

  const simulateUpload = (file) => {
    setIsUploading(true)
    setUploadProgress(0)
    
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 30
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setIsUploading(false)
        onFileSelect(file)
      }
      setUploadProgress(progress)
    }, 200)
  }

  const handleRemove = (e) => {
    e.stopPropagation()
    setSelectedFile(null)
    setUploadProgress(0)
    onFileSelect(null)
  }

  const triggerInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="modern-upload-container">
      {!selectedFile && !existingFile ? (
        <div 
          className={`dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerInput}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={(e) => processFile(e.target.files[0])}
            accept={accept}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">
            <Upload size={32} />
          </div>
          <div className="dropzone-text">
            <p className="main-text">{t('members.drop_file_here')}</p>
            <p className="sub-text">
              {t('members.supported_formats')} • <span className="browse">{t('members.click_to_upload')}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="file-preview-card">
          <div className="file-info">
            <div className="file-icon">
              {isUploading ? <Loader2 className="animate-spin" /> : <FileText size={20} />}
            </div>
            <div className="file-details">
              <p className="file-name">{selectedFile?.name || existingFile}</p>
              <p className="file-status">
                {isUploading ? `${t('members.uploading')} ${Math.round(uploadProgress)}%` : t('members.upload_success')}
              </p>
            </div>
            {!isUploading && (
              <div className="file-actions">
                {existingFile && !selectedFile && (
                  <>
                    <button type="button" onClick={onPreview} className="action-btn" title={t('members.view_contract')}>
                      <Eye size={18} />
                    </button>
                    <button type="button" onClick={onDownload} className="action-btn" title={t('members.download_contract')}>
                      <Download size={18} />
                    </button>
                  </>
                )}
                <button type="button" onClick={handleRemove} className="remove-btn">
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
          {isUploading && (
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          {!isUploading && selectedFile && (
             <div className="success-tag">
                <CheckCircle size={14} /> {t('members.upload_success')}
             </div>
          )}
          {!isUploading && existingFile && !selectedFile && (
             <button type="button" onClick={triggerInput} className="replace-link">
                {t('members.replace_contract')}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => processFile(e.target.files[0])}
                  accept={accept}
                  style={{ display: 'none' }}
                />
             </button>
          )}
        </div>
      )}
    </div>
  )
}
