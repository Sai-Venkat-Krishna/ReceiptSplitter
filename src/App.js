import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { PeopleProvider } from './context/PeopleContext';
import UploadReceipt from './components/UploadReceipt';
import ReceiptList from './components/ReceiptList';
import PeopleManager from './components/PeopleManager';
import './App.css';

const App = () => {
    const [activeReceipt, setActiveReceipt] = useState(null);
    const [sidebarTab, setSidebarTab] = useState('receipts');
    const [mobileView, setMobileView] = useState('receipts');

    const handleSelectReceipt = (receipt) => {
        setActiveReceipt(receipt);
        if (receipt) setMobileView('upload');
    };

    const handleReceiptProcessed = (receipt) => {
        setActiveReceipt(receipt);
        if (receipt) setMobileView('upload');
    };

    return (
        <ToastProvider>
            <PeopleProvider>
                <div className="app-layout">
                    <header className="app-header">
                        <svg className="app-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                            <rect x="9" y="3" width="6" height="4" rx="1" />
                            <path d="M9 12h6M9 16h4" />
                        </svg>
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
                                <ReceiptList activeReceipt={activeReceipt} onSelectReceipt={setActiveReceipt} />
                            ) : (
                                <PeopleManager />
                            )}
                        </aside>

                        {/* Desktop main panel */}
                        <main className="main-panel">
                            <UploadReceipt activeReceipt={activeReceipt} onReceiptProcessed={setActiveReceipt} />
                        </main>

                        {/* Mobile views */}
                        <div className="mobile-content">
                            {mobileView === 'receipts' && (
                                <ReceiptList activeReceipt={activeReceipt} onSelectReceipt={handleSelectReceipt} />
                            )}
                            {mobileView === 'upload' && (
                                <UploadReceipt activeReceipt={activeReceipt} onReceiptProcessed={handleReceiptProcessed} />
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
