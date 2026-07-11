import React, { useState } from 'react';
import axios from 'axios';
import ConfirmModal from './ConfirmModal';
import { useToast } from '../context/ToastContext';
import './ReceiptList.css';

const SkeletonCard = () => (
    <div className="receipt-card receipt-card--skeleton">
        <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 12, width: '45%' }} />
    </div>
);

const ReceiptList = ({ receipts, isLoading, activeReceipt, onSelectReceipt, onDeleted }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [receiptToDelete, setReceiptToDelete] = useState(null);
    const { addToast } = useToast();

    const handleDeleteClick = (e, receipt) => {
        e.stopPropagation();
        setReceiptToDelete(receipt);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            await axios.delete(`/api/receipts/${receiptToDelete._id}`);
            onDeleted(receiptToDelete._id);
            addToast('Receipt deleted', 'success');
        } catch (error) {
            addToast('Failed to delete receipt', 'error');
        } finally {
            setIsDeleteModalOpen(false);
            setReceiptToDelete(null);
        }
    };

    const filtered = receipts.filter(r =>
        (r.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="receipt-list">
            <div className="receipt-list__header">
                <h2>Recent Receipts</h2>
                <span className="receipt-list__count">{receipts.length}</span>
            </div>

            <div className="receipt-list__search">
                <input
                    className="receipt-list__search-input"
                    type="text"
                    placeholder="Search by store name…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="receipt-list__items">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
                ) : filtered.length === 0 ? (
                    <div className="receipt-list__empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                            <rect x="9" y="3" width="6" height="4" rx="1" />
                        </svg>
                        {receipts.length === 0 ? (
                            <>
                                <p>No receipts yet</p>
                                <span>Upload your first receipt →</span>
                            </>
                        ) : (
                            <>
                                <p>No matches</p>
                                <span>Try a different search term</span>
                            </>
                        )}
                    </div>
                ) : (
                    filtered.map(receipt => (
                        <div
                            key={receipt._id}
                            className={`receipt-card ${activeReceipt?._id === receipt._id ? 'receipt-card--active' : ''}`}
                            onClick={() => onSelectReceipt(receipt)}
                        >
                            <div className="receipt-card__header">
                                <span className="receipt-card__name">{receipt.name || 'Unknown Store'}</span>
                                <span className="receipt-card__total">${(receipt.total || 0).toFixed(2)}</span>
                            </div>
                            <div className="receipt-card__meta">
                                <span>{new Date(receipt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <span>
                                    {receipt.items?.length || 0} items
                                    {receipt.splits?.length > 0 && (
                                        <span className="receipt-card__split-badge" title={`Split between ${receipt.splits.length} people`}>
                                            ÷{receipt.splits.length}
                                        </span>
                                    )}
                                </span>
                            </div>
                            <button
                                className="btn btn--sm btn--danger receipt-card__delete"
                                onClick={(e) => handleDeleteClick(e, receipt)}
                            >
                                Delete
                            </button>
                        </div>
                    ))
                )}
            </div>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => { setIsDeleteModalOpen(false); setReceiptToDelete(null); }}
                onConfirm={handleDeleteConfirm}
                message={`Delete receipt from ${receiptToDelete?.name || 'this store'}?`}
            />
        </div>
    );
};

export default ReceiptList;
