import React, { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { SheetSelector } from './components/SheetSelector';

// Lazy load heavy components to reduce initial bundle size
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
import { useGoogleSheets } from './hooks/useGoogleSheets';
import { useTokenManager } from './hooks/useTokenManager';
import { calculateSummary, processDataForChart } from './utils/dataProcessing';
import { clearUserSheetData, updateSheetAccess } from './utils/userSheetManager';
import type { UserProfile, ActivityRow, NewEntry, SavedSheet } from './types';
import './App.css';

// Helper functions
const getCurrentDateTimeLocal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const getMonthStart = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

// Icon Components
const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
);

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
);

function App() {
    // Authentication state
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    
    // Sheet selection state
    const [selectedSheet, setSelectedSheet] = useState<SavedSheet | null>(null);
    const [showSheetSelector, setShowSheetSelector] = useState(false);
    
    // Token management
    const { 
        accessToken, 
        isTokenValid, 
        getTokenStatus,
        setTokenData, 
        clearToken 
    } = useTokenManager();

    const tokenStatus = getTokenStatus();
    
    // Google Sheets operations - only initialize if we have a selected sheet
    const shouldInitializeSheets = accessToken && user?.email && selectedSheet;
    const { 
        sheetData, 
        loadData, 
        addEntry, 
        updateEntry, 
        deleteEntry,
        isOperationPending 
    } = useGoogleSheets(
        shouldInitializeSheets ? accessToken : null, 
        shouldInitializeSheets ? user.email : null,
        shouldInitializeSheets ? selectedSheet.spreadsheetId : null
    );

    // UI state
    const [dateRange, setDateRange] = useState({ start: getMonthStart(), end: '' });
    const [selectedActivity, setSelectedActivity] = useState('formula');
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editRowData, setEditRowData] = useState<ActivityRow | null>(null);
    const [showAddSuccess, setShowAddSuccess] = useState(false);
    
    // New entry state
    const [newEntry, setNewEntry] = useState<NewEntry>({
        DateTime: getCurrentDateTimeLocal(),
        Activity: 'Formula',
        Quantity: '',
        EndDateTime: getCurrentDateTimeLocal()
    });

    // Authentication
    const login = useGoogleLogin({
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        onSuccess: async (response) => {
            const { access_token, expires_in } = response;
            setTokenData(access_token, expires_in || 3600);

            try {
                const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                const userProfile = await profileResponse.json();
                setUser(userProfile);
            } catch (error) {
                console.error("Error fetching user profile:", error);
            }
        },
        onError: (error) => console.error('Login error:', error),
    });

    const logout = useCallback(async () => {
        googleLogout();
        if (user?.email) {
            await clearUserSheetData(accessToken, user.email);
        }
        setUser(null);
        setSelectedSheet(null);
        setShowSheetSelector(false);
        clearToken();
        // Clear any stored refresh tokens
        localStorage.removeItem('google_refresh_token');
    }, [clearToken, user?.email, accessToken]);

    // Protected API call wrapper
    const makeProtectedCall = useCallback(async <T,>(
        apiCall: () => Promise<T>,
        onTokenExpired?: () => void
    ): Promise<T | null> => {
        if (!isTokenValid()) {
            if (onTokenExpired) {
                onTokenExpired();
            } else {
                logout();
            }
            return null;
        }

        try {
            return await apiCall();
        } catch (error: unknown) {
            if ((error as { status?: number })?.status === 401) {
                logout();
                alert("Session expired. Please log in again.");
                return null;
            }
            throw error;
        }
    }, [isTokenValid, logout]);

    // Data operations
    const handleLoadData = useCallback(async (showLoadingSpinner = true) => {
        if (!accessToken || !selectedSheet) return;
        
        return makeProtectedCall(async () => {
            if (showLoadingSpinner) setIsLoading(true);
            try {
                await loadData();
            } finally {
                if (showLoadingSpinner) setIsLoading(false);
            }
        });
    }, [accessToken, selectedSheet, loadData, makeProtectedCall]);

    const handleAddEntry = useCallback(async () => {
        if (!newEntry.DateTime || !newEntry.Activity) {
            alert("Please fill out all required fields.");
            return;
        }

        return makeProtectedCall(async () => {
            await addEntry(newEntry);
            setShowAddSuccess(true);
            setTimeout(() => setShowAddSuccess(false), 2000);
            
            // Keep all values including times - preserve everything for continuous entries
        });
    }, [newEntry, addEntry, makeProtectedCall]);

    const handleSaveEdit = useCallback(async () => {
        if (!editRowData) return;

        return makeProtectedCall(async () => {
            await updateEntry(editRowData);
            setEditingRowIndex(null);
            setEditRowData(null);
        });
    }, [editRowData, updateEntry, makeProtectedCall]);

    const handleDeleteEntry = useCallback(async (row: ActivityRow) => {
        return makeProtectedCall(async () => {
            await deleteEntry(row);
            setEditingRowIndex(null);
            setEditRowData(null);
        });
    }, [deleteEntry, makeProtectedCall]);

    // UI handlers
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
    
    const handleReset = () => {
        setDateRange({ start: '', end: '' });
        setSelectedActivity('formula');
    };

    const handleEditClick = (row: ActivityRow, index: number) => {
        setEditingRowIndex(index);
        
        // For sleep entries, find the matching start/end time
        if (row.Activity === 'SleepStarted' || row.Activity === 'SleepEnded') {
            let endDateTime = '';
            
            if (row.Activity === 'SleepStarted') {
                // Find the corresponding SleepEnded entry
                const sleepEnded = sheetData
                    .filter(r => r.Activity === 'SleepEnded')
                    .find(r => {
                        const startTime = new Date(row.Date).getTime();
                        const endTime = new Date(r.Date).getTime();
                        return endTime >= startTime;
                    });
                
                endDateTime = sleepEnded ? sleepEnded.Date : '';
            } else {
                // For SleepEnded, the end time is the current row's date
                endDateTime = row.Date;
            }
            
            setEditRowData({ ...row, EndDateTime: endDateTime });
        } else {
            setEditRowData({ ...row });
        }
    };

    const handleCancelEdit = () => {
        setEditingRowIndex(null);
        setEditRowData(null);
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
        setEditRowData(prev => prev ? { ...prev, [key]: e.target.value } : null);
    };

    const handleNewEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setNewEntry(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    // Sheet management handlers
    const handleSheetSelected = useCallback((sheet: SavedSheet) => {
        setSelectedSheet(sheet);
        setShowSheetSelector(false);
    }, []);
    
    const handleSwitchSheet = useCallback(() => {
        setShowSheetSelector(true);
    }, []);
    
    const handleCloseSheetSelector = useCallback(() => {
        if (selectedSheet) {
            setShowSheetSelector(false);
        }
    }, [selectedSheet]);

    // Effects
    useEffect(() => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Show sheet selector when user logs in but hasn't selected a sheet
    useEffect(() => {
        if (user && accessToken && !selectedSheet) {
            setShowSheetSelector(true);
        }
    }, [user, accessToken, selectedSheet]);
    
    // Load data when sheet is selected
    useEffect(() => {
        if (selectedSheet && accessToken && user) {
            updateSheetAccess(accessToken, user.email, selectedSheet.id);
            handleLoadData();
        }
    }, [selectedSheet, accessToken, user, handleLoadData]);

    // Periodic data refresh
    useEffect(() => {
        if (!accessToken || !user || !selectedSheet) return;

        const interval = setInterval(() => {
            if (isTokenValid()) {
                handleLoadData(false);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [accessToken, user, selectedSheet, isTokenValid, handleLoadData]);

    // Memoized calculations
    const dateFilteredData = useMemo(() => 
        sheetData.filter(row => {
            const dateOnly = row.Date?.split(' ')[0];
            if (!dateOnly) return false;
            const rowDate = new Date(dateOnly);
            if (isNaN(rowDate.getTime())) return false;
            const start = dateRange.start ? new Date(dateRange.start) : null;
            const end = dateRange.end ? new Date(dateRange.end) : null;
            return !(start && rowDate < start) && !(end && rowDate > end);
        }), 
        [sheetData, dateRange]
    );

    const activityFilteredData = useMemo(() => {
        const activityMap: Record<string, string> = {
            formula: 'Formula',
            sleep: 'SleepEnded',
            pooped: 'Pooped'
        };
        const activityToFilter = activityMap[selectedActivity] || 'Formula';
        return dateFilteredData.filter(row => row.Activity === activityToFilter);
    }, [dateFilteredData, selectedActivity]);

    const summary = useMemo(() => 
        calculateSummary(dateFilteredData), 
        [dateFilteredData]
    );
    
    const chartData = useMemo(() => 
        processDataForChart(activityFilteredData), 
        [activityFilteredData]
    );

    const tooltipFormatter = (value: number, name: string) => {
        if (name === 'Sleep Duration' && value > 0) {
            const hours = Math.floor(value);
            const minutes = Math.round((value - hours) * 60);
            return [`${hours}h ${minutes}m`, name];
        }
        return [value.toFixed(0), name];
    };

    const renderNewEntryFields = () => {
        if (newEntry.Activity === 'Sleep') {
            return (
                <div className="filter-item sleep-time-inputs">
                    <div style={{flex: 1}}>
                        <label htmlFor="new-datetime">Start Time</label>
                        <input 
                            id="new-datetime" 
                            type="datetime-local" 
                            name="DateTime" 
                            value={newEntry.DateTime} 
                            onChange={handleNewEntryChange} 
                        />
                    </div>
                    <div style={{flex: 1}}>
                        <label htmlFor="new-endtime">End Time</label>
                        <input 
                            id="new-endtime" 
                            type="datetime-local" 
                            name="EndDateTime" 
                            value={newEntry.EndDateTime} 
                            onChange={handleNewEntryChange} 
                        />
                    </div>
                </div>
            );
        }
        if (newEntry.Activity === 'Formula') {
            return (
                <div className="filter-item">
                    <label htmlFor="new-quantity">Quantity (ml)</label>
                    <input 
                        id="new-quantity" 
                        type="number" 
                        min="0" 
                        name="Quantity" 
                        placeholder="e.g., 160" 
                        value={newEntry.Quantity} 
                        onChange={handleNewEntryChange} 
                    />
                </div>
            );
        }
        return <div className="filter-item" style={{flexGrow: 0.5}}></div>;
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Baby Activity Dashboard</h1>
                {user && (
                    <button 
                        className="theme-toggle" 
                        onClick={toggleTheme} 
                        aria-label="Toggle theme"
                    >
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>
                )}
            </header>

            <main>
                {!user ? (
                    <div className="login-container">
                        <h2>Please log in to continue</h2>
                        <button className='login-button' onClick={() => login()}>
                            Sign in with Google 🚀
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="user-info">
                            <div className="user-details">
                                <p>Welcome, {user.name}!</p>
                                {selectedSheet && (
                                    <p className="sheet-info">
                                        Current sheet: <strong>{selectedSheet.name}</strong>
                                        <button 
                                            onClick={handleSwitchSheet}
                                            className="switch-sheet-button"
                                            title="Switch to a different sheet"
                                        >
                                            Switch Sheet
                                        </button>
                                    </p>
                                )}
                            </div>
                            <button onClick={logout} className="logout-button">
                                Logout
                            </button>
                        </div>

                        {tokenStatus.isExpiringSoon && (
                            <div className="token-warning">
                                ⏰ Session expires in {tokenStatus.minutesUntilExpiry} minute{tokenStatus.minutesUntilExpiry !== 1 ? 's' : ''}. 
                                <button onClick={() => login()} className="refresh-button">
                                    Refresh Session
                                </button>
                            </div>
                        )}

                        {showSheetSelector && (
                            <SheetSelector
                                accessToken={accessToken!}
                                userEmail={user.email}
                                onSheetSelected={handleSheetSelected}
                                onClose={handleCloseSheetSelector}
                            />
                        )}

                        {!showSheetSelector && selectedSheet && (
                            <>
                                {isLoading && sheetData.length === 0 && (
                                    <div className="loading-container">
                                        <p>Loading...</p>
                                    </div>
                                )}

                        {(!isLoading || sheetData.length > 0) && (
                            <>
                                <div className="add-entry-container filters-container">
                                    <div className="filter-item">
                                        <label htmlFor="new-activity">Activity</label>
                                        <select 
                                            id="new-activity" 
                                            name="Activity" 
                                            value={newEntry.Activity} 
                                            onChange={handleNewEntryChange}
                                        >
                                            <option value="Formula">Formula</option>
                                            <option value="Sleep">Sleep</option>
                                            <option value="Pooped">Pooped</option>
                                        </select>
                                    </div>

                                    {newEntry.Activity !== 'Sleep' && (
                                        <div className="filter-item">
                                            <label htmlFor="new-datetime">Date & Time</label>
                                            <input 
                                                id="new-datetime" 
                                                type="datetime-local" 
                                                name="DateTime" 
                                                value={newEntry.DateTime} 
                                                onChange={handleNewEntryChange} 
                                            />
                                        </div>
                                    )}

                                    {renderNewEntryFields()}

                                    <div className="filter-item">
                                        <button 
                                            onClick={handleAddEntry} 
                                            className="add-button"
                                            disabled={isOperationPending}
                                        >
                                            {isOperationPending ? 'Adding...' : 'Add Entry'}
                                        </button>
                                    </div>
                                </div>

                                {showAddSuccess && (
                                    <div className="success-message">
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}>
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Entry added successfully!
                                    </div>
                                )}

                                <Suspense fallback={
                                    <div className="loading-container">
                                        <div className="loading-spinner">Loading dashboard...</div>
                                    </div>
                                }>
                                    <Dashboard
                                        summary={summary}
                                        dateRange={dateRange}
                                        setDateRange={setDateRange}
                                        selectedActivity={selectedActivity}
                                        setSelectedActivity={setSelectedActivity}
                                        handleReset={handleReset}
                                        chartData={chartData}
                                        tooltipFormatter={tooltipFormatter}
                                        dateFilteredData={dateFilteredData}
                                        editingRowIndex={editingRowIndex}
                                        editRowData={editRowData}
                                        handleEditClick={handleEditClick}
                                        handleSaveClick={handleSaveEdit}
                                        handleCancelClick={handleCancelEdit}
                                        handleDeleteClick={handleDeleteEntry}
                                        handleEditChange={handleEditChange}
                                        isOperationPending={isOperationPending}
                                    />
                                </Suspense>
                            </>
                        )}
                        </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;