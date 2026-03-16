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

  /** Validate business rules before approval */
  async validateApproval(
    transactionId: string,
    storeId: string,
    customerId: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    // 1. Check store status
    const { data: store } = await supabase
      .from('stores')
      .select('status, available_balance')
      .eq('id', storeId)
      .single();

    if (!store) return { valid: false, reason: 'Hindi nahanap ang tindahan.' };
    if (store.status === 'frozen') return { valid: false, reason: 'Naka-freeze ang tindahan. Hindi maaaring mag-approve ng transaksyon.' };
    if (store.status === 'suspended' || store.status === 'blocked') return { valid: false, reason: 'Hindi aktibo ang tindahan.' };

    // 2. Check customer status
    const { data: customer } = await supabase
      .from('customers')
      .select('status, level, on_time_repayment_count, recent_default_count')
      .eq('id', customerId)
      .single();

    if (!customer) return { valid: false, reason: 'Hindi nahanap ang customer.' };
    if (customer.status === 'frozen') return { valid: false, reason: 'Naka-freeze ang customer na ito.' };
    if (customer.status === 'blocked') return { valid: false, reason: 'Na-block ang customer na ito sa sistema.' };
    if (customer.status === 'suspended') return { valid: false, reason: 'Naka-suspend ang customer na ito.' };

    // 3. Check the transaction itself
    const { data: txn } = await supabase
      .from('transactions')
      .select('amount_centavos, status')
      .eq('id', transactionId)
      .single();

    if (!txn) return { valid: false, reason: 'Hindi nahanap ang transaksyon.' };
    if (txn.status !== 'pending') return { valid: false, reason: 'Hindi na pending ang transaksyon na ito.' };

    // 4. Check level limits
    const LEVEL_MAX: Record<number, number> = {
      0: 50000, 1: 50000, 2: 200000, 3: 500000, 4: 1000000,
    };
    const maxCentavos = LEVEL_MAX[customer.level] ?? 50000;
    if (txn.amount_centavos > maxCentavos) {
      return { valid: false, reason: `Lumagpas sa limit ng Level ${customer.level} (max ₱${(maxCentavos / 100).toLocaleString()}).` };
    }

    // 5. Check global outstanding balance cap
    const { data: outstanding } = await supabase
      .from('transactions')
      .select('amount_centavos')
      .eq('customer_id', customerId)
      .in('status', ['approved', 'settled']);

    const totalOutstanding = (outstanding ?? []).reduce((sum, t) => sum + t.amount_centavos, 0);
    if (totalOutstanding + txn.amount_centavos > maxCentavos) {
      return {
        valid: false,
        reason: `Masyado nang mataas ang outstanding ng customer (₱${((totalOutstanding) / 100).toLocaleString()}). Lalampas sa limit kung i-approve.`,
      };
    }

    // 6. Check store available balance
    if (store.available_balance < txn.amount_centavos) {
      return { valid: false, reason: 'Hindi sapat ang available balance ng tindahan.' };
    }

    // 7. Check 2-defaults-in-60-days block rule
    if (customer.recent_default_count >= 2) {
      return { valid: false, reason: 'May dalawang default ang customer sa loob ng 60 araw. Hindi maaaring mag-transact.' };
    }

    return { valid: true };
  },

  /** Approve a pending transaction — validates rules, creates store interview, deducts balance */
  async approveTransaction(
    transactionId: string,
    storeId: string,
    customerId: string,
    trustReason: string,
  ) {
    // Validate business rules first
    const validation = await this.validateApproval(transactionId, storeId, customerId);
    if (!validation.valid) {
      throw new Error(validation.reason ?? 'Hindi ma-approve ang transaksyon.');
    }

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

    // Get transaction amount for balance deduction
    const { data: txn } = await supabase
      .from('transactions')
      .select('amount_centavos')
      .eq('id', transactionId)
      .single();

    // Deduct from store available balance
    if (txn) {
      const { data: store } = await supabase
        .from('stores')
        .select('available_balance')
        .eq('id', storeId)
        .single();

      if (store) {
        await supabase
          .from('stores')
          .update({ available_balance: store.available_balance - txn.amount_centavos })
          .eq('id', storeId);
      }
    }

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
