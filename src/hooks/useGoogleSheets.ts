// src/hooks/useGoogleSheets.ts
import { useState, useCallback } from 'react';
// Lazy load gapi-script to reduce initial bundle size
const loadGapi = () => import('gapi-script').then(module => module.gapi);
import { parseSheetData } from '../utils/dataProcessing';
import type { ActivityRow, NewEntry, SheetInfo } from '../types';

// Initialize GAPI client with lazy loading
const initGapiClient = async (accessToken: string) => {
  const gapi = await loadGapi();
  await new Promise<void>((resolve) => gapi.load('client', resolve));
  await gapi.client.init({});
  await gapi.client.load('sheets', 'v4');
  gapi.client.setToken({ access_token: accessToken });
  return gapi;
};

export const useGoogleSheets = (accessToken: string | null, userEmail: string | null, spreadsheetId: string | null) => {
  const [sheetData, setSheetData] = useState<ActivityRow[]>([]);
  const [sheetInfo, setSheetInfo] = useState<SheetInfo>({ name: '', id: 0 });
  const [isOperationPending, setIsOperationPending] = useState(false);
  // Load data from sheet
  const loadData = useCallback(async () => {
    if (!accessToken || !userEmail || !spreadsheetId) return;

    const gapi = await initGapiClient(accessToken);
    
    const metadataResponse = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
    });

    const firstSheet = metadataResponse.result.sheets?.[0];
    const firstSheetName = firstSheet?.properties?.title;
    
    if (!firstSheetName || firstSheet.properties?.sheetId === undefined) {
      throw new Error("No sheets with a valid name and ID found.");
    }

    const dataResponse = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: firstSheetName,
    });
    
    const parsedData = parseSheetData(dataResponse.result.values || []);
    setSheetData(parsedData);
    setSheetInfo({ name: firstSheetName, id: firstSheet.properties.sheetId, spreadsheetId });
  }, [accessToken, userEmail, spreadsheetId]);

  // Find insertion point for chronological order (descending)
  const findInsertIndex = useCallback((dateStr: string): number => {
    const newDate = new Date(dateStr.replace('T', ' '));
    for (let i = 0; i < sheetData.length; i++) {
      const rowDate = new Date(sheetData[i].Date.replace('T', ' '));
      if (rowDate < newDate) {
        return sheetData[i].sheetRowIndex;
      }
    }
    return sheetData.length > 0 ? sheetData[sheetData.length - 1].sheetRowIndex + 1 : 2;
  }, [sheetData]);

  // Insert rows into sheet
  const insertRowsInSheet = useCallback(async (rows: unknown[][], insertIndex: number) => {
    if (!accessToken || !userEmail || !spreadsheetId) return;

    const gapi = await initGapiClient(accessToken);

    // Insert empty rows
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          insertDimension: {
            range: {
              sheetId: sheetInfo.id,
              dimension: 'ROWS',
              startIndex: insertIndex - 1,
              endIndex: (insertIndex - 1) + rows.length,
            },
            inheritFromBefore: false,
          },
        }],
      },
    });

    // Update with data
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetInfo.name}!A${insertIndex}:C${insertIndex + rows.length - 1}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows },
    });
  }, [accessToken, userEmail, spreadsheetId, sheetInfo]);

  // Delete row from sheet
  const deleteRowFromSheet = useCallback(async (rowIndex: number) => {
    if (!accessToken || !spreadsheetId) return;

    const gapi = await initGapiClient(accessToken);
    
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetInfo.id,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        }],
      },
    });
  }, [accessToken, spreadsheetId, sheetInfo]);

  // Add new entry
  const addEntry = useCallback(async (newEntry: NewEntry) => {
    if (!accessToken || !userEmail || !sheetInfo.name) return;

    setIsOperationPending(true);
    try {
      let rowsToAdd: unknown[][] = [];

      if (newEntry.Activity === 'Sleep') {
        const endDateTime = new Date(newEntry.EndDateTime);
        const startDateTime = new Date(newEntry.DateTime);
        const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
        
        if (durationMinutes < 0) {
          throw new Error("End time must be after start time.");
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

      const insertIndex = findInsertIndex(newEntry.DateTime);
      await insertRowsInSheet(rowsToAdd, insertIndex);
      
      // Reload data to ensure consistency
      await loadData();
    } finally {
      setIsOperationPending(false);
    }
  }, [accessToken, userEmail, sheetInfo, findInsertIndex, insertRowsInSheet, loadData]);

  // Update existing entry
  const updateEntry = useCallback(async (editRowData: ActivityRow) => {
    if (!accessToken || !userEmail || !sheetInfo.name) return;

    setIsOperationPending(true);
    try {
      // Handle sleep entries specially
      if (editRowData.Activity === 'SleepStarted' || editRowData.Activity === 'SleepEnded') {
        // Delete related sleep rows
        const relatedRows = sheetData.filter(row =>
          (row.Activity === 'SleepStarted' || row.Activity === 'SleepEnded') &&
          new Date(row.Date).toDateString() === new Date(editRowData.Date).toDateString()
        );

        for (const row of relatedRows.sort((a, b) => b.sheetRowIndex - a.sheetRowIndex)) {
          await deleteRowFromSheet(row.sheetRowIndex);
        }

        // Insert new sleep entries
        if (editRowData.EndDateTime) {
          const endDateTime = new Date(editRowData.EndDateTime);
          const startDateTime = new Date(editRowData.Date);
          const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
          
          const sleepRows = [
            [editRowData.EndDateTime.replace('T', ' '), 'SleepEnded', durationMinutes.toString()],
            [editRowData.Date.replace('T', ' '), 'SleepStarted', '1'],
          ].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

          const insertIndex = findInsertIndex(editRowData.Date);
          await insertRowsInSheet(sleepRows, insertIndex);
        }
      } else {
        // Calculate new insertion point BEFORE deleting
        const newInsertIndex = findInsertIndex(editRowData.Date);
        
        // Adjust insertion index if it's after the row we're about to delete
        // This accounts for the shift that happens when we delete the original row
        const adjustedInsertIndex = newInsertIndex > editRowData.sheetRowIndex 
          ? newInsertIndex - 1 
          : newInsertIndex;
        
        // Delete original row
        await deleteRowFromSheet(editRowData.sheetRowIndex);
        
        // Insert updated row at adjusted position
        await insertRowsInSheet([[
          editRowData.Date,
          editRowData.Activity,
          editRowData.Quantity
        ]], adjustedInsertIndex);
      }

      // Reload data to ensure consistency
      await loadData();
    } finally {
      setIsOperationPending(false);
    }
  }, [accessToken, userEmail, sheetInfo, sheetData, deleteRowFromSheet, findInsertIndex, insertRowsInSheet, loadData]);

  // Delete entry
  const deleteEntry = useCallback(async (row: ActivityRow) => {
    if (!accessToken || !userEmail || !sheetInfo.name) return;

    setIsOperationPending(true);
    try {
      if (row.Activity === 'SleepStarted' || row.Activity === 'SleepEnded') {
        // Delete all related sleep rows for the same date
        const relatedRows = sheetData.filter(r =>
          (r.Activity === 'SleepStarted' || r.Activity === 'SleepEnded') &&
          new Date(r.Date).toDateString() === new Date(row.Date).toDateString()
        );

        // Delete in reverse order to maintain row indices
        for (const r of relatedRows.sort((a, b) => b.sheetRowIndex - a.sheetRowIndex)) {
          await deleteRowFromSheet(r.sheetRowIndex);
        }
      } else {
        await deleteRowFromSheet(row.sheetRowIndex);
      }

      // Reload data to ensure consistency
      await loadData();
    } finally {
      setIsOperationPending(false);
    }
  }, [accessToken, userEmail, sheetInfo, sheetData, deleteRowFromSheet, loadData]);

  return {
    sheetData,
    sheetInfo,
    loadData,
    addEntry,
    updateEntry,
    deleteEntry,
    isOperationPending
  };
};

export default useGoogleSheets;