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
};