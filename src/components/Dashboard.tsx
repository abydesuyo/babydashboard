// src/components/Dashboard.tsx
import React, { memo, useMemo, useState } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { activityConfig } from '../config/activityConfig';
import type { ActivityRow } from '../types';

type DashboardProps = {
  summary: { avgFormula: number; avgSleep: number; totalPooped: number; };
  dateRange: { start: string; end: string; };
  setDateRange: (range: { start: string; end: string; }) => void;
  selectedActivity: string;
  setSelectedActivity: (activity: string) => void;
  handleReset: () => void;
  chartData: Record<string, unknown>[];
  tooltipFormatter: (value: number, name: string) => string[];
  dateFilteredData: ActivityRow[];
  editingRowIndex: number | null;
  editRowData: ActivityRow | null;
  handleEditClick: (row: ActivityRow, index: number) => void;
  handleSaveClick: () => void;
  handleCancelClick: () => void;
  handleEditChange: (e: React.ChangeEvent<HTMLInputElement>, key: string) => void;
  handleDeleteClick: (row: ActivityRow) => void;
  isOperationPending: boolean;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

// Helper to format datetime string for datetime-local input (requires YYYY-MM-DDTHH:mm format)
const formatToDateTimeLocal = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';

  // If already in ISO format, just slice to required length
  if (dateStr.includes('T')) {
    return dateStr.slice(0, 16);
  }

  // Handle format like "2025-11-25 7:48" or "2025-11-25 7:48:00"
  if (dateStr.includes(' ')) {
    const [datePart, timePart] = dateStr.split(' ');
    if (timePart) {
      // Split time into components and pad with zeros
      const timeComponents = timePart.split(':');
      const hour = timeComponents[0]?.padStart(2, '0') || '00';
      const minute = timeComponents[1]?.padStart(2, '0') || '00';
      return `${datePart}T${hour}:${minute}`;
    }
  }

  // Fallback: return as-is
  return dateStr;
};

const renderEditableCell = (
  value: string,
  key: string,
  isEditing: boolean,
  editRowData: ActivityRow | null,
  handleEditChange: (e: React.ChangeEvent<HTMLInputElement>, key: string) => void
) => {
  if (!isEditing) return value;

  // Use editRowData value if available, otherwise fall back to the original value
  const inputValue = editRowData?.[key as keyof ActivityRow]?.toString() || value || '';

  return (
    <input
      type={key === 'Date' ? 'datetime-local' : 'text'}
      value={inputValue}
      onChange={(e) => handleEditChange(e, key)}
      style={{ width: '100%' }}
    />
  );
};

export const Dashboard: React.FC<DashboardProps> = memo(({
  summary,
  dateRange,
  setDateRange,
  selectedActivity,
  setSelectedActivity,
  handleReset,
  chartData,
  tooltipFormatter,
  dateFilteredData,
  editingRowIndex,
  editRowData,
  handleEditClick,
  handleSaveClick,
  handleCancelClick,
  handleEditChange,
  handleDeleteClick,
  isOperationPending,
}) => {
  const currentConfig = activityConfig[selectedActivity as keyof typeof activityConfig];

  // Column-level table filters: keep Activity independent; use parent dateRange for dates
  const [colFilters, setColFilters] = useState<{ activity: string }>({
    activity: 'All',
  });

  const activityOptions = useMemo(() => {
    const s = new Set<string>();
    dateFilteredData.forEach(r => { if (r.Activity) s.add(r.Activity); });
    return ['All', ...Array.from(s)];
  }, [dateFilteredData]);

  // Table rows use the parent-provided dateFilteredData + Activity column filter only
  const tableRows = useMemo(() => {
    return dateFilteredData
      .map((row, idx) => ({ row, originalIndex: idx }))
      .filter(({ row }) => {
        if (colFilters.activity !== 'All' && row.Activity !== colFilters.activity) return false;
        return true;
      });
  }, [dateFilteredData, colFilters]);

  const clearColumnFilters = () => {
    // Clear only the table Activity and the shared date range
    setColFilters({ activity: 'All' });
    setDateRange({ start: '', end: '' });
  };

  return (
    <>
      <div className="summary-container">
        <div className="summary-card">
          <h2>{summary.avgFormula.toFixed(0)} ml</h2>
          <p>Avg. Daily Formula</p>
        </div>
        <div className="summary-card">
          <h2>{summary.avgSleep.toFixed(1)} hrs</h2>
          <p>Avg. Daily Sleep</p>
        </div>
        <div className="summary-card">
          <h2>{summary.totalPooped}</h2>
          <p>Total Diapers</p>
        </div>
      </div>

      <div className="filters-container">
        <div className="filter-item">
          <label htmlFor="start-date">Start Date</label>
          <input
            id="start-date"
            type="date"
            name="start"
            value={dateRange.start}
            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="filter-item">
          <label htmlFor="end-date">End Date</label>
          <input
            id="end-date"
            type="date"
            name="end"
            value={dateRange.end}
            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
        <div className="filter-item">
          <label htmlFor="activity-type">Activity Type</label>
          <select
            id="activity-type"
            value={selectedActivity}
            onChange={e => setSelectedActivity(e.target.value)}
          >
            {Object.keys(activityConfig).map(key => (
              <option key={key} value={key}>
                {activityConfig[key as keyof typeof activityConfig].name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <button onClick={handleReset} className="reset-button">
            Reset Filters
          </button>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis
              allowDecimals={false}
              label={{
                value: currentConfig.unit,
                angle: -90,
                position: 'insideLeft'
              }}
            />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar
              dataKey={currentConfig.key}
              name={currentConfig.name}
              fill={currentConfig.color}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="table-container">
        <h2>Raw Data</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Activity</th>
              <th>Quantity</th>
              <th>Units</th>
              <th>Actions</th>
            </tr>
            <tr className="column-filters">
              <th>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    aria-label="Filter start date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    style={{ width: '100%' }}
                  />
                  <input
                    type="date"
                    aria-label="Filter end date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </th>
              <th>
                <select
                  aria-label="Filter activity"
                  value={colFilters.activity}
                  onChange={(e) => setColFilters(f => ({ ...f, activity: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  {activityOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </th>
              <th />
              <th />
              <th>
                <button className="reset-button" onClick={clearColumnFilters}>
                  Clear
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ row, originalIndex }) => {
              const isEditing = editingRowIndex === originalIndex;

              // Get the date value to display (prefer editRowData when editing)
              const dateValue = (isEditing && editRowData?.Date) ? editRowData.Date : row.Date;
              // Format for datetime-local input (with proper zero-padding)
              const displayDate = formatToDateTimeLocal(dateValue);

              return (
                <tr key={`${originalIndex}-${row.Date}`}>
                  <td>
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={displayDate}
                        onChange={(e) => handleEditChange(e, 'Date')}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      row.Date
                    )}
                  </td>
                  <td>
                    {renderEditableCell(row.Activity, 'Activity', isEditing, editRowData, handleEditChange)}
                  </td>
                  <td>
                    {isEditing && row.Activity === 'SleepEnded' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', marginBottom: '4px', color: '#4CAF50' }}>
                            Sleep Start Time:
                          </label>
                          <input
                            type="datetime-local"
                            value={formatToDateTimeLocal(editRowData?.StartDateTime || '')}
                            onChange={(e) => {
                              // Update the start time
                              handleEditChange(e, 'StartDateTime');
                              // When start time changes, recalculate duration
                              if (editRowData?.EndDateTime && e.target.value) {
                                const startTime = new Date(e.target.value).getTime();
                                const endTime = new Date(editRowData.EndDateTime).getTime();
                                const durationMinutes = Math.round((endTime - startTime) / 60000);
                                handleEditChange({ target: { value: durationMinutes.toString() } } as any, 'Quantity');
                              }
                            }}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', marginBottom: '4px', color: '#2196F3' }}>
                            Sleep End Time:
                          </label>
                          <input
                            type="datetime-local"
                            value={formatToDateTimeLocal(editRowData?.EndDateTime || '')}
                            onChange={(e) => {
                              handleEditChange(e, 'EndDateTime');
                              // When end time changes, recalculate duration
                              if (editRowData?.Quantity && e.target.value) {
                                const startTime = new Date(new Date(e.target.value).getTime() - (parseInt(editRowData.Quantity) * 60000)).getTime();
                                const endTime = new Date(e.target.value).getTime();
                                const durationMinutes = Math.round((endTime - startTime) / 60000);
                                handleEditChange({ target: { value: durationMinutes.toString() } } as any, 'Quantity');
                              }
                            }}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', marginBottom: '4px' }}>
                            Duration (minutes):
                          </label>
                          <input
                            type="text"
                            value={editRowData?.Quantity || ''}
                            onChange={(e) => handleEditChange(e, 'Quantity')}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                    ) : (
                      renderEditableCell(row.Quantity, 'Quantity', isEditing, editRowData, handleEditChange)
                    )}
                  </td>
                  <td>
                    {row.Activity === 'Formula' ? 'ml' :
                      row.Activity === 'SleepEnded' ? 'minutes' : ''}
                  </td>
                  <td>
                    {isEditing ? (
                      <>
                        <button
                          className="save-button"
                          onClick={handleSaveClick}
                          disabled={isOperationPending}
                        >
                          {isOperationPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="cancel-button"
                          onClick={handleCancelClick}
                          disabled={isOperationPending}
                        >
                          Cancel
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteClick(row)}
                          disabled={isOperationPending}
                        >
                          {isOperationPending ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    ) : (
                      <button
                        className="edit-button"
                        onClick={() => handleEditClick(row, originalIndex)}
                        disabled={isOperationPending || row.Activity === 'SleepStarted'}
                        title={row.Activity === 'SleepStarted' ? 'Please edit the corresponding SleepEnded row instead' : ''}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
});

Dashboard.displayName = 'Dashboard';