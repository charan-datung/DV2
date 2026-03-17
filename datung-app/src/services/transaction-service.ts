import { supabase } from '../config/supabase';

export interface TransactionDetail {
  id: string;
  store_id: string;
  customer_id: string;
  amount_centavos: number;
  interest_centavos: number;
  status: string;
  due_date: string;
  approved_at: string | null;
  settled_at: string | null;
  repaid_at: string | null;
  created_at: string;
  stores?: { name: string; address: string };
  customers?: { name: string; phone: string; level: number };
}

export interface Repayment {
  id: string;
  transaction_id: string;
  amount_centavos: number;
  method: 'bank_qr' | 'otc';
  reference_no: string | null;
  created_at: string;
}

export const transactionService = {
  /** Get a single transaction by ID with related store/customer info */
  async getById(transactionId: string): Promise<TransactionDetail | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, stores(name, address), customers(name, phone, level)')
      .eq('id', transactionId)
      .maybeSingle();

    if (error) throw error;
    return data as TransactionDetail | null;
  },

  /** Get repayments for a transaction */
  async getRepayments(transactionId: string): Promise<Repayment[]> {
    const { data, error } = await supabase
      .from('repayments')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Repayment[];
  },

  /** Submit a repayment for a transaction — also handles level progression */
  async submitRepayment(data: {
    transaction_id: string;
    amount_centavos: number;
    method: 'bank_qr' | 'otc';
    reference_no?: string;
  }): Promise<Repayment> {
    const { data: repayment, error } = await supabase
      .from('repayments')
      .insert({
        transaction_id: data.transaction_id,
        amount_centavos: data.amount_centavos,
        method: data.method,
        reference_no: data.reference_no ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Get the transaction to check due date, customer, and total owed
    const { data: txn } = await supabase
      .from('transactions')
      .select('customer_id, due_date, store_id, amount_centavos, interest_centavos')
      .eq('id', data.transaction_id)
      .single();

    if (!txn) return repayment as Repayment;

    // Check total repayments to determine if fully paid
    const { data: allRepayments } = await supabase
      .from('repayments')
      .select('amount_centavos')
      .eq('transaction_id', data.transaction_id);

    const totalPaid = (allRepayments ?? []).reduce((sum, r) => sum + r.amount_centavos, 0);
    const totalOwed = txn.amount_centavos + txn.interest_centavos;
    const isFullyPaid = totalPaid >= totalOwed;

    // Only mark as repaid if the full amount has been paid
    if (isFullyPaid) {
      const { error: updateErr } = await supabase
        .from('transactions')
        .update({
          status: 'repaid',
          repaid_at: new Date().toISOString(),
        })
        .eq('id', data.transaction_id);

      if (updateErr) throw updateErr;

      // Level progression: increment on_time_repayment_count if paid on time
      const dueDate = new Date(txn.due_date);
      const now = new Date();
      const isOnTime = now <= new Date(dueDate.getTime() + 24 * 60 * 60 * 1000); // grace: end of due day

      if (isOnTime) {
        // Use an RPC for atomic increment + conditional level upgrade to avoid
        // read-then-write races when multiple repayments are submitted concurrently.
        await supabase.rpc('process_on_time_repayment', { p_customer_id: txn.customer_id });
      } else {
        // Late payment: atomically decrement level (floor 0) via RPC.
        await supabase.rpc('process_late_repayment', { p_customer_id: txn.customer_id });
      }

      // Store balance is restored atomically by the trg_update_store_balance trigger
      // when the transaction transitions to 'repaid'. No app-level update needed.
    }

    return repayment as Repayment;
  },

  /** Get store interview for a transaction */
  async getInterview(transactionId: string) {
    const { data, error } = await supabase
      .from('store_interviews')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /** Get guarantee events for a transaction */
  async getGuaranteeEvents(transactionId: string) {
    const { data, error } = await supabase
      .from('guarantee_events')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },
};
