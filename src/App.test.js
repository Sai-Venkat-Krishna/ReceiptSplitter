import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(() => Promise.resolve({ data: [] })),
        put: jest.fn(() => Promise.resolve({ data: {} })),
        post: jest.fn(() => Promise.resolve({ data: {} })),
        delete: jest.fn(() => Promise.resolve({ data: {} }))
    }
}));

test('renders the app shell', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /receipt splitter/i })).toBeInTheDocument();
    expect(await screen.findAllByText(/recent receipts/i)).not.toHaveLength(0);
});
