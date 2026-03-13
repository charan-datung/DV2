import { useCallback, useEffect, useState } from 'react';
import {
  transactionService,
  type TransactionDetail,
  type Repayment,
} from '../services/transaction-service';
import { useRealtime } from './use-realtime';

/** Fetches a single transaction by ID with realtime updates */
export function useTransactionDetail(transactionId: string | undefined) {
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!transactionId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [txn, reps] = await Promise.all([
        transactionService.getById(transactionId),
        transactionService.getRepayments(transactionId),
      ]);
      setTransaction(txn);
      setRepayments(reps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime updates for this specific transaction
  useRealtime(
    'transactions',
    '*',
    () => fetch(),
    transactionId ? `id=eq.${transactionId}` : undefined,
  );

  useRealtime(
    'repayments',
    '*',
    () => fetch(),
    transactionId ? `transaction_id=eq.${transactionId}` : undefined,
  );

  return { transaction, repayments, isLoading, error, refetch: fetch };
}
