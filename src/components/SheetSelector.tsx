// src/components/SheetSelector.tsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  getSavedSheets, 
  createNewSheet, 
  joinExistingSheet, 
  removeSheet,
  migrateLegacySheets,
  verifySheetAccess 
} from '../utils/userSheetManager';
import type { SavedSheet } from '../types';

export interface SheetSelectorProps {
  accessToken: string;
  userEmail: string;
  onSheetSelected: (sheet: SavedSheet) => void;
  onClose?: () => void;
}

export const SheetSelector: React.FC<SheetSelectorProps> = memo(({
  accessToken,
  userEmail,
  onSheetSelected,
  onClose
}) => {
  const [sheets, setSheets] = useState<SavedSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [joinSheetId, setJoinSheetId] = useState('');
  const [joinSheetName, setJoinSheetName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Parse Google Sheets URL to extract ID
  const parseGoogleSheetsUrl = (input: string): string => {
    if (!input) return '';
    
    // If it's already just an ID (no slashes), return as-is
    if (!input.includes('/')) return input;
    
    // Extract ID from various Google Sheets URL formats
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input;
  };

  // Filter sheets based on search term
  const filteredSheets = sheets.filter(sheet =>
    sheet.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show success message temporarily
  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const loadSheets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get existing saved sheets from API/localStorage
      let userSheets = await getSavedSheets(accessToken, userEmail);
      
      // If no sheets found, try to migrate legacy sheets
      if (userSheets.length === 0) {
        userSheets = await migrateLegacySheets(accessToken, userEmail);
      }
      
      // Verify access to all sheets in background (non-blocking)
      // For better UX, we show sheets immediately and verify in background
      setSheets(userSheets);
      
      // Background verification - remove inaccessible sheets
      setTimeout(async () => {
        const verifiedSheets: SavedSheet[] = [];
        for (const sheet of userSheets) {
          try {
            const isAccessible = await verifySheetAccess(accessToken, sheet.spreadsheetId);
            if (isAccessible) {
              verifiedSheets.push(sheet);
            } else {
              await removeSheet(accessToken, userEmail, sheet.id);
            }
          } catch (error) {
            // Keep sheet if verification fails (might be network issue)
            verifiedSheets.push(sheet);
          }
        }
        
        // Update sheets if any were removed
        if (verifiedSheets.length !== userSheets.length) {
          setSheets(verifiedSheets);
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to load sheets:', error);
      setError('Failed to load your sheets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, userEmail]);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const handleCreateSheet = async () => {
    if (!newSheetName.trim()) {
      setError('Please enter a sheet name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const newSheet = await createNewSheet(accessToken, userEmail, newSheetName.trim());
      setSheets(prev => [newSheet, ...prev]);
      setNewSheetName('');
      setShowCreateForm(false);
      showSuccessMessage(`Sheet "${newSheet.name}" created successfully!`);
      onSheetSelected(newSheet);
    } catch (error) {
      console.error('Failed to create sheet:', error);
      setError('Failed to create sheet. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSheet = async () => {
    if (!joinSheetId.trim()) {
      setError('Please enter a sheet ID or URL');
      return;
    }

    const parsedSheetId = parseGoogleSheetsUrl(joinSheetId.trim());
    if (!parsedSheetId) {
      setError('Invalid Google Sheets URL or ID');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const joinedSheet = await joinExistingSheet(
        accessToken, 
        userEmail, 
        parsedSheetId,
        joinSheetName.trim() || undefined
      );
      
      if (joinedSheet) {
        setSheets(prev => [joinedSheet, ...prev]);
        setJoinSheetId('');
        setJoinSheetName('');
        setShowJoinForm(false);
        showSuccessMessage(`Successfully joined "${joinedSheet.name}"!`);
        onSheetSelected(joinedSheet);
      } else {
        setError('Could not access this sheet. Check the ID and your permissions.');
      }
    } catch (error) {
      console.error('Failed to join sheet:', error);
      setError('Failed to join sheet. Please check the sheet ID and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveSheet = async (sheetId: string) => {
    if (confirm('Are you sure you want to remove this sheet from your list? This will not delete the actual sheet.')) {
      try {
        await removeSheet(accessToken, userEmail, sheetId);
        setSheets(prev => prev.filter(s => s.id !== sheetId));
      } catch (error) {
        console.error('Failed to remove sheet:', error);
        setError('Failed to remove sheet. Please try again.');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="sheet-selector">
        <div className="sheet-selector-header">
          <h2>Loading your sheets...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-selector">
      <div className="sheet-selector-header">
        <h2>Select a Sheet</h2>
        {onClose && (
          <button onClick={onClose} className="close-button" aria-label="Close">×</button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      <div className="sheet-selector-content">
        {sheets.length > 0 && (
          <div className="sheets-list">
            <div className="sheets-header">
              <h3>Your Sheets</h3>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search sheets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
            {filteredSheets.map(sheet => (
              <div key={sheet.id} className="sheet-item">
                <div className="sheet-info">
                  <div className="sheet-name">{sheet.name}</div>
                  <div className="sheet-details">
                    <span className={`sheet-role ${sheet.role}`}>{sheet.role}</span>
                    <span className="sheet-date">Last used: {formatDate(sheet.lastAccessed)}</span>
                  </div>
                </div>
                <div className="sheet-actions">
                  <button 
                    onClick={() => onSheetSelected(sheet)}
                    className="select-button"
                  >
                    Select
                  </button>
                  <button 
                    onClick={() => handleRemoveSheet(sheet.id)}
                    className="remove-button"
                    title="Remove from list"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sheet-actions-section">
          {!showCreateForm && !showJoinForm && (
            <div className="action-buttons">
              <button 
                onClick={() => setShowCreateForm(true)}
                className="create-button"
              >
                Create New Sheet
              </button>
              <button 
                onClick={() => setShowJoinForm(true)}
                className="join-button"
              >
                Join Existing Sheet
              </button>
            </div>
          )}

          {showCreateForm && (
            <div className="create-form">
              <h3>✨ Create New Sheet</h3>
              <input
                type="text"
                placeholder="Sheet name (e.g., 'Baby Emma - Family')"
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                maxLength={100}
              />
              <div className="form-actions">
                <button 
                  onClick={handleCreateSheet}
                  disabled={isCreating}
                  className="create-button"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button 
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewSheetName('');
                    setError(null);
                  }}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showJoinForm && (
            <div className="join-form">
              <h3>📋 Join Existing Sheet</h3>
              <div className="form-help">
                <p>You can paste either:</p>
                <ul>
                  <li>Full Google Sheets URL</li>
                  <li>Just the sheet ID</li>
                </ul>
              </div>
              <input
                type="text"
                placeholder="Paste Google Sheets URL or ID here..."
                value={joinSheetId}
                onChange={(e) => setJoinSheetId(e.target.value)}
                className="url-input"
              />
              <input
                type="text"
                placeholder="Custom name (optional)"
                value={joinSheetName}
                onChange={(e) => setJoinSheetName(e.target.value)}
                maxLength={100}
              />
              <div className="form-actions">
                <button 
                  onClick={handleJoinSheet}
                  disabled={isCreating}
                  className="join-button"
                >
                  {isCreating ? 'Joining...' : 'Join'}
                </button>
                <button 
                  onClick={() => {
                    setShowJoinForm(false);
                    setJoinSheetId('');
                    setJoinSheetName('');
                    setError(null);
                  }}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {sheets.length === 0 && !showCreateForm && !showJoinForm && (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>Welcome to Baby Activity Dashboard!</h3>
            <p>Track your little one's activities like feeding, sleeping, diaper changes, and more.</p>
            <div className="empty-state-actions">
              <div className="getting-started">
                <h4>Getting Started:</h4>
                <ul>
                  <li><strong>Create New:</strong> Start fresh with a new Google Sheet</li>
                  <li><strong>Join Existing:</strong> Share data with family members</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

SheetSelector.displayName = 'SheetSelector';