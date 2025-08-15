// API client for Baby Dashboard backend
import type { SavedSheet } from '../types';

// API URL - for Cloudflare Pages, use same domain in production, localhost for dev
const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

class ApiError extends Error {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class ApiClient {
  private accessToken: string | null = null;
  private userEmail: string | null = null;

  constructor(accessToken?: string, userEmail?: string) {
    if (accessToken) {
      this.accessToken = accessToken;
    }
    if (userEmail) {
      this.userEmail = userEmail;
    }
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  setUserEmail(email: string) {
    this.userEmail = email;
  }

  private async makeRequest(endpoint: string, options: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new ApiError('No access token available');
    }

    if (!this.userEmail) {
      throw new ApiError('No user email available');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'X-User-Email': this.userEmail,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`API request failed: ${errorText}`, response.status);
    }

    return response;
  }

  // Get user's saved sheets
  async getUserSheets(): Promise<SavedSheet[]> {
    try {
      const response = await this.makeRequest('/api/sheets');
      const data = await response.json();
      return data.sheets || data.savedSheets || [];
    } catch (error) {
      console.error('Failed to get user sheets from API:', error);
      throw error;
    }
  }

  // Save a sheet for the user
  async saveSheet(sheet: SavedSheet): Promise<void> {
    try {
      await this.makeRequest('/api/sheets', {
        method: 'POST',
        body: JSON.stringify({
          sheetId: sheet.id,
          sheetName: sheet.name,
          spreadsheetId: sheet.spreadsheetId,
          role: sheet.role
        }),
      });
    } catch (error) {
      console.error('Failed to save sheet to API:', error);
      throw error;
    }
  }

  // Update sheet's last accessed time
  async updateSheetAccess(sheetId: string): Promise<void> {
    try {
      await this.makeRequest(`/api/sheets/${sheetId}/access`, {
        method: 'PUT',
      });
    } catch (error) {
      console.error('Failed to update sheet access:', error);
      throw error;
    }
  }

  // Remove a sheet from user's collection
  async removeSheet(sheetId: string): Promise<void> {
    try {
      await this.makeRequest(`/api/sheets/${sheetId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to remove sheet from API:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; environment?: string; timestamp?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new ApiError('Health check failed', response.status);
      }
      return await response.json();
    } catch (error) {
      console.error('API health check failed:', error);
      throw error;
    }
  }

  // Test connection (useful for development)
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

export const getApiClient = (accessToken?: string, userEmail?: string): ApiClient => {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient(accessToken, userEmail);
  } else {
    if (accessToken) {
      apiClientInstance.setAccessToken(accessToken);
    }
    if (userEmail) {
      apiClientInstance.setUserEmail(userEmail);
    }
  }
  
  return apiClientInstance;
};

export { ApiError };