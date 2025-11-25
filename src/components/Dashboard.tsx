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

const renderEditableCell = (
  value: string, 
  key: string, 
  isEditing: boolean, 
  editRowData: ActivityRow | null,
  handleEditChange: (e: React.ChangeEvent<HTMLInputElement>, key: string) => void
) => {
  if (!isEditing) return value;
  
  return (
    <input 
      type={key === 'Date' ? 'datetime-local' : 'text'}
      value={editRowData?.[key as keyof ActivityRow]?.toString() || ''} 
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
            onChange={e => setDateRange({...dateRange, start: e.target.value})} 
          />
        </div>
        <div className="filter-item">
          <label htmlFor="end-date">End Date</label>
          <input 
            id="end-date" 
            type="date" 
            name="end" 
            value={dateRange.end} 
            onChange={e => setDateRange({...dateRange, end: e.target.value})} 
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
              const displayDate = isEditing && editRowData?.Date
                ? editRowData.Date.replace(' ', 'T').slice(0, 16)
                : row.Date;

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
                    {isEditing && (row.Activity === 'SleepStarted' || row.Activity === 'SleepEnded') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input 
                          type="text"
                          placeholder="Duration (minutes)"
                          value={editRowData?.Quantity || ''}
                          onChange={(e) => handleEditChange(e, 'Quantity')}
                          style={{ width: '100%' }}
                        />
                        <input
                          type="datetime-local"
                          placeholder="End time"
                          value={editRowData?.EndDateTime?.replace(' ', 'T').slice(0, 16) || ''}
                          onChange={(e) => handleEditChange(e, 'EndDateTime')}
                          style={{ width: '100%' }}
                        />
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
                        disabled={isOperationPending}
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