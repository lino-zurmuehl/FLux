/**
 * Authentication context for PIN-based app protection.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { hasPIN, verifyPIN, savePIN } from '../lib/auth';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  needsSetup: boolean; // No PIN set yet
  login: (pin: string) => Promise<boolean>;
  setupPIN: (pin: string) => Promise<void>;
  logout: () => void;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const pinExists = await hasPIN();
      setNeedsSetup(!pinExists);
      // If no PIN is set, user needs to set one up first
      // If PIN exists, user needs to authenticate
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (pin: string): Promise<boolean> => {
    const isValid = await verifyPIN(pin);
    if (isValid) {
      setIsAuthenticated(true);
    }
    return isValid;
  };

  const setupPIN = async (pin: string): Promise<void> => {
    await savePIN(pin);
    setNeedsSetup(false);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        needsSetup,
        login,
        setupPIN,
        logout,
        refreshAuthStatus: checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
