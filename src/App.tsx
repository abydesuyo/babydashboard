import React, { useEffect, useState, useMemo } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { Dashboard } from './components/Dashboard';
import { fetchData, updateRowInSheet, insertRowsInSheet } from './utils/googleSheets';
import { calculateSummary, processDataForChart } from './utils/dataProcessing';
import type { UserProfile, ActivityRow } from './types';
import { activityConfig } from './config/activityConfig';
import './App.css';

// --- Helper function to get current datetime in the required format ---
const getCurrentDateTimeLocal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

// --- Icon Components ---
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;

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
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
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

    // --- Authentication ---
    const login = useGoogleLogin({
      onSuccess: async (tokenResponse) => {
        console.log("LOGIN HOOK: Success callback triggered.", tokenResponse);
        setAccessToken(tokenResponse.access_token);
        try {
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` } });
          const profile = await profileRes.json();
          setUser(profile);
          loadSheetData(tokenResponse.access_token);
        } catch (error) { console.error("LOGIN HOOK: Failed to fetch profile:", error); }
      },
      onError: (error) => console.log('LOGIN HOOK: Error callback triggered.', error),
      onNonOAuthError: (error) => console.log('LOGIN HOOK: Non-OAuth Error or popup closed.', error)
    });

    const logout = () => {
        googleLogout();
        setUser(null);
        setSheetData([]);
        setAccessToken(null);
    };

    // --- Data Handling ---
    const loadSheetData = async (token: string) => {
        setIsLoading(true);
        try {
            const { data, sheetName, sheetId } = await fetchData(token);
            setSheetData(data);
            setSheetInfo({ name: sheetName, id: sheetId });
        } catch (err) { console.error("Error in loadSheetData: ", err);
        } finally { setIsLoading(false); }
    };

    const handleSave = async (sheetRowIndex: number) => {
        if (!editRowData || !sheetInfo.name || !accessToken) return;
        setIsLoading(true);
        try {
            await updateRowInSheet(accessToken, sheetInfo.name, editRowData, sheetRowIndex);
            setEditingRowIndex(null);
            setEditRowData(null);
            await loadSheetData(accessToken);
        } catch (err) {
            console.error("Error saving data: ", err);
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newEntry.DateTime || !newEntry.Activity || !accessToken || !sheetInfo.name) {
            alert("Please fill out all required fields.");
            return;
        }
        setIsLoading(true);

        // --- NEW: Find the correct row to insert the new entry ---
        const newEntryDate = new Date(newEntry.DateTime);
        let targetRowIndex = 1; // Default to appending at the beginning
                
        // We will insert the new entry AFTER this one.
        for (let i = 1; i < sheetData.length - 1;  i++) {
            const existingDate = new Date(sheetData[i].Date.replace(' ', 'T'));
            if (newEntryDate > existingDate) {
                targetRowIndex = Number(sheetData[i].originalIndex) - 2; // Convert to 0-based index
                break;             
            }
        }
        // --- END NEW LOGIC ---

        let rowsToAdd: any[][] = [];
        const formattedStartDateTime = newEntry.DateTime.replace('T', ' ');
        const formattedEndDateTime = newEntry.EndDateTime.replace('T', ' ');

        if (newEntry.Activity === 'Sleep') {
            const startDateTime = new Date(newEntry.DateTime);
            const endDateTime = new Date(newEntry.EndDateTime);
            const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);

            if (durationMinutes < 0) {
                alert("End time must be after start time.");
                setIsLoading(false);
                return;
            }
            rowsToAdd = [
                [formattedEndDateTime, 'SleepEnded', durationMinutes.toString()],
                [formattedStartDateTime, 'SleepStarted', '1'],
            ];

        } else {
            rowsToAdd = [[
                formattedStartDateTime,
                newEntry.Activity,
                newEntry.Activity === 'Pooped' ? '1' : newEntry.Quantity,
            ]];
        }
        
        try {
            await insertRowsInSheet(accessToken, sheetInfo.name, sheetInfo.id, rowsToAdd, targetRowIndex);
            setNewEntry({ DateTime: getCurrentDateTimeLocal(), Activity: 'Formula', Quantity: '', EndDateTime: getCurrentDateTimeLocal() });
            await loadSheetData(accessToken);
        } catch (err) {
            console.error("Error adding data: ", err);
            setIsLoading(false);
        }
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
        return <div className="filter-item" style={{flexGrow: 0.5}}></div>; // Placeholder to maintain layout
    };


    return (
        <div className="App">
            <header className="App-header">
                <h1>Baby Activity Dashboard</h1>
                {user && ( <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme"> {theme === 'light' ? <MoonIcon /> : <SunIcon />} </button> )}
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
                        {isLoading && <div className="loading-container"><p>Loading...</p></div>}
                        {!isLoading && (
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
                                <Dashboard
                                    summary={summary} dateRange={dateRange} setDateRange={setDateRange}
                                    selectedActivity={selectedActivity} setSelectedActivity={setSelectedActivity}
                                    handleReset={handleReset} chartData={chartData} tooltipFormatter={tooltipFormatter}
                                    dateFilteredData={dateFilteredData} editingRowIndex={editingRowIndex} editRowData={editRowData}
                                    handleEditClick={handleEditClick} handleSaveClick={handleSave} handleCancelClick={handleCancelClick}
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