// src/types/index.ts
export type UserProfile = {
  email: string;
  name: string;
  picture: string;
};

export type ActivityRow = {
  Date: string;
  Activity: string;
  Quantity: string;
  sheetRowIndex: number;
  originalIndex: string;
  EndDateTime?: string; // Only for sleep edit
};

export type NewEntry = {
  DateTime: string;
  Activity: string;
  Quantity: string;
  EndDateTime: string;
};

export type SheetInfo = {
  name: string;
  id: number;
  spreadsheetId?: string;
};

export type UserSheetConfig = {
  email: string;
  spreadsheetId: string;
  createdAt: string;
};

export type SavedSheet = {
  id: string;
  name: string;
  spreadsheetId: string;
  role: 'owner' | 'collaborator';
  lastAccessed: string;
  createdBy?: string;
};

export type SheetSelectorState = {
  selectedSheetId: string | null;
  availableSheets: SavedSheet[];
  isSelectingSheet: boolean;
};