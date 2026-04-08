import { useCallback, useEffect, useState } from 'react';
import { customerService, type Customer } from '../services/customer-service';
import type { TransactionDetail } from '../services/transaction-service';
import { useRealtime } from './use-realtime';

/** Fetches and caches the current user's customer profile */
export function useMyCustomer() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const c = await customerService.getMyProfile();
      setCustomer(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime: refresh when customer profile changes (level ups, status, etc.)
  useRealtime('customers', '*', fetch);

  return { customer, isLoading, error, refetch: fetch };
}

/** Fetches the customer's transactions with realtime updates */
export function useCustomerTransactions() {
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const txns = await customerService.getMyTransactions();
      setTransactions(txns as TransactionDetail[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Auto-refresh on realtime changes — pass fetch directly so the ref in
  // useRealtime always calls the latest version without subscription churn.
  useRealtime('transactions', '*', fetch);
  useRealtime('repayments', '*', fetch);

  return { transactions, isLoading, error, refetch: fetch };
}

/** Fetches only active (non-terminal) transactions */
export function useActiveTransactions() {
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const txns = await customerService.getActiveTransactions();
      setTransactions(txns as TransactionDetail[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useRealtime('transactions', '*', fetch);
  useRealtime('repayments', '*', fetch);

  return { transactions, isLoading, error, refetch: fetch };
}
