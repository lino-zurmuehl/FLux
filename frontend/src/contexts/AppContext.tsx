/**
 * App context provider for global state management.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  getModelParams,
  hasData,
  getCurrentCycleDay,
  getLatestCycle,
} from '../lib/db';
import type { ModelParams, Cycle } from '../lib/types';

interface AppState {
  isLoading: boolean;
  hasSetup: boolean;
  modelParams: ModelParams | null;
  currentCycleDay: number | null;
  latestCycle: Cycle | null;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSetup, setHasSetup] = useState(false);
  const [modelParams, setModelParams] = useState<ModelParams | null>(null);
  const [currentCycleDay, setCurrentCycleDay] = useState<number | null>(null);
  const [latestCycle, setLatestCycle] = useState<Cycle | null>(null);

  const refreshData = async () => {
    try {
      const [hasDataResult, params, cycleDay, latest] = await Promise.all([
        hasData(),
        getModelParams(),
        getCurrentCycleDay(),
        getLatestCycle(),
      ]);

      setHasSetup(hasDataResult);
      setModelParams(params);
      setCurrentCycleDay(cycleDay);
      setLatestCycle(latest ?? null);
    } catch (error) {
      console.error('Failed to load app data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <AppContext.Provider
      value={{
        isLoading,
        hasSetup,
        modelParams,
        currentCycleDay,
        latestCycle,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
