/**
 * App context provider for global state management.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  getModelParams,
  hasData,
  getCurrentCycleDay,
  getLatestCycle,
  autoEndPeriods,
} from '../lib/db';
import type { ModelParams, Cycle } from '../lib/types';

interface AppState {
  isLoading: boolean;
  hasSetup: boolean;
  modelParams: ModelParams | null;
  currentCycleDay: number | null;
  latestCycle: Cycle | null;
  dataVersion: number;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSetup, setHasSetup] = useState(false);
  const [modelParams, setModelParams] = useState<ModelParams | null>(null);
  const [currentCycleDay, setCurrentCycleDay] = useState<number | null>(null);
  const [latestCycle, setLatestCycle] = useState<Cycle | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refreshData = useCallback((): Promise<void> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const load = async () => {
      try {
        await autoEndPeriods();
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
        setDataVersion((version) => version + 1);
      } catch (error) {
        console.error('Failed to load app data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    refreshInFlight.current = load().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }, []);

  useEffect(() => {
    void refreshData();
    const onResume = () => {
      if (document.visibilityState === 'visible') void refreshData();
    };
    const timer = window.setInterval(onResume, 60_000);
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [refreshData]);

  return (
    <AppContext.Provider
      value={{
        isLoading,
        hasSetup,
        modelParams,
        currentCycleDay,
        latestCycle,
        dataVersion,
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
