// src/utils/userSheetManager.ts
// Lazy load gapi-script to reduce initial bundle size
const loadGapi = () => import('gapi-script').then(module => module.gapi);
import { getApiClient } from './apiClient';
import type { UserSheetConfig, SavedSheet } from '../types';

const USER_SHEETS_STORAGE_KEY = 'baby-dashboard-user-sheets';
const SAVED_SHEETS_STORAGE_KEY = 'baby-dashboard-saved-sheets';

// Initialize GAPI client helper
const initGapiClient = async (accessToken: string) => {
  const gapi = await loadGapi();
  await new Promise<void>((resolve) => gapi.load('client', resolve));
  await gapi.client.init({});
  await gapi.client.load('sheets', 'v4');
  gapi.client.setToken({ access_token: accessToken });
  return gapi;
};

// =============================================================================
// LOCAL STORAGE FUNCTIONS (Fallback)
// =============================================================================

// Get stored sheet configurations (legacy support)
const getStoredSheetConfigs = (): UserSheetConfig[] => {
  try {
    const stored = localStorage.getItem(USER_SHEETS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Get saved sheets from localStorage
const getSavedSheetsLocal = (userEmail: string): SavedSheet[] => {
  try {
    const stored = localStorage.getItem(SAVED_SHEETS_STORAGE_KEY);
    const allSheets: SavedSheet[] = stored ? JSON.parse(stored) : [];
    return allSheets.filter(sheet => 
      sheet.createdBy === userEmail || 
      sheet.id.includes(userEmail) // For backwards compatibility
    );
  } catch {
    return [];
  }
};

// Save sheet to localStorage
const saveSheetLocal = (userEmail: string, sheet: Omit<SavedSheet, 'lastAccessed'>) => {
  try {
    const stored = localStorage.getItem(SAVED_SHEETS_STORAGE_KEY);
    const allSheets: SavedSheet[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = allSheets.findIndex(s => s.id === sheet.id);
    const savedSheet: SavedSheet = {
      ...sheet,
      lastAccessed: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      allSheets[existingIndex] = savedSheet;
    } else {
      allSheets.push(savedSheet);
    }
    
    localStorage.setItem(SAVED_SHEETS_STORAGE_KEY, JSON.stringify(allSheets));
  } catch (error) {
    console.error('Failed to save sheet to localStorage:', error);
  }
};

// Update sheet access in localStorage
const updateSheetAccessLocal = (sheetId: string) => {
  try {
    const stored = localStorage.getItem(SAVED_SHEETS_STORAGE_KEY);
    const allSheets: SavedSheet[] = stored ? JSON.parse(stored) : [];
    
    const sheetIndex = allSheets.findIndex(s => s.id === sheetId);
    if (sheetIndex >= 0) {
      allSheets[sheetIndex].lastAccessed = new Date().toISOString();
      localStorage.setItem(SAVED_SHEETS_STORAGE_KEY, JSON.stringify(allSheets));
    }
  } catch (error) {
    console.error('Failed to update sheet access in localStorage:', error);
  }
};

// Remove sheet from localStorage
const removeSheetLocal = (userEmail: string, sheetId: string) => {
  try {
    const stored = localStorage.getItem(SAVED_SHEETS_STORAGE_KEY);
    const allSheets: SavedSheet[] = stored ? JSON.parse(stored) : [];
    
    const filteredSheets = allSheets.filter(s => s.id !== sheetId);
    localStorage.setItem(SAVED_SHEETS_STORAGE_KEY, JSON.stringify(filteredSheets));
  } catch (error) {
    console.error('Failed to remove sheet from localStorage:', error);
  }
};

// =============================================================================
// API + LOCAL STORAGE FUNCTIONS (Main Interface)
// =============================================================================

// Get saved sheets for current user (API first, localStorage fallback)
export const getSavedSheets = async (accessToken: string, userEmail: string): Promise<SavedSheet[]> => {
  try {
    // Try API first
    const apiClient = getApiClient(accessToken, userEmail);
    const sheets = await apiClient.getUserSheets();
    
    // Sync to localStorage for offline access
    try {
      localStorage.setItem(`${SAVED_SHEETS_STORAGE_KEY}-${userEmail}`, JSON.stringify(sheets));
    } catch (localError) {
      console.warn('Failed to sync API data to localStorage:', localError);
    }
    
    return sheets;
  } catch (apiError) {
    // API unavailable (expected in local dev), falling back to localStorage silently
    
    // Fallback to localStorage
    const localSheets = getSavedSheetsLocal(userEmail);
    
    // Try to get from user-specific cache if main localStorage fails
    if (localSheets.length === 0) {
      try {
        const cached = localStorage.getItem(`${SAVED_SHEETS_STORAGE_KEY}-${userEmail}`);
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    }
    
    return localSheets;
  }
};

// Simplified version for non-async contexts (fallback only)
export const getSavedSheetsSync = (userEmail: string): SavedSheet[] => {
  const localSheets = getSavedSheetsLocal(userEmail);
  
  if (localSheets.length === 0) {
    try {
      const cached = localStorage.getItem(`${SAVED_SHEETS_STORAGE_KEY}-${userEmail}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
  
  return localSheets;
};

// Save a sheet for a user (API first, localStorage fallback)
export const saveSheet = async (accessToken: string, userEmail: string, sheet: Omit<SavedSheet, 'lastAccessed'>): Promise<void> => {
  const sheetWithAccess: SavedSheet = {
    ...sheet,
    lastAccessed: new Date().toISOString()
  };

  // Always save to localStorage first for immediate UI feedback
  saveSheetLocal(userEmail, sheet);

  try {
    // Try to sync with API
    const apiClient = getApiClient(accessToken, userEmail);
    await apiClient.saveSheet(sheetWithAccess);
  } catch (apiError) {
    // Failed to sync to API (expected in local dev), saved locally
    // Sheet is already saved locally, so this is not a critical error
  }
};

// Update last accessed time for a sheet
export const updateSheetAccess = async (accessToken: string, userEmail: string, sheetId: string): Promise<void> => {
  // Update localStorage immediately
  updateSheetAccessLocal(sheetId);

  try {
    // Try to sync with API
    const apiClient = getApiClient(accessToken, userEmail);
    await apiClient.updateSheetAccess(sheetId);
  } catch (apiError) {
    // Failed to sync sheet access to API (expected in local dev)
    // Local update already happened, so this is not critical
  }
};

// Synchronous version for immediate UI updates
export const updateSheetAccessSync = (sheetId: string): void => {
  updateSheetAccessLocal(sheetId);
};

// Remove a saved sheet
export const removeSheet = async (accessToken: string, userEmail: string, sheetId: string): Promise<void> => {
  // Remove from localStorage immediately
  removeSheetLocal(userEmail, sheetId);

  try {
    // Try to sync with API
    const apiClient = getApiClient(accessToken, userEmail);
    await apiClient.removeSheet(sheetId);
  } catch (apiError) {
    console.warn('Failed to sync sheet removal to API:', apiError);
    // Local removal already happened
  }
};

// =============================================================================
// GOOGLE SHEETS OPERATIONS
// =============================================================================

// Verify a sheet exists and is accessible
export const verifySheetAccess = async (accessToken: string, spreadsheetId: string): Promise<boolean> => {
  try {
    const gapi = await initGapiClient(accessToken);
    await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
    return true;
  } catch {
    return false;
  }
};

// Create a new Google Sheet
export const createNewSheet = async (accessToken: string, userEmail: string, sheetName: string): Promise<SavedSheet> => {
  const gapi = await initGapiClient(accessToken);
  
  const createResponse = await gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: {
        title: sheetName
      },
      sheets: [{
        properties: {
          title: 'Activities'
        }
      }]
    }
  });
  
  const spreadsheetId = createResponse.result.spreadsheetId!;
  
  // Add header row
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Activities!A1:C1',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [['Date', 'Activity', 'Quantity']]
    }
  });
  
  // Create saved sheet entry
  const savedSheet: SavedSheet = {
    id: `${userEmail}-${Date.now()}`,
    name: sheetName,
    spreadsheetId,
    role: 'owner',
    lastAccessed: new Date().toISOString(),
    createdBy: userEmail
  };
  
  // Save to both API and localStorage
  await saveSheet(accessToken, userEmail, savedSheet);
  
  return savedSheet;
};

// Join an existing sheet by spreadsheet ID
export const joinExistingSheet = async (accessToken: string, userEmail: string, spreadsheetId: string, customName?: string): Promise<SavedSheet | null> => {
  try {
    const gapi = await initGapiClient(accessToken);
    const response = await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
    
    const sheetTitle = response.result.properties?.title || 'Shared Sheet';
    const savedSheet: SavedSheet = {
      id: `${userEmail}-shared-${Date.now()}`,
      name: customName || sheetTitle,
      spreadsheetId,
      role: 'collaborator',
      lastAccessed: new Date().toISOString(),
      createdBy: undefined // Unknown creator for joined sheets
    };
    
    // Save to both API and localStorage
    await saveSheet(accessToken, userEmail, savedSheet);
    return savedSheet;
  } catch (error) {
    console.error('Failed to join sheet:', error);
    return null;
  }
};

// Migrate legacy sheets to new format
export const migrateLegacySheets = async (accessToken: string, userEmail: string): Promise<SavedSheet[]> => {
  const legacyConfigs = getStoredSheetConfigs();
  const userConfig = legacyConfigs.find(c => c.email === userEmail);
  
  if (!userConfig) return [];
  
  try {
    const isAccessible = await verifySheetAccess(accessToken, userConfig.spreadsheetId);
    if (!isAccessible) return [];
    
    const savedSheet: SavedSheet = {
      id: `${userEmail}-migrated-${Date.now()}`,
      name: `Baby Dashboard - ${userEmail}`,
      spreadsheetId: userConfig.spreadsheetId,
      role: 'owner',
      lastAccessed: new Date().toISOString(),
      createdBy: userEmail
    };
    
    await saveSheet(accessToken, userEmail, savedSheet);
    return [savedSheet];
  } catch {
    return [];
  }
};

// Clear all user sheet data (for logout/cleanup)
export const clearUserSheetData = async (accessToken: string | null, userEmail?: string) => {
  if (userEmail) {
    try {
      // Clear from localStorage
      const stored = localStorage.getItem(SAVED_SHEETS_STORAGE_KEY);
      const allSheets: SavedSheet[] = stored ? JSON.parse(stored) : [];
      
      const filteredSheets = allSheets.filter(s => 
        s.createdBy !== userEmail && !s.id.includes(userEmail)
      );
      localStorage.setItem(SAVED_SHEETS_STORAGE_KEY, JSON.stringify(filteredSheets));
      
      // Clear user-specific cache
      localStorage.removeItem(`${SAVED_SHEETS_STORAGE_KEY}-${userEmail}`);
      
      // Note: We don't clear from API on logout - user data should persist
    } catch (error) {
      console.error('Failed to clear user sheets:', error);
    }
  } else {
    // Clear all localStorage data
    localStorage.removeItem(SAVED_SHEETS_STORAGE_KEY);
    localStorage.removeItem(USER_SHEETS_STORAGE_KEY);
    
    // Clear all user-specific caches
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(SAVED_SHEETS_STORAGE_KEY)) {
        localStorage.removeItem(key);
      }
    });
  }
};

// Get sheet by ID
export const getSheetById = async (accessToken: string, userEmail: string, sheetId: string): Promise<SavedSheet | null> => {
  try {
    const sheets = await getSavedSheets(accessToken, userEmail);
    return sheets.find(s => s.id === sheetId) || null;
  } catch {
    return null;
  }
};

// Legacy function for backward compatibility
export const getUserSheetId = async (accessToken: string, userEmail: string): Promise<string> => {
  const savedSheets = await getSavedSheets(accessToken, userEmail);
  
  if (savedSheets.length > 0) {
    // Return the most recently accessed sheet
    const mostRecent = savedSheets.sort((a, b) => 
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    )[0];
    
    const isAccessible = await verifySheetAccess(accessToken, mostRecent.spreadsheetId);
    if (isAccessible) {
      await updateSheetAccess(accessToken, mostRecent.id);
      return mostRecent.spreadsheetId;
    }
  }
  
  // Try to migrate legacy sheets
  const migratedSheets = await migrateLegacySheets(accessToken, userEmail);
  if (migratedSheets.length > 0) {
    return migratedSheets[0].spreadsheetId;
  }
  
  // Create a new default sheet
  const newSheet = await createNewSheet(accessToken, userEmail, `Baby Dashboard - ${userEmail}`);
  return newSheet.spreadsheetId;
};