import { supabase } from '../config/supabase';
import { getTodayManila } from '../utils/date';

export interface AdminKPI {
  total_stores: number;
  active_stores: number;
  frozen_stores: number;
  total_customers: number;
  active_customers: number;
  blocked_customers: number;
  frozen_customers: number;
  total_transactions: number;
  pending_transactions: number;
  active_transactions: number;
  repaid_transactions: number;
  defaulted_transactions: number;
  total_outstanding_centavos: number;
  total_repaid_centavos: number;
  total_defaulted_centavos: number;
  total_interest_earned_centavos: number;
  pending_settlement_centavos: number;
  completed_settlement_centavos: number;
  overdue_count: number;
}

export interface AdminStore {
  id: string;
  name: string;
  address: string;
  barangay: string;
  credit_line: number;
  available_balance: number;
  settlement_type: string;
  status: string;
  tier: number;
  created_at: string;
}

export interface AdminCustomer {
  id: string;
  phone: string;
  name: string;
  level: number;
  status: string;
  on_time_repayment_count: number;
  recent_default_count: number;
  datung_score: number;
  created_at: string;
}

export interface AdminTransaction {
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
  stores?: { name: string };
  customers?: { name: string; phone: string; level: number };
}

export interface AdminSettlement {
  id: string;
  store_id: string;
  amount_centavos: number;
  status: string;
  settled_at: string | null;
  created_at: string;
  stores?: { name: string };
}

export interface NotificationLogEntry {
  id: string;
  recipient_type: string;
  recipient_id: string;
  channel: string;
  event_type: string;
  title: string;
  body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export const adminService = {
  /** Check if current user is an admin */
  async getMyAdmin() {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /** Get KPI summary from the view */
  async getKPIs(): Promise<AdminKPI> {
    const { data, error } = await supabase
      .from('admin_kpi_summary')
      .select('*')
      .single();

    if (error) throw error;
    return data as AdminKPI;
  },

  /** Get all stores */
  async getAllStores(): Promise<AdminStore[]> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as AdminStore[];
  },

  /** Get all customers */
  async getAllCustomers(): Promise<AdminCustomer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as AdminCustomer[];
  },

  /** Get all transactions with related info */
  async getAllTransactions(
    filter?: { status?: string; limit?: number },
  ): Promise<AdminTransaction[]> {
    let query = supabase
      .from('transactions')
      .select('*, stores(name), customers(name, phone, level)')
      .order('created_at', { ascending: false });

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AdminTransaction[];
  },

  /** Get overdue transactions */
  async getOverdueTransactions(): Promise<AdminTransaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, stores(name), customers(name, phone, level)')
      .in('status', ['approved', 'settled'])
      .lt('due_date', getTodayManila())
      .order('due_date', { ascending: true });

    if (error) throw error;
    return (data ?? []) as AdminTransaction[];
  },

  /** Get all settlements */
  async getAllSettlements(
    filter?: { status?: string },
  ): Promise<AdminSettlement[]> {
    let query = supabase
      .from('settlements')
      .select('*, stores(name)')
      .order('created_at', { ascending: false });

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AdminSettlement[];
  },

  /** Update a store's status (admin action) */
  async updateStoreStatus(storeId: string, status: string) {
    const { data, error } = await supabase
      .from('stores')
      .update({ status })
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Update a customer's status (admin action) */
  async updateCustomerStatus(customerId: string, status: string) {
    const { data, error } = await supabase
      .from('customers')
      .update({ status })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Update a customer's level (admin override) */
  async updateCustomerLevel(customerId: string, level: number) {
    const { data, error } = await supabase
      .from('customers')
      .update({ level })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Update a store's credit line */
  async updateStoreCreditLine(storeId: string, creditLine: number) {
    const { data, error } = await supabase
      .from('stores')
      .update({ credit_line: creditLine, available_balance: creditLine })
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Process a settlement (mark as completed) */
  async processSettlement(settlementId: string) {
    const { data, error } = await supabase
      .from('settlements')
      .update({ status: 'completed', settled_at: new Date().toISOString() })
      .eq('id', settlementId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Run escalation function manually */
  async runEscalation() {
    const { data, error } = await supabase.rpc('run_escalation');
    if (error) throw error;
    return data;
  },

  /** Run settlement processing manually */
  async runSettlementProcessing() {
    const { data, error } = await supabase.rpc('run_settlement_processing');
    if (error) throw error;
    return data;
  },

  /** Get guarantee events for all transactions */
  async getAllGuaranteeEvents() {
    const { data, error } = await supabase
      .from('guarantee_events')
      .select('*, stores(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Get notification log */
  async getNotificationLog(limit = 50): Promise<NotificationLogEntry[]> {
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as NotificationLogEntry[];
  },

  /** Create a notification log entry */
  async createNotification(entry: {
    recipient_type: string;
    recipient_id: string;
    channel: string;
    event_type: string;
    title: string;
    body: string;
  }) {
    const { data, error } = await supabase
      .from('notification_log')
      .insert(entry)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
