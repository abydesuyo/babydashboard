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

    try {
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
    } catch (error: any) {
      // Provide user-friendly error messages
      const status = error?.status || error?.result?.error?.code;
      const message = error?.result?.error?.message || error?.message || 'Unknown error';

      if (status === 403) {
        throw new Error(`Access denied: You don't have permission to access this spreadsheet. Please check sharing settings.`);
      } else if (status === 404) {
        throw new Error(`Spreadsheet not found: The spreadsheet may have been deleted or the link is incorrect.`);
      } else if (status === 500) {
        throw new Error(`Google Sheets error: The spreadsheet might be corrupted or temporarily unavailable. Please try again or use a different spreadsheet.`);
      } else {
        throw new Error(`Failed to load spreadsheet: ${message}`);
      }
    }
  }, [accessToken, userEmail, spreadsheetId]);

  // Find insertion point for chronological order (descending)
  const findInsertIndex = useCallback((dateStr: string, deletedRowIndices?: number[]): number => {
    const newDate = new Date(dateStr.replace('T', ' '));
    for (let i = 0; i < sheetData.length; i++) {
      const rowDate = new Date(sheetData[i].Date.replace('T', ' '));
      if (rowDate < newDate) {
        let insertIndex = sheetData[i].sheetRowIndex;

        // Adjust for deleted rows that come before the insertion point
        if (deletedRowIndices && deletedRowIndices.length > 0) {
          const deletedBeforeInsert = deletedRowIndices.filter(idx => idx < insertIndex).length;
          insertIndex -= deletedBeforeInsert;
        }

        return insertIndex;
      }
    }
    // If no row is older, insert at the end
    let insertIndex = sheetData.length > 0 ? sheetData[sheetData.length - 1].sheetRowIndex + 1 : 2;

    // Adjust for deleted rows
    if (deletedRowIndices && deletedRowIndices.length > 0) {
      const deletedBeforeInsert = deletedRowIndices.filter(idx => idx < insertIndex).length;
      insertIndex -= deletedBeforeInsert;
    }

    return insertIndex;
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
        // Check if this is an ongoing sleep session (has StartDateTime but no EndDateTime)
        const isOngoingSleep = editRowData.Activity === 'SleepStarted' &&
          editRowData.StartDateTime &&
          !editRowData.EndDateTime;

        let relatedRows: ActivityRow[] = [];

        if (isOngoingSleep) {
          // For ongoing sleep, only update the SleepStarted row
          relatedRows = [editRowData];
        } else if (editRowData.Activity === 'SleepEnded') {
          // Find the matching SleepStarted entry that comes before this SleepEnded
          const endTime = new Date(editRowData.EndDateTime || editRowData.Date).getTime();
          const sleepStarted = sheetData
            .filter(row => row.Activity === 'SleepStarted')
            .filter(row => new Date(row.Date).getTime() < endTime)
            .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
          [0]; // Get the most recent SleepStarted before this SleepEnded

          relatedRows = [editRowData];
          if (sleepStarted) {
            relatedRows.push(sleepStarted);
          }
        } else if (editRowData.Activity === 'SleepStarted' && editRowData.EndDateTime) {
          // For completed sleep being edited from SleepStarted row
          const startTime = new Date(editRowData.StartDateTime || editRowData.Date).getTime();
          const sleepEnded = sheetData
            .filter(row => row.Activity === 'SleepEnded')
            .filter(row => new Date(row.Date).getTime() > startTime)
            .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime())
          [0]; // Get the earliest SleepEnded after this SleepStarted

          relatedRows = [editRowData];
          if (sleepEnded) {
            relatedRows.push(sleepEnded);
          }
        }

        // Delete the related rows and track their indices
        const deletedIndices = relatedRows.map(row => row.sheetRowIndex);
        for (const row of relatedRows.sort((a, b) => b.sheetRowIndex - a.sheetRowIndex)) {
          await deleteRowFromSheet(row.sheetRowIndex);
        }

        // Insert new sleep entries
        if (isOngoingSleep) {
          // For ongoing sleep, only insert SleepStarted
          const startDateTime = editRowData.StartDateTime || editRowData.Date;
          await insertRowsInSheet([
            [startDateTime.replace('T', ' '), 'SleepStarted', '1']
          ], findInsertIndex(startDateTime, deletedIndices));
        } else if (editRowData.EndDateTime && editRowData.StartDateTime) {
          // For completed sleep session, insert both rows separately
          // They may not be consecutive in chronological order
          const endDateTime = new Date(editRowData.EndDateTime);
          const startDateTime = new Date(editRowData.StartDateTime);
          const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);

          // Insert SleepEnded first (usually has the later/higher timestamp)
          const endRow = [editRowData.EndDateTime.replace('T', ' '), 'SleepEnded', durationMinutes.toString()];
          const endInsertIndex = findInsertIndex(editRowData.EndDateTime, deletedIndices);
          await insertRowsInSheet([endRow], endInsertIndex);

          // After inserting the end row, we need to adjust deletedIndices
          // to account for the newly inserted row when calculating the start row position
          const adjustedDeletedIndices = deletedIndices.map(idx => {
            // If the deleted index was at or after where we just inserted, increment it
            return idx >= endInsertIndex ? idx + 1 : idx;
          });

          // Now insert SleepStarted
          const startRow = [editRowData.StartDateTime.replace('T', ' '), 'SleepStarted', '1'];
          const startInsertIndex = findInsertIndex(editRowData.StartDateTime, adjustedDeletedIndices);
          await insertRowsInSheet([startRow], startInsertIndex);
        }
      } else {
        // Delete original row
        const deletedIndex = editRowData.sheetRowIndex;
        await deleteRowFromSheet(deletedIndex);

        // Calculate insertion point and insert updated row
        const insertIndex = findInsertIndex(editRowData.Date, [deletedIndex]);
        await insertRowsInSheet([[
          editRowData.Date,
          editRowData.Activity,
          editRowData.Quantity
        ]], insertIndex);
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
        // Find the specific sleep session being deleted
        let relatedRows: ActivityRow[] = [];

        if (row.Activity === 'SleepEnded') {
          // Find the matching SleepStarted entry that comes before this SleepEnded
          const sleepStarted = sheetData
            .filter(r => r.Activity === 'SleepStarted')
            .find(r => {
              const startTime = new Date(r.Date).getTime();
              const endTime = new Date(row.Date).getTime();
              return startTime <= endTime;
            });

          relatedRows = [row];
          if (sleepStarted) {
            relatedRows.push(sleepStarted);
          }
        } else if (row.Activity === 'SleepStarted') {
          // Find the matching SleepEnded entry that comes after this SleepStarted
          const sleepEnded = sheetData
            .filter(r => r.Activity === 'SleepEnded')
            .find(r => {
              const startTime = new Date(row.Date).getTime();
              const endTime = new Date(r.Date).getTime();
              return endTime >= startTime;
            });

          relatedRows = [row];
          if (sleepEnded) {
            relatedRows.push(sleepEnded);
          }
        }

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