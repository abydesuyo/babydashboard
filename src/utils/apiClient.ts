// API client for Baby Dashboard backend
import type { SavedSheet } from '../types';

// API URL - for Cloudflare Pages, use same domain in production, localhost for dev
// For Cloudflare Pages, API functions are served from the same domain.
// In local dev (Vite on :5173), default to the backend on :3001 so no extra env is needed.
const API_BASE_URL = (() => {
  const fromEnv = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  // Always use relative path for Cloudflare Pages (both dev and prod)
  // Vite proxy will handle localhost:5173 -> localhost:8788
  return '';
})();

class ApiError extends Error {
  public status?: number;
  public details?: unknown;
  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
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

  private async makeRequest(
    endpoint: string,
    options: { method?: string; body?: string; headers?: Record<string, string> } = {}
  ): Promise<any> {
    if (!this.accessToken) {
      throw new ApiError('No access token available');
    }

    if (!this.userEmail) {
      throw new ApiError('No user email available');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'X-User-Email': this.userEmail,
      ...options.headers,
    } as Record<string, string>;

    const response = await fetch(url, {
      method: options.method || 'GET',
      body: options.body,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) {
      // Try to parse JSON error first
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(text);
          throw new ApiError(json.error || 'API request failed', response.status, json);
        } catch {
          // fallthrough to text-based error
        }
      }
      throw new ApiError(`API request failed: ${text?.slice(0, 500) || response.statusText}`, response.status, text);
    }

    if (!text) return null;

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new ApiError('Invalid JSON in API response', response.status, text?.slice(0, 500));
      }
    }

    // Fallback: attempt JSON parse, else return raw text
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // Get user's saved sheets
  async getUserSheets(): Promise<SavedSheet[]> {
    try {
      const data = await this.makeRequest('/api/sheets');
      return data?.sheets || data?.savedSheets || [];
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

  // Remove a sheet from user's collection (no-op by design; we do not delete sheets via API)
  async removeSheet(_sheetId: string): Promise<void> {
    // Intentionally no-op to prevent accidental deletions
    return Promise.resolve();
  }

  // Health check
  async healthCheck(): Promise<{ status: string; environment?: string; timestamp?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, { headers: { 'Accept': 'application/json' } });
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