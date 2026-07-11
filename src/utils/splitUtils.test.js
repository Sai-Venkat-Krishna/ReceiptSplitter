import {
    computeDebts,
    reconstructLegacyFriends,
    restoreSplitState,
    buildShareText
} from './splitUtils';

describe('computeDebts', () => {
    it('returns no debts for fewer than two people', () => {
        expect(computeDebts({})).toEqual([]);
        expect(computeDebts({ Alice: 10 })).toEqual([]);
    });

    it('returns no debts when everyone owes the same', () => {
        expect(computeDebts({ Alice: 10, Bob: 10 })).toEqual([]);
    });

    it('settles the person above the mean with the person below it', () => {
        const debts = computeDebts({ Alice: 30, Bob: 10 });
        expect(debts).toHaveLength(1);
        expect(debts[0].from).toBe('Alice');
        expect(debts[0].to).toBe('Bob');
        expect(debts[0].amount).toBeCloseTo(10);
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
        const receipt = { ...baseReceipt, splitFriends: ['Alice', 'Bob', 'Carol'] };
        const state = restoreSplitState(receipt);
        expect(state.friends).toEqual(['Alice', 'Bob', 'Carol']);
        expect(state.splits).toEqual({ 0: { 2: true }, 1: { 1: true }, 2: { 0: true } });
        expect(state.includeTax).toBe(true);
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
});
