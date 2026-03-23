import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ActivityRow } from '../types';

interface SleepTimerProps {
    sheetData: ActivityRow[];
    onStartSleep: (startTime?: string) => Promise<void | null>;
    onStopSleep: (sleepStartedRow: ActivityRow) => Promise<void | null>;
    onUpdateStartTime: (sleepStartedRow: ActivityRow, newStartTime: string) => Promise<void | null>;
    isOperationPending: boolean;
}

// Format elapsed time as HH:MM:SS
const formatElapsedTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

// Convert date string to datetime-local input format
// Handles formats like "2025-12-09 08:58" or "2025/12/09 08:58" or "12/9/2025 8:58:00"
const toDateTimeLocalFormat = (dateStr: string): string => {
    if (!dateStr) return '';

    // Try to normalize the date string
    let normalizedStr = dateStr;

    // If it has a space (like "2025-12-09 08:58"), replace with T
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
        normalizedStr = dateStr.replace(' ', 'T');
    }

    const date = new Date(normalizedStr);

    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.warn('Failed to parse date:', dateStr);
        // Fallback: try to extract date and time manually
        const match = dateStr.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})[\sT](\d{1,2}):(\d{1,2})/);
        if (match) {
            const [, year, month, day, hour, minute] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
        }
        return '';
    }

    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const SleepTimer: React.FC<SleepTimerProps> = ({
    sheetData,
    onStartSleep,
    onStopSleep,
    onUpdateStartTime,
    isOperationPending
}) => {
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [showTimeAdjust, setShowTimeAdjust] = useState(false);
    const [adjustedStartTime, setAdjustedStartTime] = useState('');
    const [isSleepPending, setIsSleepPending] = useState(false);

    // Find active sleep session (SleepStarted without a subsequent SleepEnded)
    const activeSleep = useMemo(() => {
        // Sort by date descending to find the most recent SleepStarted
        const sortedData = [...sheetData].sort(
            (a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()
        );

        for (const row of sortedData) {
            if (row.Activity === 'SleepStarted') {
                // Check if there's a SleepEnded after this SleepStarted
                const startTime = new Date(row.Date).getTime();
                const hasEnded = sheetData.some(
                    r => r.Activity === 'SleepEnded' && new Date(r.Date).getTime() > startTime
                );

                if (!hasEnded) {
                    return row;
                }
            }
        }
        return null;
    }, [sheetData]);

    // Update elapsed time every second when sleep is active
    useEffect(() => {
        if (!activeSleep) {
            setElapsedTime(0);
            return;
        }

        const startTime = new Date(activeSleep.Date.replace(' ', 'T')).getTime();

        const updateElapsed = () => {
            setElapsedTime(Date.now() - startTime);
        };

        // Update immediately
        updateElapsed();

        // Then update every second
        const interval = setInterval(updateElapsed, 1000);

        return () => clearInterval(interval);
    }, [activeSleep]);

    // Initialize adjusted time when active sleep changes
    useEffect(() => {
        if (activeSleep) {
            setAdjustedStartTime(toDateTimeLocalFormat(activeSleep.Date));
        }
    }, [activeSleep]);

    const handleStartClick = useCallback(async () => {
        setIsSleepPending(true);
        try {
            await onStartSleep();
        } finally {
            setIsSleepPending(false);
        }
    }, [onStartSleep]);

    const handleStopClick = useCallback(async () => {
        if (activeSleep) {
            setIsSleepPending(true);
            try {
                await onStopSleep(activeSleep);
            } finally {
                setIsSleepPending(false);
            }
        }
    }, [activeSleep, onStopSleep]);

    const handleTimeAdjust = useCallback(async () => {
        if (activeSleep && adjustedStartTime) {
            const originalTime = toDateTimeLocalFormat(activeSleep.Date);
            if (adjustedStartTime !== originalTime) {
                setIsSleepPending(true);
                try {
                    await onUpdateStartTime(activeSleep, adjustedStartTime);
                    setShowTimeAdjust(false);
                } finally {
                    setIsSleepPending(false);
                }
            }
        }
    }, [activeSleep, adjustedStartTime, onUpdateStartTime]);

    const isSleepActive = !!activeSleep;

    return (
        <div className="sleep-timer-container">
            <div className="sleep-timer-header">
                <span className="sleep-timer-icon">😴</span>
                <span className="sleep-timer-title">Quick Sleep</span>
            </div>

            {isSleepActive ? (
                <>
                    <div className="elapsed-time-display">
                        {formatElapsedTime(elapsedTime)}
                    </div>

                    <button
                        className="sleep-timer-button stop"
                        onClick={handleStopClick}
                        disabled={isOperationPending || isSleepPending}
                    >
                        {isSleepPending ? 'Stopping...' : 'Stop Sleep'}
                    </button>

                    <div className="time-adjust-section">
                        {!showTimeAdjust ? (
                            <button
                                className="time-adjust-toggle"
                                onClick={() => setShowTimeAdjust(true)}
                            >
                                Adjust start time
                            </button>
                        ) : (
                            <div className="time-adjust-form">
                                <label htmlFor="adjust-start-time">Start Time</label>
                                <input
                                    id="adjust-start-time"
                                    type="datetime-local"
                                    value={adjustedStartTime}
                                    onChange={(e) => setAdjustedStartTime(e.target.value)}
                                />
                                <div className="time-adjust-buttons">
                                    <button
                                        className="time-adjust-save"
                                        onClick={handleTimeAdjust}
                                        disabled={isOperationPending || isSleepPending}
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="time-adjust-cancel"
                                        onClick={() => {
                                            setShowTimeAdjust(false);
                                            if (activeSleep) {
                                                setAdjustedStartTime(toDateTimeLocalFormat(activeSleep.Date));
                                            }
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className="sleep-timer-ready">
                        <p>Tap to start tracking sleep</p>
                    </div>

                    <button
                        className="sleep-timer-button start"
                        onClick={handleStartClick}
                        disabled={isOperationPending || isSleepPending}
                    >
                        {isSleepPending ? 'Starting...' : 'Start Sleep'}
                    </button>
                </>
            )}
        </div>
    );
};

export default SleepTimer;
