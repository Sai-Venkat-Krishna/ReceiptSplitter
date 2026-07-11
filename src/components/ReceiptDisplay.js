import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import './ReceiptDisplay.css';

const ReceiptDisplay = ({ receipt, onUpdateReceipt }) => {
    const [isEditing, setIsEditing] = useState(null);
    const [editedItems, setEditedItems] = useState(receipt.items);
    const [total, setTotal] = useState(receipt.total);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(receipt.name || '');
    const { addToast } = useToast();

    useEffect(() => {
        setEditedItems(receipt.items);
        setTotal(receipt.total);
        setIsEditing(null);
        setIsEditingName(false);
        setNameDraft(receipt.name || '');
    }, [receipt]);

    const handleSaveName = async () => {
        const trimmed = nameDraft.trim();
        setIsEditingName(false);
        if (!trimmed || trimmed === receipt.name) {
            setNameDraft(receipt.name || '');
            return;
        }
        try {
            const response = await axios.put(`/api/receipts/${receipt._id}`, {
                ...receipt,
                name: trimmed,
                items: editedItems,
                total
            });
            if (onUpdateReceipt) onUpdateReceipt(response.data);
            addToast('Receipt renamed', 'success');
        } catch (error) {
            setNameDraft(receipt.name || '');
            addToast('Failed to rename receipt', 'error');
        }
    };

    const handleInputChange = (index, field, value) => {
        const updated = [...editedItems];
        updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
        updated[index].totalPrice = updated[index].quantity * updated[index].price;
        setEditedItems(updated);
        setTotal(updated.reduce((sum, item) => sum + item.totalPrice, 0));
    };

    const handleDeleteItem = (index) => {
        const updated = editedItems.filter((_, i) => i !== index);
        setEditedItems(updated);
        setTotal(updated.reduce((sum, item) => sum + item.totalPrice, 0));
        if (isEditing === index) setIsEditing(null);
    };

    const handleAddItem = () => {
        const blank = { description: 'New Item', quantity: 1, price: 0, totalPrice: 0, isWeighted: false };
        const updated = [...editedItems, blank];
        setEditedItems(updated);
        setIsEditing(updated.length - 1);
    };

    const handleSaveClick = async () => {
        const newTotal = editedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const updatedReceipt = { ...receipt, items: editedItems, total: newTotal };
        try {
            const response = await axios.put(`/api/receipts/${receipt._id}`, updatedReceipt);
            setEditedItems(response.data.items);
            setTotal(response.data.total);
            if (onUpdateReceipt) onUpdateReceipt(response.data);
            addToast('Receipt saved', 'success');
        } catch (error) {
            addToast('Failed to save changes', 'error');
        }
        setIsEditing(null);
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <div className="receipt-display">
            <div className="receipt-display__header">
                <div>
                    {isEditingName ? (
                        <input
                            className="receipt-display__name-input"
                            value={nameDraft}
                            autoFocus
                            onChange={e => setNameDraft(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={e => {
                                if (e.key === 'Enter') e.target.blur();
                                if (e.key === 'Escape') { setNameDraft(receipt.name || ''); setIsEditingName(false); }
                            }}
                        />
                    ) : (
                        <h3 className="receipt-display__merchant">
                            {receipt.name || 'Unknown Store'}
                            <button
                                className="receipt-display__rename"
                                onClick={() => setIsEditingName(true)}
                                title="Rename receipt"
                                aria-label="Rename receipt"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                </svg>
                            </button>
                        </h3>
                    )}
                    <p className="receipt-display__date">{formatDate(receipt.date)}</p>
                </div>
                <div className="receipt-display__total-badge">
                    ${total.toFixed(2)}
                </div>
            </div>

            <div className="receipt-table-wrap">
                <table className="receipt-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {editedItems.map((item, index) => (
                            <tr key={index} className={item.isWeighted ? 'receipt-table__weighted' : ''}>
                                <td className="receipt-table__desc">
                                    {isEditing === index ? (
                                        <input
                                            className="receipt-table__input receipt-table__input--desc"
                                            type="text"
                                            value={item.description}
                                            onChange={(e) => {
                                                const updated = [...editedItems];
                                                updated[index] = { ...updated[index], description: e.target.value };
                                                setEditedItems(updated);
                                            }}
                                        />
                                    ) : (
                                        <>
                                            {item.description}
                                            {item.isWeighted && <span className="receipt-table__tag">by weight</span>}
                                        </>
                                    )}
                                </td>
                                <td>
                                    {isEditing === index ? (
                                        <input
                                            className="receipt-table__input"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(e) => handleInputChange(index, 'quantity', e.target.value)}
                                        />
                                    ) : item.quantity.toFixed(2)}
                                </td>
                                <td>
                                    {isEditing === index ? (
                                        <input
                                            className="receipt-table__input"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.price}
                                            onChange={(e) => handleInputChange(index, 'price', e.target.value)}
                                        />
                                    ) : `$${item.price.toFixed(2)}`}
                                </td>
                                <td className="receipt-table__item-total">${item.totalPrice.toFixed(2)}</td>
                                <td className="receipt-table__actions">
                                    {isEditing === index ? (
                                        <button className="btn btn--sm btn--primary" onClick={handleSaveClick}>Save</button>
                                    ) : (
                                        <button className="btn btn--sm btn--ghost" onClick={() => setIsEditing(index)}>Edit</button>
                                    )}
                                    <button
                                        className="btn btn--sm btn--danger"
                                        onClick={() => handleDeleteItem(index)}
                                        title="Remove item"
                                    >✕</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {receipt.discount > 0 && (
                            <tr className="receipt-table__discount-row">
                                <td colSpan="3">Discount</td>
                                <td>-${(receipt.discount).toFixed(2)}</td>
                                <td></td>
                            </tr>
                        )}
                        {receipt.tax > 0 && (
                            <tr className="receipt-table__tax-row">
                                <td colSpan="3">Tax</td>
                                <td>${(receipt.tax).toFixed(2)}</td>
                                <td></td>
                            </tr>
                        )}
                        <tr className="receipt-table__total-row">
                            <td colSpan="3"><strong>Total</strong></td>
                            <td><strong>${total.toFixed(2)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="receipt-table-footer">
                <button className="btn btn--ghost btn--sm" onClick={handleAddItem}>
                    + Add Item
                </button>
            </div>
        </div>
    );
};

export default ReceiptDisplay;
