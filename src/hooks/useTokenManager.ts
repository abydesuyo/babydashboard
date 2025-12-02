// src/hooks/useTokenManager.ts
import { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';

interface TokenData {
  accessToken: string;
  expiresAt: number;
}

interface TokenStatus {
  isValid: boolean;
  isExpiringSoon: boolean;
  minutesUntilExpiry: number;
}

export const useTokenManager = (onTokenRefresh?: (accessToken: string, expiresIn: number) => void) => {
  const [tokenData, setTokenDataState] = useState<TokenData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Silent token refresh using Google OAuth
  const silentLogin = useGoogleLogin({
    onSuccess: (response) => {
      if (response.access_token) {
        const expiresIn = response.expires_in || 3600;
        setTokenData(response.access_token, expiresIn);
        onTokenRefresh?.(response.access_token, expiresIn);
        setIsRefreshing(false);
      }
    },
    onError: () => {
      console.warn('Silent token refresh failed. User will need to re-authenticate.');
      clearToken();
      setIsRefreshing(false);
    },
    prompt: 'none', // This enables silent refresh
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
  });

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshing) return false; // Prevent multiple simultaneous refreshes

    try {
      setIsRefreshing(true);
      silentLogin();
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      setIsRefreshing(false);
      return false;
    }
  }, [isRefreshing, silentLogin]);

  // Monitor token expiry and attempt refresh
  useEffect(() => {
    if (!tokenData || isRefreshing) return;

    const checkTokenExpiry = async () => {
      const status = getTokenStatus();

      // Only refresh if token is expiring soon but still valid
      if (status.isExpiringSoon && status.isValid) {
        await refreshToken();
      } else if (!status.isValid) {
        // Token already expired, clear it
        clearToken();
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);

    // Also check immediately if token is close to expiry
    if (tokenData.expiresAt - Date.now() < 10 * 60 * 1000) { // Less than 10 minutes left
      checkTokenExpiry();
    }

    return () => clearInterval(interval);
  }, [tokenData, isRefreshing, getTokenStatus, refreshToken, clearToken]);

  return {
    accessToken: tokenData?.accessToken || null,
    isTokenValid,
    getTokenStatus,
    refreshToken,
    setTokenData,
    clearToken,
    expiresAt: tokenData?.expiresAt || null,
    isRefreshing,
  };
};

export default useTokenManager;