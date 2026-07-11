// Pure helpers for the split feature, extracted from SplitItems for testability.

// Everyone except the payer owes the payer their own share.
export const computeOwedToPayer = (totals, paidBy) => {
    if (!paidBy || !(paidBy in totals)) return [];
    return Object.entries(totals)
        .filter(([name, amount]) => name !== paidBy && amount > 0.005)
        .map(([name, amount]) => ({ from: name, to: paidBy, amount }));
};

// Items nobody is assigned to yet — surfaced so totals aren't silently short.
export const computeUnassigned = (items, splits) => {
    let count = 0;
    let amount = 0;
    const indices = [];
    (items || []).forEach((item, itemIndex) => {
        const anyChecked = Object.values(splits[itemIndex] || {}).some(Boolean);
        if (!anyChecked && item.totalPrice !== 0) {
            count += 1;
            amount += item.totalPrice;
            indices.push(itemIndex);
        }
    });
    return { count, amount, indices };
};

// Splits saved before splitFriends existed stored names in totals-accrual
// order: the order in which friend columns first appear while scanning items
// top to bottom (indices ascending within an item — the same order the totals
// object was built in). Walking the saved assignments the same way maps each
// stored name back to its original column index.
export const reconstructLegacyFriends = (splits, assignments) => {
    const names = (splits || []).map(s => s.personName);
    const appearance = [];
    const seen = new Set();
    [...(assignments || [])]
        .sort((a, b) => a.itemIndex - b.itemIndex)
        .forEach(a => {
            [...(a.friendIndices || [])]
                .sort((x, y) => x - y)
                .forEach(fi => {
                    if (!seen.has(fi)) {
                        seen.add(fi);
                        appearance.push(fi);
                    }
                });
        });
    // Can't map reliably (e.g. duplicate names merged in totals) — keep the
    // stored order rather than guessing.
    if (appearance.length !== names.length || names.length === 0) return names;
    const friends = Array(Math.max(...appearance) + 1).fill('');
    appearance.forEach((fi, k) => { friends[fi] = names[k]; });
    return friends;
};

// Rebuild the SplitItems state for a receipt with a saved split.
// Returns null when the receipt has no saved split.
export const restoreSplitState = (receipt) => {
    if (!receipt || !receipt.splits || receipt.splits.length === 0) return null;
    const friends = (receipt.splitFriends && receipt.splitFriends.length > 0)
        ? [...receipt.splitFriends]
        : reconstructLegacyFriends(receipt.splits, receipt.splitAssignments);
    const splits = {};
    (receipt.splitAssignments || []).forEach(({ itemIndex, friendIndices }) => {
        splits[itemIndex] = {};
        (friendIndices || []).forEach(fi => { splits[itemIndex][fi] = true; });
    });
    return {
        friends: friends.length > 0 ? friends : [''],
        splits,
        includeTax: receipt.splitIncludeTax || false,
        includeDiscount: receipt.splitIncludeDiscount || false,
        paidBy: receipt.splitPaidBy || ''
    };
};

export const buildShareText = (receipt, totals, paidBy = '') => {
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const lines = Object.entries(totals).map(([n, t]) => `${n} — $${t.toFixed(2)}`);
    const header = receipt.name ? `Split for ${receipt.name}` : 'Split Summary';
    const parts = [header, '', ...lines, '', `Total: $${grandTotal.toFixed(2)}`];
    const debts = computeOwedToPayer(totals, paidBy);
    if (debts.length > 0) {
        parts.push('', `${paidBy} paid — send them:`);
        debts.forEach(d => parts.push(`${d.from} → $${d.amount.toFixed(2)}`));
    }
    return parts.join('\n');
};
