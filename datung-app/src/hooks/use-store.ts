import { useCallback, useEffect, useState } from 'react';
import { storeService, type Store, type StoreCustomer } from '../services/store-service';
import { useRealtime } from './use-realtime';

/** Fetches and caches the current user's store */
export function useMyStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const s = await storeService.getMyStore();
      setStore(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load store');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { store, isLoading, error, refetch: fetch };
}

/** Fetches customers for a given store */
export function useStoreCustomers(storeId: string | undefined) {
  const [customers, setCustomers] = useState<StoreCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!storeId) return;
    try {
      setIsLoading(true);
      setError(null);
      const c = await storeService.getStoreCustomers(storeId);
      setCustomers(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { customers, isLoading, error, refetch: fetch };
}

/** Fetches transactions for a store with realtime updates */
export function useStoreTransactions(storeId: string | undefined) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!storeId) return;
    try {
      setIsLoading(true);
      setError(null);
      const txns = await storeService.getTransactions(storeId);
      setTransactions(txns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Auto-refresh when transactions change in realtime
  useRealtime(
    'transactions',
    '*',
    () => fetch(),
    storeId ? `store_id=eq.${storeId}` : undefined,
  );

  return { transactions, isLoading, error, refetch: fetch };
}
