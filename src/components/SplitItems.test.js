import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SplitItems from './SplitItems';
import { ToastProvider } from '../context/ToastContext';
import { PeopleProvider } from '../context/PeopleContext';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(() => Promise.resolve({ data: [] })),
        put: jest.fn(() => Promise.resolve({ data: {} })),
        post: jest.fn(() => Promise.resolve({ data: {} })),
        delete: jest.fn(() => Promise.resolve({ data: {} }))
    }
}));
const axios = require('axios').default;

const renderSplit = (receipt, props = {}) => render(
    <ToastProvider>
        <PeopleProvider>
            <SplitItems receipt={receipt} {...props} />
        </PeopleProvider>
    </ToastProvider>
);

const items = [
    { description: 'Pizza', totalPrice: 30 },
    { description: 'Salad', totalPrice: 20 },
    { description: 'Soda', totalPrice: 10 }
];

// Alice(col 0)→Soda, Bob(col 1)→Salad, Carol(col 2)→Pizza
const assignments = [
    { itemIndex: 0, friendIndices: [2] },
    { itemIndex: 1, friendIndices: [1] },
    { itemIndex: 2, friendIndices: [0] }
];
// Names stored in totals-accrual order, as the server derives them
const storedSplits = [
    { personName: 'Carol', amount: 30 },
    { personName: 'Bob', amount: 20 },
    { personName: 'Alice', amount: 10 }
];

const expectRestoredColumns = async () => {
    // Column headers in original order — regression for the jumbled-names bug
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['Item', 'Price', 'Alice', 'Bob', 'Carol']);

    // Checkbox grid restored: rows x columns, row-major
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(9);
    const checked = boxes.map(b => b.checked);
    expect(checked).toEqual([
        false, false, true,   // Pizza → Carol
        false, true, false,   // Salad → Bob
        true, false, false    // Soda → Alice
    ]);

    // Per-person totals follow the names, not the columns
    await waitFor(() => {
        const rows = [...document.querySelectorAll('.split-summary__row')].map(r => r.textContent);
        expect(rows.find(t => t.includes('Carol'))).toContain('$30.00');
        expect(rows.find(t => t.includes('Alice'))).toContain('$10.00');
    });
};

describe('SplitItems restore', () => {
    it('restores names onto their original columns (new splitFriends format)', async () => {
        renderSplit({
            _id: 'r1',
            name: 'Test',
            total: 60,
            tax: 0,
            items,
            splits: storedSplits,
            splitFriends: ['Alice', 'Bob', 'Carol'],
            splitAssignments: assignments
        });
        await expectRestoredColumns();
    });

    it('reconstructs the original column order for legacy saves', async () => {
        renderSplit({
            _id: 'r2',
            name: 'Legacy',
            total: 60,
            tax: 0,
            items,
            splits: storedSplits,
            splitAssignments: assignments
        });
        await expectRestoredColumns();
    });
});

describe('SplitItems save', () => {
    it('sends the friends array in column order and reports the update', async () => {
        const updated = { _id: 'r3', splitFriends: ['Alice', 'Bob', 'Carol'] };
        axios.put.mockResolvedValueOnce({ data: updated });
        const onSplitSaved = jest.fn();

        renderSplit({
            _id: 'r3',
            name: 'Save me',
            total: 60,
            tax: 0,
            items,
            splits: storedSplits,
            splitFriends: ['Alice', 'Bob', 'Carol'],
            splitAssignments: assignments
        }, { onSplitSaved });

        const saveBtn = await screen.findByRole('button', { name: /save split/i });
        await userEvent.click(saveBtn);

        await waitFor(() => expect(axios.put).toHaveBeenCalled());
        const [url, body] = axios.put.mock.calls[0];
        expect(url).toBe('/api/receipts/r3/splits');
        expect(body.friends).toEqual(['Alice', 'Bob', 'Carol']);
        expect(body.assignments).toEqual(assignments);
        expect(onSplitSaved).toHaveBeenCalledWith(updated);
    });
});
