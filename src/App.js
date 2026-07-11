import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ToastProvider } from './context/ToastContext';
import { PeopleProvider } from './context/PeopleContext';
import UploadReceipt from './components/UploadReceipt';
import ReceiptList from './components/ReceiptList';
import PeopleManager from './components/PeopleManager';
import './App.css';

const getInitialTheme = () => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const App = () => {
    const [activeReceipt, setActiveReceipt] = useState(null);
    const [sidebarTab, setSidebarTab] = useState('receipts');
    const [mobileView, setMobileView] = useState('receipts');
    const [theme, setTheme] = useState(getInitialTheme);

    // Receipts live here so the sidebar and mobile lists share one source
    // of truth and stay fresh after uploads, saves, and deletes
    const [receipts, setReceipts] = useState([]);
    const [isLoadingReceipts, setIsLoadingReceipts] = useState(true);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    }, [theme]);

    const fetchReceipts = useCallback(async () => {
        setIsLoadingReceipts(true);
        try {
            const response = await axios.get('/api/receipts');
            setReceipts(response.data);
            return true;
        } catch (error) {
            return false;
        } finally {
            setIsLoadingReceipts(false);
        }
    }, []);

    useEffect(() => {
        fetchReceipts();
    }, [fetchReceipts]);

    const handleSelectReceipt = (receipt) => {
        setActiveReceipt(receipt);
        if (receipt) setMobileView('upload');
    };

    // New or updated receipt coming back from the API — merge into the list
    const upsertReceipt = (receipt) => {
        if (!receipt) {
            setActiveReceipt(null);
            return;
        }
        setReceipts(prev => {
            const idx = prev.findIndex(r => r._id === receipt._id);
            if (idx === -1) return [receipt, ...prev];
            const next = [...prev];
            next[idx] = receipt;
            return next;
        });
        setActiveReceipt(receipt);
        setMobileView('upload');
    };

    const handleReceiptDeleted = (id) => {
        setReceipts(prev => prev.filter(r => r._id !== id));
        if (activeReceipt && activeReceipt._id === id) setActiveReceipt(null);
    };

    const listProps = {
        receipts,
        isLoading: isLoadingReceipts,
        activeReceipt,
        onDeleted: handleReceiptDeleted
    };

    return (
        <ToastProvider>
            <PeopleProvider>
                <div className="app-layout">
                    <header className="app-header">
                        <span className="app-header__logo">
                            <svg className="app-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                                <rect x="9" y="3" width="6" height="4" rx="1" />
                                <path d="M9 12h6M9 16h4" />
                            </svg>
                        </span>
                        <h1>Receipt Splitter</h1>
                        {mobileView === 'upload' && (
                            <button
                                className="app-header__back"
                                onClick={() => setMobileView('receipts')}
                                aria-label="Back to receipts"
                            >
                                ← Back
                            </button>
                        )}
                        <button
                            className="theme-toggle"
                            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            aria-label="Toggle dark mode"
                        >
                            {theme === 'dark' ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="5"/>
                                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                                </svg>
                            )}
                        </button>
                    </header>

                    <div className="app-body">
                        {/* Desktop sidebar */}
                        <aside className="sidebar">
                            <div className="sidebar-tabs">
                                <button
                                    className={`sidebar-tab ${sidebarTab === 'receipts' ? 'sidebar-tab--active' : ''}`}
                                    onClick={() => setSidebarTab('receipts')}
                                >Receipts</button>
                                <button
                                    className={`sidebar-tab ${sidebarTab === 'people' ? 'sidebar-tab--active' : ''}`}
                                    onClick={() => setSidebarTab('people')}
                                >People</button>
                            </div>
                            {sidebarTab === 'receipts' ? (
                                <ReceiptList {...listProps} onSelectReceipt={setActiveReceipt} />
                            ) : (
                                <PeopleManager />
                            )}
                        </aside>

                        {/* Desktop main panel */}
                        <main className="main-panel">
                            <UploadReceipt activeReceipt={activeReceipt} onReceiptProcessed={upsertReceipt} />
                        </main>

                        {/* Mobile views */}
                        <div className="mobile-content">
                            {mobileView === 'receipts' && (
                                <ReceiptList {...listProps} onSelectReceipt={handleSelectReceipt} />
                            )}
                            {mobileView === 'upload' && (
                                <UploadReceipt activeReceipt={activeReceipt} onReceiptProcessed={upsertReceipt} />
                            )}
                            {mobileView === 'people' && <PeopleManager />}
                        </div>
                    </div>

                    {/* Mobile bottom nav */}
                    <nav className="mobile-nav">
                        <button
                            className={`mobile-nav__tab ${mobileView === 'receipts' ? 'mobile-nav__tab--active' : ''}`}
                            onClick={() => setMobileView('receipts')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                                <rect x="9" y="3" width="6" height="4" rx="1"/>
                                <path d="M9 12h6M9 16h4"/>
                            </svg>
                            <span>Receipts</span>
                        </button>
                        <button
                            className={`mobile-nav__tab mobile-nav__tab--upload ${mobileView === 'upload' ? 'mobile-nav__tab--active' : ''}`}
                            onClick={() => setMobileView('upload')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                            <span>Upload</span>
                        </button>
                        <button
                            className={`mobile-nav__tab ${mobileView === 'people' ? 'mobile-nav__tab--active' : ''}`}
                            onClick={() => setMobileView('people')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                            </svg>
                            <span>People</span>
                        </button>
                    </nav>
                </div>
            </PeopleProvider>
        </ToastProvider>
    );
};

export default App;
