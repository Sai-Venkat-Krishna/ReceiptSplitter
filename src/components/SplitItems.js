import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toSvg } from 'html-to-image';
import { useToast } from '../context/ToastContext';
import { usePeople } from '../context/PeopleContext';
import {
    computeOwedToPayer,
    computeUnassigned,
    restoreSplitState,
    buildShareText
} from '../utils/splitUtils';
import './SplitItems.css';

const SplitItems = ({ receipt, onSplitSaved }) => {
    const [friends, setFriends] = useState(['']);
    const [splits, setSplits] = useState({});
    const [totals, setTotals] = useState({});
    const [includeTax, setIncludeTax] = useState(false);
    const [includeDiscount, setIncludeDiscount] = useState(false);
    const [paidBy, setPaidBy] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [shareImage, setShareImage] = useState(null); // { blob, dataUrl, file }
    const captureRef = useRef(null);
    const { addToast } = useToast();
    const { people, addPerson } = usePeople();

    // Pre-load saved splits when receipt changes
    useEffect(() => {
        const saved = restoreSplitState(receipt);
        if (saved) {
            setFriends(saved.friends);
            setSplits(saved.splits);
            setIncludeTax(saved.includeTax);
            setIncludeDiscount(saved.includeDiscount);
            setPaidBy(saved.paidBy);
        } else {
            setFriends(['']);
            setSplits({});
            setTotals({});
            setIncludeTax(false);
            setIncludeDiscount(false);
            setPaidBy('');
        }
        setShareImage(null);
    }, [receipt._id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Recalculate totals whenever splits, friends, or toggles change
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
            if (includeDiscount && receipt.discount > 0) {
                itemBase -= receipt.discount * (item.totalPrice / receiptTotal);
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
    }, [splits, friends, receipt.items, receipt.tax, receipt.discount, receipt.total, includeTax, includeDiscount]);

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

    // ── Bulk assignment helpers ─────────────────────────────
    const isColumnFull = (friendIndex) =>
        receipt.items.length > 0 && receipt.items.every((_, i) => splits[i]?.[friendIndex]);

    const toggleColumn = (friendIndex) => {
        const value = !isColumnFull(friendIndex);
        setSplits(prev => {
            const next = { ...prev };
            receipt.items.forEach((_, itemIndex) => {
                next[itemIndex] = { ...next[itemIndex], [friendIndex]: value };
            });
            return next;
        });
    };

    const isRowFull = (itemIndex) =>
        friends.length > 0 && friends.every((_, fi) => splits[itemIndex]?.[fi]);

    const toggleRow = (itemIndex) => {
        const value = !isRowFull(itemIndex);
        setSplits(prev => ({
            ...prev,
            [itemIndex]: Object.fromEntries(friends.map((_, fi) => [fi, value]))
        }));
    };

    const splitEvenly = () => {
        setSplits(Object.fromEntries(
            receipt.items.map((_, i) => [i, Object.fromEntries(friends.map((_, fi) => [fi, true]))])
        ));
    };

    const clearAll = () => setSplits({});

    // ── Sharing ─────────────────────────────────────────────
    const handleShare = async () => {
        const text = buildShareText(receipt, totals, paidBy);
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

    // Step 1: render the capture zone to a PNG and open the share modal.
    // Sharing happens from the modal buttons so navigator.share / clipboard
    // run inside a fresh tap — calling them after the slow capture loses the
    // user-gesture window and iOS rejects them with NotAllowedError.
    const handleGenerateImage = async () => {
        if (!captureRef.current) return;
        setIsCapturing(true);

        try {
            const el = captureRef.current;
            const width = el.offsetWidth;
            const height = el.scrollHeight;
            // The capture clones attributes, not live DOM state — sync the
            // checked attribute so boxes toggled after mount show up
            el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.checked) cb.setAttribute('checked', '');
                else cb.removeAttribute('checked');
            });
            // toSvg + manual rasterization instead of toPng: the library's
            // toPng waits on img.decode()/requestAnimationFrame, which never
            // settles on iOS Safari (decode() rejects on large foreignObject
            // SVGs) or in background tabs — the button hung on "Working…".
            const svgUri = await toSvg(el, {
                height,
                // Embedding the cross-origin Google Font makes the capture
                // slow and flaky (multi-MB inline SVG); the system-font
                // fallback renders fine
                skipFonts: true,
                style: { height: `${height}px`, overflow: 'visible' },
                filter: (node) => {
                    const cls = node.classList;
                    return !cls?.contains('split-summary__actions')
                        && !cls?.contains('split-colall')
                        && !cls?.contains('split-rowall')
                        && !cls?.contains('split-paidby');
                }
            });
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('SVG render failed'));
                img.src = svgUri;
            });
            if (img.decode) await img.decode().catch(() => {});
            // Give Safari a beat to paint the foreignObject before drawing
            await new Promise(r => setTimeout(r, 100));

            const pixelRatio = 2;
            const canvas = document.createElement('canvas');
            canvas.width = width * pixelRatio;
            canvas.height = height * pixelRatio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/png');
            const blob = await new Promise((resolve, reject) =>
                canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
            );
            const file = new File([blob], 'split-summary.png', { type: 'image/png' });
            setShareImage({ blob, dataUrl, file });
        } catch {
            addToast('Failed to create image', 'error');
        } finally {
            setIsCapturing(false);
        }
    };

    const handleShareImageFile = async () => {
        try {
            await navigator.share({ files: [shareImage.file], title: 'Split Summary' });
            setShareImage(null);
        } catch (err) {
            if (err.name !== 'AbortError') addToast('Share failed', 'error');
        }
    };

    const handleCopyImageToClipboard = async () => {
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': shareImage.blob })]);
            addToast('Image copied to clipboard!', 'success');
            setShareImage(null);
        } catch {
            addToast('Copy failed', 'error');
        }
    };

    const handleDownloadImage = () => {
        const url = URL.createObjectURL(shareImage.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'split-summary.png';
        a.click();
        URL.revokeObjectURL(url);
        setShareImage(null);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(buildShareText(receipt, totals, paidBy))
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

            const res = await axios.put(`/api/receipts/${receipt._id}/splits`, {
                totals,
                friends,
                assignments,
                includeTax,
                includeDiscount,
                paidBy
            });
            if (onSplitSaved) onSplitSaved(res.data);
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

    const hasTotals = Object.keys(totals).length > 0;
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const namedFriends = [...new Set(friends.filter(f => f.trim()))];
    const debts = computeOwedToPayer(totals, paidBy);
    const unassigned = computeUnassigned(receipt.items, splits);
    const anyAssigned = receipt.items.length > 0 && unassigned.count < receipt.items.filter(i => i.totalPrice !== 0).length;

    return (
        <div className="split-items">
            {/* Header */}
            <div className="split-items__header">
                <h3>Split Items</h3>
                <div className="split-items__toggles">
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
                    {receipt.discount > 0 && (
                        <label className="tax-toggle">
                            <input
                                type="checkbox"
                                checked={includeDiscount}
                                onChange={e => setIncludeDiscount(e.target.checked)}
                            />
                            <span>Apply discount (−${receipt.discount.toFixed(2)})</span>
                        </label>
                    )}
                </div>
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

            {/* Bulk tools */}
            {receipt.items.length > 0 && (
                <div className="split-toolbar">
                    <button className="btn btn--sm btn--ghost split-toolbar__btn" onClick={splitEvenly} title="Check everyone for every item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        Split everything evenly
                    </button>
                    <button className="btn btn--sm btn--ghost split-toolbar__btn" onClick={clearAll} title="Uncheck everything">
                        Clear all
                    </button>
                    <span className="split-toolbar__hint">Tip: “All” buttons assign a whole row or column at once</span>
                </div>
            )}

            {/* Capture zone: table + summary */}
            <div ref={captureRef} className="split-capture-zone">

            {/* Split Table */}
            <div className="split-table-wrap">
                <table className="split-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Price</th>
                            {friends.map((friend, index) => (
                                <th key={index}>
                                    <span className="split-th-name">{friend || `Friend ${index + 1}`}</span>
                                    <button
                                        className="split-colall"
                                        onClick={() => toggleColumn(index)}
                                        title={`Toggle all items for ${friend || `Friend ${index + 1}`}`}
                                        aria-label={`Toggle all items for ${friend || `Friend ${index + 1}`}`}
                                    >
                                        All
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {receipt.items.map((item, itemIndex) => {
                            const shareCount = Object.values(splits[itemIndex] || {}).filter(Boolean).length;
                            const isUnassigned = anyAssigned && shareCount === 0 && item.totalPrice !== 0;
                            return (
                                <tr key={itemIndex} className={isUnassigned ? 'split-table__row--unassigned' : ''}>
                                    <td className="split-table__desc">
                                        <span className="split-desc-text">{item.description}</span>
                                        <button
                                            className="split-rowall"
                                            onClick={() => toggleRow(itemIndex)}
                                            title="Toggle everyone for this item"
                                            aria-label={`Toggle everyone for ${item.description}`}
                                        >
                                            All
                                        </button>
                                    </td>
                                    <td className="split-table__price">
                                        ${item.totalPrice.toFixed(2)}
                                        {shareCount > 1 && (
                                            <span className="split-share-count" title={`Split ${shareCount} ways`}>÷{shareCount}</span>
                                        )}
                                    </td>
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
                            );
                        })}
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
                            <button className="btn btn--sm btn--ghost split-summary__share-btn" onClick={handleGenerateImage} disabled={isCapturing} title="Share summary as image">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                {isCapturing ? 'Working…' : 'Image'}
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
                            const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                            return (
                                <div key={name} className="split-summary__row">
                                    <span
                                        className="split-summary__avatar"
                                        style={contact ? { background: contact.color } : {}}
                                    >
                                        {name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="split-summary__person">
                                        <span className="split-summary__name">
                                            {name}
                                            {paidBy === name && <span className="split-summary__paid-badge">paid</span>}
                                        </span>
                                        <span className="split-summary__bar">
                                            <span
                                                className="split-summary__bar-fill"
                                                style={{ width: `${pct}%`, background: contact?.color || 'var(--color-primary)' }}
                                            />
                                        </span>
                                    </span>
                                    <span className="split-summary__figures">
                                        <span className="split-summary__amount">${total.toFixed(2)}</span>
                                        <span className="split-summary__pct">{pct.toFixed(0)}%</span>
                                    </span>
                                </div>
                            );
                        })}
                        {unassigned.count > 0 && (
                            <div className="split-summary__unassigned">
                                ⚠ {unassigned.count} item{unassigned.count > 1 ? 's' : ''} unassigned · ${unassigned.amount.toFixed(2)}
                            </div>
                        )}
                        <div className="split-summary__total-row">
                            <span className="split-summary__total-label">Total</span>
                            <span className="split-summary__total-amount">
                                ${grandTotal.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Who paid → who owes whom */}
                    <div className="split-paidby">
                        <label className="split-paidby__label">
                            Paid by
                            <span className="split-paidby__select-wrap">
                                <select
                                    className="split-paidby__select"
                                    value={namedFriends.includes(paidBy) ? paidBy : ''}
                                    onChange={e => setPaidBy(e.target.value)}
                                >
                                    <option value="">— select —</option>
                                    {namedFriends.map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </span>
                        </label>
                        {paidBy && !debts.length && namedFriends.includes(paidBy) && (
                            <span className="split-paidby__note">Nobody owes anything yet</span>
                        )}
                    </div>

                    {debts.length > 0 && (
                        <div className="split-debts">
                            <p className="split-debts__label">Who owes {paidBy}</p>
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

            {/* Image share modal — buttons run in a fresh tap so the native
                share sheet / clipboard aren't blocked by an expired gesture */}
            {shareImage && (
                <div className="share-modal-overlay" onClick={() => setShareImage(null)}>
                    <div className="share-modal" onClick={e => e.stopPropagation()}>
                        <img
                            className="share-modal__preview"
                            src={shareImage.dataUrl}
                            alt="Split summary preview"
                        />
                        <div className="share-modal__actions">
                            {navigator.canShare && navigator.canShare({ files: [shareImage.file] }) && (
                                <button className="btn btn--sm btn--primary" onClick={handleShareImageFile}>
                                    Share…
                                </button>
                            )}
                            {navigator.clipboard?.write && typeof ClipboardItem !== 'undefined' && (
                                <button className="btn btn--sm btn--ghost" onClick={handleCopyImageToClipboard}>
                                    Copy
                                </button>
                            )}
                            <button className="btn btn--sm btn--ghost" onClick={handleDownloadImage}>
                                Download
                            </button>
                            <button className="btn btn--sm btn--ghost" onClick={() => setShareImage(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SplitItems;
