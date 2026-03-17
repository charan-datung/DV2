import { useCallback, useEffect, useState } from 'react';
import {
  adminService,
  type AdminKPI,
  type AdminStore,
  type AdminCustomer,
  type AdminTransaction,
  type AdminSettlement,
} from '../services/admin-service';
import { useRealtime } from './use-realtime';

/** Fetches KPI dashboard data */
export function useAdminKPIs() {
  const [kpis, setKpis] = useState<AdminKPI | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminService.getKPIs();
      setKpis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KPIs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useRealtime('transactions', '*', fetch);
  useRealtime('settlements', '*', fetch);

  return { kpis, isLoading, error, refetch: fetch };
}

/** Fetches all stores for admin management */
export function useAdminStores() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminService.getAllStores();
      setStores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { stores, isLoading, error, refetch: fetch };
}

/** Fetches all customers for admin management */
export function useAdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminService.getAllCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { customers, isLoading, error, refetch: fetch };
}

/** Fetches all transactions for admin oversight */
export function useAdminTransactions(filter?: { status?: string }) {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminService.getAllTransactions(filter);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [filter?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  useRealtime('transactions', '*', fetch);

  return { transactions, isLoading, error, refetch: fetch };
}

/** Fetches overdue transactions */
export function useOverdueTransactions() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminService.getOverdueTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overdue transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useRealtime('transactions', '*', fetch);

  return { transactions, isLoading, error, refetch: fetch };
}

/** Fetches all settlements for admin processing */
export function useAdminSettlements(filter?: { status?: string }) {
  const [settlements, setSettlements] = useState<AdminSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminService.getAllSettlements(filter);
      setSettlements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settlements');
    } finally {
      setIsLoading(false);
    }
  }, [filter?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  useRealtime('settlements', '*', fetch);

  return { settlements, isLoading, error, refetch: fetch };
}
