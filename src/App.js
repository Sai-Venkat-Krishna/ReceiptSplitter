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
                    </header>
                    <div className="app-body">
                        <aside className="sidebar">
                            <div className="sidebar-tabs">
                                <button
                                    className={`sidebar-tab ${sidebarTab === 'receipts' ? 'sidebar-tab--active' : ''}`}
                                    onClick={() => setSidebarTab('receipts')}
                                >
                                    Receipts
                                </button>
                                <button
                                    className={`sidebar-tab ${sidebarTab === 'people' ? 'sidebar-tab--active' : ''}`}
                                    onClick={() => setSidebarTab('people')}
                                >
                                    People
                                </button>
                            </div>
                            {sidebarTab === 'receipts' ? (
                                <ReceiptList
                                    activeReceipt={activeReceipt}
                                    onSelectReceipt={setActiveReceipt}
                                />
                            ) : (
                                <PeopleManager />
                            )}
                        </aside>
                        <main className="main-panel">
                            <UploadReceipt
                                activeReceipt={activeReceipt}
                                onReceiptProcessed={setActiveReceipt}
                            />
                        </main>
                    </div>
                </div>
            </PeopleProvider>
        </ToastProvider>
    );
};

export default App;
