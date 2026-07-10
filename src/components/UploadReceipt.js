import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReceiptDisplay from './ReceiptDisplay';
import SplitItems from './SplitItems';
import Loading from './Loading';
import { useToast } from '../context/ToastContext';
import './UploadReceipt.css';

const UploadReceipt = ({ activeReceipt, onReceiptProcessed }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);
    const { addToast } = useToast();

    // Clean up object URL on unmount or when preview changes
    useEffect(() => {
        return () => { if (preview) URL.revokeObjectURL(preview); };
    }, [preview]);

    const acceptFile = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            addToast('Please select an image file', 'error');
            return;
        }
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
    };

    const handleFileChange = (e) => acceptFile(e.target.files[0]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
        acceptFile(e.dataTransfer.files[0]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleUpload = async () => {
        if (!selectedFile) {
            addToast('Please select a receipt image first', 'error');
            return;
        }

        setIsLoading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result.replace('data:', '').replace(/^.+,/, '');
            try {
                const response = await axios.post('/api/process-receipt', { image: base64String });
                onReceiptProcessed(response.data);
                addToast('Receipt processed successfully!', 'success');
                setSelectedFile(null);
                setPreview(null);
            } catch (error) {
                addToast('Failed to process the receipt. Please try again.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsDataURL(selectedFile);
    };

    return (
        <div className="upload-receipt">
            {/* Upload Section */}
            <div className="upload-section">
                <h2>Upload Receipt</h2>
                <p className="upload-section__subtitle">Drag & drop or click to select a receipt image</p>

                <div
                    className={`drop-zone ${isDragOver ? 'drop-zone--active' : ''} ${preview ? 'drop-zone--has-file' : ''}`}
                    onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !preview && fileInputRef.current.click()}
                >
                    {preview ? (
                        <div className="drop-zone__preview-wrap">
                            <img src={preview} alt="Receipt preview" className="drop-zone__preview" />
                            <button
                                className="drop-zone__clear btn btn--sm btn--ghost"
                                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreview(null); }}
                            >
                                ✕ Remove
                            </button>
                        </div>
                    ) : (
                        <div className="drop-zone__placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M4 16l4-4 4 4 4-6 4 6" />
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                            </svg>
                            <p>Drop image here</p>
                            <span>or click to browse</span>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </div>

                <div className="upload-actions">
                    {preview && (
                        <button className="btn btn--ghost" onClick={() => fileInputRef.current.click()}>
                            Change Image
                        </button>
                    )}
                    <button
                        className="btn btn--primary upload-btn"
                        onClick={handleUpload}
                        disabled={isLoading || !selectedFile}
                    >
                        {isLoading ? 'Processing…' : 'Process Receipt'}
                    </button>
                </div>

                {isLoading && <Loading />}
            </div>

            {/* Empty state hint */}
            {!activeReceipt && (
                <p className="upload-receipt__hint">
                    Already have a receipt? Select one from the <strong>Receipts</strong> tab on the left.
                </p>
            )}

            {/* Active Receipt */}
            {activeReceipt && (
                <div className="receipt-content">
                    <ReceiptDisplay
                        receipt={activeReceipt}
                        onUpdateReceipt={onReceiptProcessed}
                    />
                    <SplitItems receipt={activeReceipt} />
                </div>
            )}
        </div>
    );
};

export default UploadReceipt;
