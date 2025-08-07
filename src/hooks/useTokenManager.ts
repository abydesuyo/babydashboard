// src/hooks/useTokenManager.ts
import { useState, useEffect, useCallback } from 'react';

interface TokenData {
  accessToken: string;
  expiresAt: number;
}

interface TokenStatus {
  isValid: boolean;
  isExpiringSoon: boolean;
  minutesUntilExpiry: number;
}

export const useTokenManager = () => {
  const [tokenData, setTokenDataState] = useState<TokenData | null>(null);

  const setTokenData = useCallback((accessToken: string, expiresIn: number) => {
    const expiresAt = Date.now() + (expiresIn * 1000);
    setTokenDataState({ accessToken, expiresAt });
  }, []);

  const clearToken = useCallback(() => {
    setTokenDataState(null);
  }, []);

  const isTokenValid = useCallback(() => {
    if (!tokenData) return false;
    // Add 5-minute buffer before expiry
    return Date.now() < (tokenData.expiresAt - 5 * 60 * 1000);
  }, [tokenData]);

  const getTokenStatus = useCallback((): TokenStatus => {
    if (!tokenData) {
      return { isValid: false, isExpiringSoon: false, minutesUntilExpiry: 0 };
    }
    
    const now = Date.now();
    const timeUntilExpiry = tokenData.expiresAt - now;
    const minutesUntilExpiry = Math.max(0, Math.floor(timeUntilExpiry / (1000 * 60)));
    
    return {
      isValid: timeUntilExpiry > 5 * 60 * 1000, // Valid if more than 5 minutes left
      isExpiringSoon: timeUntilExpiry <= 15 * 60 * 1000 && timeUntilExpiry > 0, // Expiring if less than 15 minutes
      minutesUntilExpiry
    };
  }, [tokenData]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    // Since we can't do automatic refresh without a backend,
    // we'll return false to indicate refresh failed
    // The calling code should handle re-authentication
    console.warn('Token expired - automatic refresh not available without backend. User needs to re-authenticate.');
    return false;
  }, []);

  // Monitor token expiry and attempt refresh
  useEffect(() => {
    if (!tokenData) return;

    const checkTokenExpiry = async () => {
      if (!isTokenValid()) {
        console.warn('Token is about to expire, attempting refresh...');
        const refreshSuccess = await refreshToken();
        if (!refreshSuccess) {
          console.warn('Token refresh failed, user will need to re-authenticate');
          // Clear the invalid token
          clearToken();
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);
    
    // Also check immediately if token is close to expiry
    if (tokenData.expiresAt - Date.now() < 10 * 60 * 1000) { // Less than 10 minutes left
      checkTokenExpiry();
    }
    
    return () => clearInterval(interval);
  }, [tokenData, isTokenValid, refreshToken, clearToken]);

  return {
    accessToken: tokenData?.accessToken || null,
    isTokenValid,
    getTokenStatus,
    refreshToken,
    setTokenData,
    clearToken,
    expiresAt: tokenData?.expiresAt || null
  };
};

export default useTokenManager;