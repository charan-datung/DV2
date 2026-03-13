import { supabase } from '../config/supabase';

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  barangay: string;
  credit_line: number;
  available_balance: number;
  settlement_type: '48hr' | 'same_day';
  status: 'active' | 'frozen' | 'suspended' | 'blocked';
  tier: number;
  created_at: string;
}

export interface StoreCustomer {
  id: string;
  name: string;
  phone: string;
  level: number;
  status: string;
  on_time_repayment_count: number;
  recent_default_count: number;
  /** Sum of outstanding (approved/settled) transaction amounts */
  outstanding_centavos?: number;
}

export const storeService = {
  /** Register a new store. Uses supabase insert (requires service-role or appropriate policy). */
  async register(data: {
    owner_id: string;
    name: string;
    address: string;
    barangay: string;
  }): Promise<Store> {
    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        owner_id: data.owner_id,
        name: data.name,
        address: data.address,
        barangay: data.barangay,
        credit_line: 5000000, // ₱50,000 default
        available_balance: 5000000,
      })
      .select()
      .single();

    if (error) throw error;
    return store as Store;
  },

  /** Get the store owned by the current user */
  async getMyStore(): Promise<Store | null> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as Store | null;
  },

  /** Update store profile fields */
  async updateStore(
    storeId: string,
    updates: Partial<Pick<Store, 'name' | 'address' | 'barangay' | 'settlement_type'>>,
  ): Promise<Store> {
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data as Store;
  },

  /** Get all customers who have transacted at this store */
  async getStoreCustomers(storeId: string): Promise<StoreCustomer[]> {
    // Get unique customer IDs from transactions
    const { data: txns, error: txnErr } = await supabase
      .from('transactions')
      .select('customer_id, amount_centavos, status')
      .eq('store_id', storeId);

    if (txnErr) throw txnErr;
    if (!txns || txns.length === 0) return [];

    // Get unique customer IDs
    const customerIds = [...new Set(txns.map((t) => t.customer_id))];

    const { data: customers, error: custErr } = await supabase
      .from('customers')
      .select('id, name, phone, level, status, on_time_repayment_count, recent_default_count')
      .in('id', customerIds);

    if (custErr) throw custErr;

    return (customers ?? []).map((c) => {
      const outstanding = txns
        .filter(
          (t) =>
            t.customer_id === c.id &&
            (t.status === 'approved' || t.status === 'settled'),
        )
        .reduce((sum, t) => sum + t.amount_centavos, 0);

      return { ...c, outstanding_centavos: outstanding } as StoreCustomer;
    });
  },

  /** Get pending transactions that need store owner approval */
  async getPendingTransactions(storeId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, customers(name, phone, level)')
      .eq('store_id', storeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Get all transactions for a store */
  async getTransactions(storeId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, customers(name, phone, level)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Approve a pending transaction — also creates the store interview record */
  async approveTransaction(
    transactionId: string,
    storeId: string,
    customerId: string,
    trustReason: string,
  ) {
    // Create the store interview record
    const { error: interviewErr } = await supabase
      .from('store_interviews')
      .insert({
        transaction_id: transactionId,
        store_id: storeId,
        customer_id: customerId,
        trust_reason: trustReason,
      });

    if (interviewErr) throw interviewErr;

    // Update transaction status to approved
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** Get settlements for a store */
  async getSettlements(storeId: string) {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },
};
