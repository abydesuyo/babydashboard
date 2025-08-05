// src/hooks/useTokenManager.ts
import { useState, useEffect, useCallback } from 'react';

interface TokenData {
  accessToken: string;
  expiresAt: number;
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

  const refreshToken = useCallback(async () => {
    // For now, this is a placeholder for future refresh token implementation
    // In a full implementation, this would call your backend to refresh the token
    console.log('Token refresh would be implemented here');
    return false;
  }, []);

  // Monitor token expiry
  useEffect(() => {
    if (!tokenData) return;

    const checkTokenExpiry = () => {
      if (!isTokenValid()) {
        console.warn('Token is about to expire or has expired');
        // Could trigger a refresh attempt here
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);
    return () => clearInterval(interval);
  }, [tokenData, isTokenValid]);

  return {
    accessToken: tokenData?.accessToken || null,
    isTokenValid,
    refreshToken,
    setTokenData,
    clearToken,
    expiresAt: tokenData?.expiresAt || null
  };
};

export default useTokenManager;