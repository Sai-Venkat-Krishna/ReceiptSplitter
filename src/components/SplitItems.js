import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toPng } from 'html-to-image';
import { useToast } from '../context/ToastContext';
import { usePeople } from '../context/PeopleContext';
import './SplitItems.css';

const computeDebts = (totals) => {
    const names = Object.keys(totals);
    if (names.length < 2) return [];
    const mean = Object.values(totals).reduce((a, b) => a + b, 0) / names.length;
    const balances = names.map(name => ({ name, balance: totals[name] - mean }));
    const debtors   = balances.filter(b => b.balance >  0.005).sort((a, b) => b.balance - a.balance);
    const creditors = balances.filter(b => b.balance < -0.005).sort((a, b) => a.balance - b.balance);
    const debts = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(debtors[i].balance, -creditors[j].balance);
        debts.push({ from: debtors[i].name, to: creditors[j].name, amount });
        debtors[i].balance  -= amount;
        creditors[j].balance += amount;
        if (Math.abs(debtors[i].balance)  < 0.005) i++;
        if (Math.abs(creditors[j].balance) < 0.005) j++;
    }
    return debts;
};

const SplitItems = ({ receipt }) => {
    const [friends, setFriends] = useState(['']);
    const [splits, setSplits] = useState({});
    const [totals, setTotals] = useState({});
    const [includeTax, setIncludeTax] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const summaryRef = useRef(null);
    const { addToast } = useToast();
    const { people, addPerson } = usePeople();

    // Pre-load saved splits when receipt changes
    useEffect(() => {
        if (receipt.splits && receipt.splits.length > 0) {
            const savedNames = receipt.splits.map(s => s.personName);
            setFriends(savedNames);

            // Restore checkbox assignments
            const restoredSplits = {};
            (receipt.splitAssignments || []).forEach(({ itemIndex, friendIndices }) => {
                restoredSplits[itemIndex] = {};
                (friendIndices || []).forEach(fi => { restoredSplits[itemIndex][fi] = true; });
            });
            setSplits(restoredSplits);
            setIncludeTax(receipt.splitIncludeTax || false);
        } else {
            setFriends(['']);
            setSplits({});
            setTotals({});
            setIncludeTax(false);
        }
    }, [receipt._id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Recalculate totals whenever splits, friends, or tax toggle changes
    useEffect(() => {
        const newTotals = {};
        const receiptTotal = receipt.total || 1;
        receipt.items.forEach((item, itemIndex) => {
            const itemSplits = splits[itemIndex];
            if (!itemSplits) return;
            const splitCount = Object.values(itemSplits).filter(Boolean).length;
            if (splitCount === 0) return;
            let itemBase = item.totalPrice;
            if (includeTax && receipt.tax > 0) {
                itemBase += receipt.tax * (item.totalPrice / receiptTotal);
            }
            const splitAmount = itemBase / splitCount;
            Object.entries(itemSplits).forEach(([fi, isSplit]) => {
                if (isSplit) {
                    const name = friends[fi] || `Friend ${parseInt(fi) + 1}`;
                    newTotals[name] = (newTotals[name] || 0) + splitAmount;
                }
            });
        });
        setTotals(newTotals);
    }, [splits, friends, receipt.items, receipt.tax, receipt.total, includeTax]);

    const addFriend = (name = '') => setFriends(prev => [...prev, name]);

    const updateFriend = (index, name) => {
        setFriends(prev => { const u = [...prev]; u[index] = name; return u; });
    };

    const removeFriend = (index) => {
        setFriends(prev => prev.filter((_, i) => i !== index));
        setSplits(prev => {
            const next = {};
            Object.entries(prev).forEach(([itemIdx, friendMap]) => {
                const newMap = {};
                Object.entries(friendMap).forEach(([fi, val]) => {
                    const fiNum = parseInt(fi);
                    if (fiNum !== index) {
                        const newKey = fiNum > index ? String(fiNum - 1) : fi;
                        newMap[newKey] = val;
                    }
                });
                next[itemIdx] = newMap;
            });
            return next;
        });
    };

    const handleSplitChange = (itemIndex, friendIndex) => {
        setSplits(prev => ({
            ...prev,
            [itemIndex]: {
                ...prev[itemIndex],
                [friendIndex]: !prev[itemIndex]?.[friendIndex]
            }
        }));
    };

    const buildShareText = () => {
        const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
        const lines = Object.entries(totals).map(([n, t]) => `${n} — $${t.toFixed(2)}`);
        const header = receipt.name ? `Split for ${receipt.name}` : 'Split Summary';
        return [header, '', ...lines, '', `Total: $${grandTotal.toFixed(2)}`].join('\n');
    };

    const handleShare = async () => {
        const text = buildShareText();
        if (navigator.share) {
            try {
                await navigator.share({ text });
            } catch (err) {
                if (err.name !== 'AbortError') addToast('Share failed', 'error');
            }
        } else {
            navigator.clipboard.writeText(text)
                .then(() => addToast('Copied to clipboard!', 'success'))
                .catch(() => addToast('Copy failed', 'error'));
        }
    };

    const handleCopyImage = async () => {
        if (!summaryRef.current) return;
        setIsCapturing(true);

        // Hide elements we don't want in the image
        const debts = summaryRef.current.querySelector('.split-debts');
        const actions = summaryRef.current.querySelector('.split-summary__actions');
        if (debts) debts.style.display = 'none';
        if (actions) actions.style.display = 'none';

        try {
            const dataUrl = await toPng(summaryRef.current, {
                pixelRatio: 2,
                style: { borderRadius: '12px' }
            });
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            addToast('Image copied to clipboard!', 'success');
        } catch {
            addToast('Failed to copy image', 'error');
        } finally {
            if (debts) debts.style.display = '';
            if (actions) actions.style.display = '';
            setIsCapturing(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(buildShareText())
            .then(() => addToast('Summary copied to clipboard!', 'success'))
            .catch(() => addToast('Copy failed', 'error'));
    };

    const handleSaveSplit = async () => {
        if (!hasTotals) return;
        setIsSaving(true);
        try {
            const assignments = Object.entries(splits).map(([itemIndex, friendMap]) => ({
                itemIndex: parseInt(itemIndex),
                friendIndices: Object.entries(friendMap)
                    .filter(([, checked]) => checked)
                    .map(([fi]) => parseInt(fi))
            })).filter(a => a.friendIndices.length > 0);

            await axios.put(`/api/receipts/${receipt._id}/splits`, { totals, assignments, includeTax });
            addToast('Split saved!', 'success');
        } catch {
            addToast('Failed to save split', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveToContacts = async (name) => {
        const saved = await addPerson(name);
        if (saved) addToast(`${name} saved to contacts`, 'success');
    };

    // Saved people not already added to this split
    const availableContacts = people.filter(p => !friends.includes(p.name));

    const debts = computeDebts(totals);
    const hasTotals = Object.keys(totals).length > 0;

    return (
        <div className="split-items">
            {/* Header */}
            <div className="split-items__header">
                <h3>Split Items</h3>
                {receipt.tax > 0 && (
                    <label className="tax-toggle">
                        <input
                            type="checkbox"
                            checked={includeTax}
                            onChange={e => setIncludeTax(e.target.checked)}
                        />
                        <span>Include tax (${receipt.tax.toFixed(2)})</span>
                    </label>
                )}
            </div>

            {/* Quick-add from contacts */}
            {availableContacts.length > 0 && (
                <div className="contacts-quickadd">
                    <span className="contacts-quickadd__label">From contacts:</span>
                    <div className="contacts-quickadd__chips">
                        {availableContacts.map(p => (
                            <button
                                key={p._id}
                                className="contacts-quickadd__chip"
                                style={{ '--chip-color': p.color }}
                                onClick={() => addFriend(p.name)}
                                title={`Add ${p.name}`}
                            >
                                <span
                                    className="contacts-quickadd__avatar"
                                    style={{ background: p.color }}
                                >
                                    {p.name.charAt(0).toUpperCase()}
                                </span>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Friends (current split participants) */}
            <div className="friends-section">
                <div className="friends-chips">
                    {friends.map((friend, index) => {
                        const isInContacts = people.some(p => p.name === friend);
                        const savedPerson = people.find(p => p.name === friend);
                        return (
                            <div key={index} className="friend-chip">
                                <span
                                    className="friend-chip__avatar"
                                    style={savedPerson ? { background: savedPerson.color } : {}}
                                >
                                    {(friend || `F${index + 1}`).charAt(0).toUpperCase()}
                                </span>
                                <input
                                    className="friend-chip__input"
                                    type="text"
                                    value={friend}
                                    onChange={(e) => updateFriend(index, e.target.value)}
                                    placeholder={`Friend ${index + 1}`}
                                />
                                {friend && !isInContacts && (
                                    <button
                                        className="friend-chip__save"
                                        onClick={() => handleSaveToContacts(friend)}
                                        title="Save to contacts"
                                    >
                                        +
                                    </button>
                                )}
                                {friends.length > 1 && (
                                    <button
                                        className="friend-chip__remove"
                                        onClick={() => removeFriend(index)}
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => addFriend('')}>
                    + Add Guest
                </button>
            </div>

            {/* Capture zone: table + summary */}
            <div ref={summaryRef} className="split-capture-zone">

            {/* Split Table */}
            <div className="split-table-wrap">
                <table className="split-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Price</th>
                            {friends.map((friend, index) => (
                                <th key={index}>{friend || `Friend ${index + 1}`}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {receipt.items.map((item, itemIndex) => (
                            <tr key={itemIndex}>
                                <td className="split-table__desc">{item.description}</td>
                                <td className="split-table__price">${item.totalPrice.toFixed(2)}</td>
                                {friends.map((_, friendIndex) => (
                                    <td key={friendIndex} className="split-table__check">
                                        <input
                                            type="checkbox"
                                            className="split-checkbox"
                                            checked={splits[itemIndex]?.[friendIndex] || false}
                                            onChange={() => handleSplitChange(itemIndex, friendIndex)}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            {hasTotals && (
                <div className="split-summary">
                    <div className="split-summary__header">
                        <h4>Summary</h4>
                        <div className="split-summary__actions">
                            <button className="btn btn--sm btn--ghost" onClick={handleCopy} title="Copy text">
                                Copy
                            </button>
                            <button className="btn btn--sm btn--ghost split-summary__share-btn" onClick={handleShare} title="Share text">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                </svg>
                                Share
                            </button>
                            <button className="btn btn--sm btn--ghost split-summary__share-btn" onClick={handleCopyImage} disabled={isCapturing} title="Copy summary as image">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                {isCapturing ? 'Copying…' : 'Image'}
                            </button>
                            <button
                                className="btn btn--sm btn--primary"
                                onClick={handleSaveSplit}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving…' : 'Save Split'}
                            </button>
                        </div>
                    </div>

                    <div className="split-summary__totals">
                        {Object.entries(totals).map(([name, total]) => {
                            const contact = people.find(p => p.name === name);
                            return (
                                <div key={name} className="split-summary__row">
                                    <span
                                        className="split-summary__avatar"
                                        style={contact ? { background: contact.color } : {}}
                                    >
                                        {name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="split-summary__name">{name}</span>
                                    <span className="split-summary__amount">${total.toFixed(2)}</span>
                                </div>
                            );
                        })}
                        <div className="split-summary__total-row">
                            <span className="split-summary__total-label">Total</span>
                            <span className="split-summary__total-amount">
                                ${Object.values(totals).reduce((a, b) => a + b, 0).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {debts.length > 0 && (
                        <div className="split-debts">
                            <p className="split-debts__label">Who owes whom</p>
                            {debts.map((d, i) => (
                                <div key={i} className="split-debt-item">
                                    <span className="split-debt-item__from">{d.from}</span>
                                    <span className="split-debt-item__arrow">→</span>
                                    <span className="split-debt-item__to">{d.to}</span>
                                    <span className="split-debt-item__amount">${d.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            </div>{/* end split-capture-zone */}
        </div>
    );
};

export default SplitItems;
