// src/utils/googleSheets.ts
// Lazy load gapi-script to reduce initial bundle size
const loadGapi = () => import('gapi-script').then(module => module.gapi);
import { parseSheetData } from './dataProcessing';
import { debugLog } from '../Debug';
import { getUserSheetId } from './userSheetManager';

// This helper function ensures the GAPI client is loaded and ready
const initGapiClient = async (accessToken: string) => {
  const gapi = await loadGapi();
  await new Promise<void>((resolve) => gapi.load('client', resolve));
  await gapi.client.init({});
  await gapi.client.load('sheets', 'v4');
  gapi.client.setToken({ access_token: accessToken });
  return gapi;
};

export const fetchData = async (accessToken: string, userEmail: string) => {
  const spreadsheetId = await getUserSheetId(accessToken, userEmail);
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
  return { data: parsedData, sheetName: firstSheetName, sheetId: firstSheet.properties.sheetId, spreadsheetId };
};

export const updateRowInSheet = async (accessToken: string, userEmail: string, sheetName: string, rowData: unknown, rowIndex: number) => {
  const spreadsheetId = await getUserSheetId(accessToken, userEmail);
  const gapi = await initGapiClient(accessToken);
  const range = `${sheetName}!A${rowIndex}:C${rowIndex}`;
  const data = rowData as { Date: string; Activity: string; Quantity: string };
  const values = [[data.Date, data.Activity, data.Quantity]];
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: values },
  });
};

// MODIFIED FUNCTION: Now accepts an `insertIndex` to insert at any row
export const insertRowsInSheet = async (accessToken: string, userEmail: string, sheetName: string, sheetId: number, rows: unknown[][], insertIndex: number) => {
    const spreadsheetId = await getUserSheetId(accessToken, userEmail);
    const gapi = await initGapiClient(accessToken);

    // 1. Insert the required number of empty rows at the target index
    await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
            requests: [
                {
                    insertDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: insertIndex - 1, // API index is 0-based
                            endIndex: (insertIndex - 1) + rows.length,
                        },
                        inheritFromBefore: false,
                    },
                },
            ],
        },
    });

    // 2. Update the newly created empty rows with our data
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${insertIndex}:C${insertIndex + rows.length - 1}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows },
    });
};

export const deleteRowInSheet = async (
  accessToken: string,
  userEmail: string,
  sheetId: number,
  rowIndex: number
) => {
  const spreadsheetId = await getUserSheetId(accessToken, userEmail);
  debugLog("[DELETE] deleteRowInSheet called for row:", rowIndex);
  const gapi = await initGapiClient(accessToken);
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 1-based to 0-based
              endIndex: rowIndex,       // exclusive
            },
          },
        },
      ],
    },
  });
  debugLog("[DELETE] deleteRowInSheet finished for row:", rowIndex);
};