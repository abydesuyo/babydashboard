// src/components/Dashboard.tsx
import React from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { activityConfig } from '../config/activityConfig';
import type { ActivityRow } from '../types';

// Define Props type for our component
type DashboardProps = {
  summary: { avgFormula: number; avgSleep: number; totalPooped: number; };
  dateRange: { start: string; end: string; };
  setDateRange: (range: { start: string; end: string; }) => void;
  selectedActivity: string;
  setSelectedActivity: (activity: string) => void;
  handleReset: () => void;
  chartData: any[];
  tooltipFormatter: (value: number, name: string) => string[];
  dateFilteredData: ActivityRow[];
  editingRowIndex: number | null;
  editRowData: ActivityRow | null;
  handleEditClick: (row: ActivityRow, index: number) => void;
  handleSaveClick: (rowIndex: number) => void;
  handleCancelClick: () => void;
  handleEditChange: (e: React.ChangeEvent<HTMLInputElement>, key: string) => void;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const Dashboard: React.FC<DashboardProps> = ({
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
}) => {
  const currentConfig = activityConfig[selectedActivity as keyof typeof activityConfig];

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
            <input id="start-date" type="date" name="start" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
        </div>
        <div className="filter-item">
            <label htmlFor="end-date">End Date</label>
            <input id="end-date" type="date" name="end" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
        </div>
        <div className="filter-item">
            <label htmlFor="activity-type">Activity Type</label>
            <select id="activity-type" value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)}>
                {Object.keys(activityConfig).map(key => (
                    <option key={key} value={key}>
                        {activityConfig[key as keyof typeof activityConfig].name}
                    </option>
                ))}
            </select>
        </div>
        <div className="filter-item">
            <button onClick={handleReset} className="reset-button">Reset Filters</button>
        </div>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis allowDecimals={false} label={{ value: currentConfig.unit, angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey={currentConfig.key} name={currentConfig.name} fill={currentConfig.color} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="table-container">
        <h2>Filtered Raw Data</h2>
        <table>
          <thead>
            <tr><th>Date</th><th>Activity</th><th>Quantity</th><th>Units</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {dateFilteredData.map((row, index) => {
              const isEditing = editingRowIndex === index;
              return (
                  <tr key={row.originalIndex}>
                      <td>{isEditing ? <input type="text" value={editRowData?.Date || ''} onChange={(e) => handleEditChange(e, 'Date')} /> : row.Date}</td>
                      <td>{isEditing ? <input type="text" value={editRowData?.Activity || ''} onChange={(e) => handleEditChange(e, 'Activity')} /> : row.Activity}</td>
                      <td>{isEditing ? <input type="text" value={editRowData?.Quantity || ''} onChange={(e) => handleEditChange(e, 'Quantity')} /> : row.Quantity}</td>
                      <td>{row.Activity === 'Formula' ? 'ml' : row.Activity === 'SleepEnded' ? 'minutes' : ''}</td>
                      <td>
                          {isEditing ? (
                              <>
                                  <button className="save-button" onClick={() => handleSaveClick(Number(row.originalIndex))}>Save</button>
                                  <button className="cancel-button" onClick={handleCancelClick}>Cancel</button>
                              </>
                          ) : (
                              <button className="edit-button" onClick={() => handleEditClick(row, index)}>Edit</button>
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
};
