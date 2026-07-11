// Pure helpers for the split feature, extracted from SplitItems for testability.

// Settle balances so everyone ends up paying the average of the group totals.
export const computeDebts = (totals) => {
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
        includeTax: receipt.splitIncludeTax || false
    };
};

export const buildShareText = (receipt, totals) => {
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const lines = Object.entries(totals).map(([n, t]) => `${n} — $${t.toFixed(2)}`);
    const header = receipt.name ? `Split for ${receipt.name}` : 'Split Summary';
    return [header, '', ...lines, '', `Total: $${grandTotal.toFixed(2)}`].join('\n');
};
