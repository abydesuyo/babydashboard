// src/utils/googleSheets.ts
import { gapi } from 'gapi-script';
import { parseSheetData } from './dataProcessing';
import { debugLog } from '../Debug';

const SPREADSHEET_ID = import.meta.env.VITE_SHEET_ID;

// This helper function ensures the GAPI client is loaded and ready
const initGapiClient = async (accessToken: string) => {
  await new Promise<void>((resolve) => gapi.load('client', resolve));
  await gapi.client.init({});
  await gapi.client.load('sheets', 'v4');
  gapi.client.setToken({ access_token: accessToken });
};

export const fetchData = async (accessToken: string) => {
  await initGapiClient(accessToken);
  const metadataResponse = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const firstSheet = metadataResponse.result.sheets?.[0];
  const firstSheetName = firstSheet?.properties?.title;
  if (!firstSheetName || firstSheet.properties?.sheetId === undefined) {
    throw new Error("No sheets with a valid name and ID found.");
  }

  const dataResponse = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: firstSheetName,
  });
  
  const parsedData = parseSheetData(dataResponse.result.values || []);
  return { data: parsedData, sheetName: firstSheetName, sheetId: firstSheet.properties.sheetId };
};

export const updateRowInSheet = async (accessToken: string, sheetName: string, rowData: any, rowIndex: number) => {
  await initGapiClient(accessToken);
  const range = `${sheetName}!A${rowIndex}:C${rowIndex}`;
  const values = [[rowData.Date, rowData.Activity, rowData.Quantity]];
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: values },
  });
};

// MODIFIED FUNCTION: Now accepts an `insertIndex` to insert at any row
export const insertRowsInSheet = async (accessToken: string, sheetName: string, sheetId: number, rows: any[][], insertIndex: number) => {
    await initGapiClient(accessToken);

    // 1. Insert the required number of empty rows at the target index
    await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
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
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A${insertIndex}:C${insertIndex + rows.length - 1}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows },
    });
};

export const deleteRowInSheet = async (
  accessToken: string,
  sheetId: number,
  rowIndex: number
) => {
debugLog("[DELETE] deleteRowInSheet called for row:", rowIndex);
  await initGapiClient(accessToken);
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
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
  console.log("deleteRowInSheet finished for row:", rowIndex);
};