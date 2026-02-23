"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { api } from "./api";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(() => {
    setIsAuthenticated(api.isAuthenticated());
  }, []);

  useEffect(() => {
    checkAuth();
    setIsLoading(false);

    // Re-check auth state periodically (catches token expiry / cleared tokens).
    const interval = setInterval(checkAuth, 5_000);

    // Also re-check when the tab regains focus (handles multi-tab logout).
    const onFocus = () => checkAuth();
    window.addEventListener("focus", onFocus);

    // Listen for storage events (another tab cleared tokens).
    const onStorage = (e: StorageEvent) => {
      if (e.key === "accessToken" || e.key === "refreshToken" || e.key === null) {
        checkAuth();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [checkAuth]);

  const logout = () => {
    api.clearTokens();
    setIsAuthenticated(false);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
