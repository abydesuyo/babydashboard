import React, { useEffect, useState, useMemo } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { Dashboard } from './components/Dashboard';
import { fetchData, insertRowsInSheet, deleteRowInSheet } from './utils/googleSheets';
import { calculateSummary, processDataForChart } from './utils/dataProcessing';
import type { UserProfile, ActivityRow } from './types';
import { activityConfig } from './config/activityConfig';
import './App.css';
import { debugLog } from './Debug';

// --- Helper function to get current datetime in the required format ---
const getCurrentDateTimeLocal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const getMonthStart = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

// --- Icon Components ---
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;

// --- Debug Mode ---
// Set to true to enable debug logs and additional features
// Set to false for production use


// --- Main App Component ---
function App() {
    // App State
    const [user, setUser] = useState<UserProfile | null>(null);
    const [sheetData, setSheetData] = useState<ActivityRow[]>([]);
    const [sheetInfo, setSheetInfo] = useState({ name: '', id: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [accessToken, setAccessToken] = useState<string | null>(null);

    // Dashboard State
    const [dateRange, setDateRange] = useState({ start: getMonthStart(), end: '' });
    const [selectedActivity, setSelectedActivity] = useState('formula');

    // Editing State
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editRowData, setEditRowData] = useState<ActivityRow | null>(null);

    // New Entry State
    const [newEntry, setNewEntry] = useState({
        DateTime: getCurrentDateTimeLocal(),
        Activity: 'Formula',
        Quantity: '',
        EndDateTime: getCurrentDateTimeLocal()
    });

    // Success message state
    const [showAddSuccess, setShowAddSuccess] = useState(false);

    // Enhanced token management approach

// State for token management
const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

// Modified login function
const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    onSuccess: async (response) => {
        const { access_token: accessToken, expires_in } = response;
        setAccessToken(accessToken);
        
        // Set token expiry time (expires_in is in seconds)
        const expiryTime = Date.now() + (expires_in * 1000);
        setTokenExpiry(expiryTime);

        try {
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userProfile = await profileResponse.json();
            setUser(userProfile);
            loadSheetData(accessToken);
        } catch (error) {
            console.error("LOGIN HOOK: Error fetching user profile:", error);
        }
    },
    onError: (error) => console.log('LOGIN HOOK: Error callback triggered.', error),
    onNonOAuthError: (error) => console.log('LOGIN HOOK: Non-OAuth Error or popup closed.', error)
});

// Token refresh function (if using refresh tokens)
const refreshToken = async () => {
    try {
        // This would require implementing a backend endpoint
        // that handles refresh token exchange
        console.log('Refreshing token...');
        const response = await fetch('/api/refresh-token', {
            method: 'POST',
            credentials: 'include', // If using HTTP-only cookies for refresh tokens
        });
        
        if (response.ok) {
            const { access_token, expires_in } = await response.json();
            setAccessToken(access_token);
            setTokenExpiry(Date.now() + (expires_in * 1000));
            return true;
        }
    } catch (error) {
        console.error('Token refresh failed:', error);
    }
    return false;
};

// Check token validity before API calls
const isTokenValid = () => {
    if (!tokenExpiry) return false;
    // Add 5-minute buffer before expiry
    return Date.now() < (tokenExpiry - 5 * 60 * 1000);
};

// Enhanced API call wrapper
const makeAuthenticatedRequest = async (apiCall: () => Promise<any>) => {
    if (!isTokenValid()) {
        // Try to refresh token first
        const refreshed = await refreshToken();
        if (!refreshed) {
            // If refresh fails, force re-login
            logout();
            alert("Session expired. Please log in again.");
            return null;
        }
    }
    
    try {
        return await apiCall();
    } catch (error: any) {
        // Check if error is due to invalid token
        if (error?.status === 401 || error?.message?.includes('unauthorized')) {
            const refreshed = await refreshToken();
            if (refreshed) {
                // Retry the request with new token
                return await apiCall();
            } else {
                logout();
                alert("Session expired. Please log in again.");
                return null;
            }
        }
        throw error;
    }
};

// Updated loadSheetData with token validation
const loadSheetData = async (token: string, showLoading = true) => {
    return makeAuthenticatedRequest(async () => {
        if (showLoading) setIsLoading(true);
        try {
            const { data, sheetName, sheetId } = await fetchData(token);
            const dataWithIndex = data.map((row, i) => ({
                ...row,
                sheetRowIndex: i + 2,
                originalIndex: (i + 2).toString()
            }));
            setSheetData(dataWithIndex);
            setSheetInfo({ name: sheetName, id: sheetId });
        } catch (err) {
            console.error("Error in loadSheetData: ", err);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    });
};

// Remove the old token expiry useEffect and replace with:
useEffect(() => {
    if (!tokenExpiry) return;
    
    // Check token validity every minute
    const interval = setInterval(() => {
        if (!isTokenValid()) {
            // Try to refresh token proactively
            refreshToken().then(success => {
                if (!success) {
                    logout();
                    alert("Session expired. Please log in again.");
                }
            });
        }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
}, [tokenExpiry]);

// Updated periodic data refresh with token validation
useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
        if (isTokenValid()) {
            loadSheetData(accessToken, false);
        }
    }, 60000);
    return () => clearInterval(interval);
}, [accessToken, tokenExpiry]);

    // Restore accessToken from localStorage on mount (with expiry check)
    useEffect(() => {
        const storedToken = localStorage.getItem('accessToken');
        const storedExpiry = localStorage.getItem('accessTokenExpiry');
        if (storedToken && storedExpiry) {
            const now = Date.now();
            if (now < Number(storedExpiry)) {
                setAccessToken(storedToken);
                (async () => {
                    try {
                        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { 'Authorization': `Bearer ${storedToken}` }
                        });
                        const userProfile = await profileResponse.json();
                        setUser(userProfile);
                        loadSheetData(storedToken);
                    } catch (error) {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('accessTokenExpiry');
                        setAccessToken(null);
                    }
                })();
            } else {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('accessTokenExpiry');
            }
        }
    }, []);

    // // --- Authentication ---
    // const login = useGoogleLogin({
    //     scope: 'https://www.googleapis.com/auth/spreadsheets',
    //     onSuccess: async (response) => {
    //         const { access_token: accessToken } = response;
    //         setAccessToken(accessToken);

    //         // Set expiry to 1 week from now
    //         const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    //         localStorage.setItem('accessToken', accessToken);
    //         localStorage.setItem('accessTokenExpiry', (Date.now() + oneWeekMs).toString());

    //         try {
    //             const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    //                 headers: { 'Authorization': `Bearer ${accessToken}` }
    //             });
    //             const userProfile = await profileResponse.json();
    //             setUser(userProfile);
    //             loadSheetData(accessToken);
    //         } catch (error) {
    //             console.error("LOGIN HOOK: Error fetching user profile:", error);
    //         }
    //     },
    //     onError: (error) => console.log('LOGIN HOOK: Error callback triggered.', error),
    //     onNonOAuthError: (error) => console.log('LOGIN HOOK: Non-OAuth Error or popup closed.', error)
    // });

    const logout = () => {
        googleLogout();
        setUser(null);
        setSheetData([]);
        setAccessToken(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('accessTokenExpiry');
    };

    // // --- Data Handling ---
    // const loadSheetData = async (token: string, showLoading = true) => {
    //     if (showLoading) setIsLoading(true);
    //     try {
    //         const { data, sheetName, sheetId } = await fetchData(token);
    //         // Add sheetRowIndex (row 2 for first data row, etc.)
    //         const dataWithIndex = data.map((row, i) => ({
    //             ...row,
    //             sheetRowIndex: i + 2,
    //             originalIndex: (i + 2).toString()
    //         }));
    //         setSheetData(dataWithIndex);
    //         setSheetInfo({ name: sheetName, id: sheetId });
    //     } catch (err) {
    //         console.error("Error in loadSheetData: ", err);
    //     } finally {
    //         if (showLoading) setIsLoading(false);
    //     }
    // };

    // --- Add/Edit/Delete Logic ---
    const findInsertIndex = (dateStr: string): number => {
        const newDate = new Date(dateStr.replace('T', ' '));
        for (let i = 0; i < sheetData.length; i++) {
            const rowDate = new Date(sheetData[i].Date.replace('T', ' '));
            // For descending order: find the first row where rowDate < newDate
            if (rowDate < newDate) {
                // Insert above this row (i.e., at its index)
                return sheetData[i].sheetRowIndex;
            }
        }
        // If not found, insert at the end (after the last row)
        return sheetData.length > 0 ? sheetData[sheetData.length - 1].sheetRowIndex + 1 : 2;
    };

    const handleAdd = async () => {
        debugLog('[ADD] newEntry:', newEntry);
        debugLog('[ADD] sheetInfo:', sheetInfo);
        debugLog('[ADD] accessToken:', accessToken);
        if (!newEntry.DateTime || !newEntry.Activity || !accessToken || !sheetInfo.name) {
            alert("Please fill out all required fields.");
            return;
        }
        let rowsToAdd: any[][] = [];
        let insertIndex = findInsertIndex(newEntry.DateTime);

        debugLog('[ADD] rowsToAdd:', rowsToAdd, 'insertIndex:', insertIndex);

        if (newEntry.Activity === 'Sleep') {
            const endDateTime = new Date(newEntry.EndDateTime);
            const startDateTime = new Date(newEntry.DateTime);
            const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
            if (durationMinutes < 0) {
                alert("End time must be after start time.");
                return;
            }
            rowsToAdd = [
                [newEntry.EndDateTime.replace('T', ' '), 'SleepEnded', durationMinutes.toString()],
                [newEntry.DateTime.replace('T', ' '), 'SleepStarted', '1'],
            ].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
        } else {
            rowsToAdd = [[
                newEntry.DateTime.replace('T', ' '),
                newEntry.Activity,
                newEntry.Activity === 'Pooped' ? '1' : newEntry.Quantity,
            ]];
        }

        await insertRowsInSheet(accessToken, sheetInfo.name, sheetInfo.id, rowsToAdd, insertIndex);
        
        // Instead of optimistic update, reload the data to maintain proper order and indices
        await loadSheetData(accessToken, false);
        
        setShowAddSuccess(true);
        setTimeout(() => setShowAddSuccess(false), 2000);
    };


    const handleSave = async (sheetRowIndex: number) => {
        debugLog('[EDIT] editRowData:', editRowData);
        debugLog('[EDIT] sheetRowIndex:', sheetRowIndex);
        debugLog('[EDIT] sheetInfo:', sheetInfo);
        debugLog('[EDIT] accessToken:', accessToken);
        if (!editRowData || !sheetInfo.name || !accessToken) return;

        if (editRowData.Activity === 'SleepStarted' || editRowData.Activity === 'SleepEnded') {
            const relatedRows = sheetData.filter(row =>
                (row.Activity === 'SleepStarted' || row.Activity === 'SleepEnded') &&
                new Date(row.Date).toDateString() === new Date(editRowData.Date).toDateString()
            );
            for (const row of relatedRows) {
                await deleteRowInSheet(accessToken, sheetInfo.id, row.sheetRowIndex);
            }
            const endDateTime = new Date(editRowData.EndDateTime!);
            const startDateTime = new Date(editRowData.Date);
            const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
            const sleepRows = [
                [editRowData.EndDateTime!.replace('T', ' '), 'SleepEnded', durationMinutes.toString()],
                [editRowData.Date.replace('T', ' '), 'SleepStarted', '1'],
            ].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
            const insertIndex = findInsertIndex(editRowData.Date);
            await insertRowsInSheet(accessToken, sheetInfo.name, sheetInfo.id, sleepRows, insertIndex);
        } else {
            await deleteRowInSheet(accessToken, sheetInfo.id, sheetRowIndex);
            const newInsertIndex = findInsertIndex(editRowData.Date);
            await insertRowsInSheet(
                accessToken,
                sheetInfo.name,
                sheetInfo.id,
                [[editRowData.Date, editRowData.Activity, editRowData.Quantity]],
                newInsertIndex
            );
        }
        debugLog('[EDIT] Save complete, reloading data...');
        setEditingRowIndex(null);
        setEditRowData(null);
        await loadSheetData(accessToken);
    };

    const handleDelete = async (sheetRowIndex: number, row?: ActivityRow) => {
        debugLog('[DELETE] sheetRowIndex:', sheetRowIndex);
        debugLog('[DELETE] row:', row);
        debugLog('[DELETE] sheetInfo:', sheetInfo);
        debugLog('[DELETE] accessToken:', accessToken);
        if (!row || !sheetInfo || !accessToken) { 
            debugLog('[DELETE] : row is undefined, cannot proceed with deletion.');
            return;
        }
        else {
            debugLog('[DELETE] : row is defined, proceeding with deletion...');
        }

        if (row.Activity === 'SleepStarted' || row.Activity === 'SleepEnded') {
            const relatedRows = sheetData.filter(r =>
                (r.Activity === 'SleepStarted' || r.Activity === 'SleepEnded') &&
                new Date(r.Date).toDateString() === new Date(row.Date).toDateString()
            );
            for (const r of relatedRows) {
                await deleteRowInSheet(accessToken, sheetInfo.id, r.sheetRowIndex);
            }
        } else {
            await deleteRowInSheet(accessToken, sheetInfo.id, sheetRowIndex);
        }
        debugLog('[DELETE] Delete complete, reloading data...');
        setEditingRowIndex(null);
        setEditRowData(null);
        await loadSheetData(accessToken);
    };

    // --- UI Handlers & Effects ---
    useEffect(() => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }, []);

    useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const handleReset = () => { setDateRange({ start: '', end: '' }); setSelectedActivity('formula'); };
    const handleEditClick = (row: ActivityRow, index: number) => { setEditingRowIndex(index); setEditRowData({ ...row }); };
    const handleCancelClick = () => { setEditingRowIndex(null); setEditRowData(null); };
    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => setEditRowData(prev => prev ? { ...prev, [key]: e.target.value } : null);
    const handleNewEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNewEntry(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // --- Memoized Calculations ---
    const dateFilteredData = useMemo(() => sheetData.filter(row => {
        const dateOnly = row.Date?.split(' ')[0];
        if (!dateOnly) return false;
        const rowDate = new Date(dateOnly);
        if (isNaN(rowDate.getTime())) return false;
        const start = dateRange.start ? new Date(dateRange.start) : null;
        const end = dateRange.end ? new Date(dateRange.end) : null;
        return !(start && rowDate < start) && !(end && rowDate > end);
    }), [sheetData, dateRange]);

    const activityFilteredData = useMemo(() => {
        const activityToFilter = activityConfig[selectedActivity as keyof typeof activityConfig].dataLabel;
        return dateFilteredData.filter(row => row.Activity === activityToFilter);
    }, [dateFilteredData, selectedActivity]);

    const summary = useMemo(() => calculateSummary(dateFilteredData), [dateFilteredData]);
    const chartData = useMemo(() => processDataForChart(activityFilteredData), [activityFilteredData]);
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
                        <input id="new-datetime" type="datetime-local" name="DateTime" value={newEntry.DateTime} onChange={handleNewEntryChange} />
                    </div>
                    <div style={{flex: 1}}>
                        <label htmlFor="new-endtime">End Time</label>
                        <input id="new-endtime" type="datetime-local" name="EndDateTime" value={newEntry.EndDateTime} onChange={handleNewEntryChange} />
                    </div>
                </div>
            );
        }
        if (newEntry.Activity === 'Formula') {
            return (
                <div className="filter-item">
                    <label htmlFor="new-quantity">Quantity (ml)</label>
                    <input id="new-quantity" type="number" min="0" name="Quantity" placeholder="e.g., 160" value={newEntry.Quantity} onChange={handleNewEntryChange} />
                </div>
            );
        }
        return <div className="filter-item" style={{flexGrow: 0.5}}></div>;
    };

    useEffect(() => {
        if (!accessToken) return;
        const interval = setInterval(() => {
            loadSheetData(accessToken, false);
        }, 60000);
        return () => clearInterval(interval);
    }, [accessToken]);

    useEffect(() => {
        if (!accessToken) return;
        const storedExpiry = localStorage.getItem('accessTokenExpiry');
        if (!storedExpiry) return;
        const msUntilExpiry = Number(storedExpiry) - Date.now();
        if (msUntilExpiry <= 0) {
            logout();
            alert("Session expired. Please log in again.");
            return;
        }
        const timeout = setTimeout(() => {
            logout();
            alert("Session expired. Please log in again.");
        }, msUntilExpiry);
        return () => clearTimeout(timeout);
    }, [accessToken]);

    return (
        <div className="App">
            <header className="App-header">
                <h1>Baby Activity Dashboard</h1>
                {user && (
                    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>
                )}
            </header>
            <main>
                {!user ? (
                    <div className="login-container">
                        <h2>Please log in to continue</h2>
                        <button className='login-button' onClick={() => login()}> Sign in with Google 🚀 </button>
                    </div>
                ) : (
                    <>
                        <div className="user-info">
                            <p>Welcome, {user.name}!</p>
                            <button onClick={logout} className="logout-button">Logout</button>
                        </div>
                        {isLoading && sheetData.length === 0 && (
                            <div className="loading-container"><p>Loading...</p></div>
                        )}
                        {(!isLoading || sheetData.length > 0) && (
                            <>
                                <div className="add-entry-container filters-container">
                                    <div className="filter-item">
                                        <label htmlFor="new-activity">Activity</label>
                                        <select id="new-activity" name="Activity" value={newEntry.Activity} onChange={handleNewEntryChange}>
                                            <option value="Formula">Formula</option>
                                            <option value="Sleep">Sleep</option>
                                            <option value="Pooped">Pooped</option>
                                        </select>
                                    </div>
                                    {newEntry.Activity !== 'Sleep' && (
                                        <div className="filter-item">
                                            <label htmlFor="new-datetime">Date & Time</label>
                                            <input id="new-datetime" type="datetime-local" name="DateTime" value={newEntry.DateTime} onChange={handleNewEntryChange} />
                                        </div>
                                    )}
                                    {renderNewEntryFields()}
                                    <div className="filter-item">
                                        <button onClick={handleAdd} className="add-button">Add Entry</button>
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
                                    handleSaveClick={handleSave}
                                    handleCancelClick={handleCancelClick}
                                    handleDeleteClick={handleDelete}
                                    handleEditChange={handleEditChange}
                                />
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default App;