import {
    computeOwedToPayer,
    computeUnassigned,
    reconstructLegacyFriends,
    restoreSplitState,
    buildShareText
} from './splitUtils';

describe('computeOwedToPayer', () => {
    it('returns nothing without a payer or with an unknown payer', () => {
        expect(computeOwedToPayer({ Alice: 10, Bob: 5 }, '')).toEqual([]);
        expect(computeOwedToPayer({ Alice: 10, Bob: 5 }, 'Zed')).toEqual([]);
    });

    it('everyone except the payer owes the payer their own share', () => {
        const debts = computeOwedToPayer({ Alice: 30, Bob: 10, Carol: 5 }, 'Bob');
        expect(debts).toEqual([
            { from: 'Alice', to: 'Bob', amount: 30 },
            { from: 'Carol', to: 'Bob', amount: 5 }
        ]);
    });

    it('skips zero shares', () => {
        expect(computeOwedToPayer({ Alice: 0, Bob: 10 }, 'Bob')).toEqual([]);
    });
});

describe('computeUnassigned', () => {
    const items = [
        { description: 'Pizza', totalPrice: 30 },
        { description: 'Salad', totalPrice: 20 },
        { description: 'Freebie', totalPrice: 0 }
    ];

    it('counts items with no checked friends, ignoring zero-priced ones', () => {
        const result = computeUnassigned(items, { 0: { 1: true } });
        expect(result.count).toBe(1);
        expect(result.amount).toBe(20);
        expect(result.indices).toEqual([1]);
    });

    it('treats all-false friend maps as unassigned', () => {
        const result = computeUnassigned(items, { 0: { 1: false }, 1: { 0: true } });
        expect(result.count).toBe(1);
        expect(result.indices).toEqual([0]);
    });
});

describe('reconstructLegacyFriends', () => {
    // Legacy saves stored names in totals-accrual order, not column order.
    // Original columns: Alice(0), Bob(1), Carol(2); checks were
    // Pizza(item 0)→Carol, Salad(item 1)→Bob, Soda(item 2)→Alice,
    // so names were stored as [Carol, Bob, Alice].
    const legacySplits = [
        { personName: 'Carol', amount: 30 },
        { personName: 'Bob', amount: 20 },
        { personName: 'Alice', amount: 10 }
    ];
    const assignments = [
        { itemIndex: 0, friendIndices: [2] },
        { itemIndex: 1, friendIndices: [1] },
        { itemIndex: 2, friendIndices: [0] }
    ];

    it('maps stored names back to their original columns', () => {
        expect(reconstructLegacyFriends(legacySplits, assignments))
            .toEqual(['Alice', 'Bob', 'Carol']);
    });

    it('leaves gaps for columns that had no checked items', () => {
        // Columns: ?(0 unused), Bob(1), Carol(2); accrual order [Carol, Bob]
        const splits = [
            { personName: 'Carol', amount: 30 },
            { personName: 'Bob', amount: 20 }
        ];
        const a = [
            { itemIndex: 0, friendIndices: [2] },
            { itemIndex: 1, friendIndices: [1] }
        ];
        expect(reconstructLegacyFriends(splits, a)).toEqual(['', 'Bob', 'Carol']);
    });

    it('falls back to stored order when the mapping is ambiguous', () => {
        // Two names but three distinct indices — cannot map reliably
        const splits = [
            { personName: 'A', amount: 1 },
            { personName: 'B', amount: 2 }
        ];
        const a = [{ itemIndex: 0, friendIndices: [0, 1, 2] }];
        expect(reconstructLegacyFriends(splits, a)).toEqual(['A', 'B']);
    });
});

describe('restoreSplitState', () => {
    const baseReceipt = {
        _id: 'r1',
        splits: [
            { personName: 'Carol', amount: 30 },
            { personName: 'Bob', amount: 20 },
            { personName: 'Alice', amount: 10 }
        ],
        splitAssignments: [
            { itemIndex: 0, friendIndices: [2] },
            { itemIndex: 1, friendIndices: [1] },
            { itemIndex: 2, friendIndices: [0] }
        ],
        splitIncludeTax: true
    };

    it('returns null when the receipt has no saved split', () => {
        expect(restoreSplitState({ _id: 'x' })).toBeNull();
        expect(restoreSplitState({ _id: 'x', splits: [] })).toBeNull();
    });

    it('uses splitFriends verbatim when present (new format)', () => {
        const receipt = {
            ...baseReceipt,
            splitFriends: ['Alice', 'Bob', 'Carol'],
            splitIncludeDiscount: true,
            splitPaidBy: 'Bob'
        };
        const state = restoreSplitState(receipt);
        expect(state.friends).toEqual(['Alice', 'Bob', 'Carol']);
        expect(state.splits).toEqual({ 0: { 2: true }, 1: { 1: true }, 2: { 0: true } });
        expect(state.includeTax).toBe(true);
        expect(state.includeDiscount).toBe(true);
        expect(state.paidBy).toBe('Bob');
    });

    it('reconstructs column order for legacy saves without splitFriends', () => {
        const state = restoreSplitState(baseReceipt);
        expect(state.friends).toEqual(['Alice', 'Bob', 'Carol']);
        expect(state.splits).toEqual({ 0: { 2: true }, 1: { 1: true }, 2: { 0: true } });
    });

    it('round-trips: a save in column order restores in column order', () => {
        // Simulates what the client sends and the server stores now
        const friends = ['Dan', 'Eve'];
        const receipt = {
            _id: 'r2',
            splits: [{ personName: 'Eve', amount: 5 }, { personName: 'Dan', amount: 5 }],
            splitFriends: friends,
            splitAssignments: [{ itemIndex: 0, friendIndices: [1] }, { itemIndex: 1, friendIndices: [0] }]
        };
        expect(restoreSplitState(receipt).friends).toEqual(friends);
    });
});

describe('buildShareText', () => {
    it('includes the receipt name, per-person lines, and total', () => {
        const text = buildShareText({ name: 'COSTCO' }, { Alice: 10, Bob: 20.5 });
        expect(text).toContain('Split for COSTCO');
        expect(text).toContain('Alice — $10.00');
        expect(text).toContain('Bob — $20.50');
        expect(text).toContain('Total: $30.50');
    });

    it('uses a generic header when the receipt has no name', () => {
        expect(buildShareText({}, { A: 1 })).toContain('Split Summary');
    });

    it('appends who-owes-the-payer lines when a payer is set', () => {
        const text = buildShareText({ name: 'Cafe' }, { Alice: 10, Bob: 20 }, 'Bob');
        expect(text).toContain('Bob paid — send them:');
        expect(text).toContain('Alice → $10.00');
        expect(text).not.toContain('Bob → ');
    });
});
