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
  method: 'gcash' | 'otc';
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

  /** Submit a repayment for a transaction */
  async submitRepayment(data: {
    transaction_id: string;
    amount_centavos: number;
    method: 'gcash' | 'otc';
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

    // Update transaction status to repaid
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({
        status: 'repaid',
        repaid_at: new Date().toISOString(),
      })
      .eq('id', data.transaction_id);

    if (updateErr) throw updateErr;

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
