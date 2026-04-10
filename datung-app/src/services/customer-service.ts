import { supabase } from '../config/supabase';

export interface Customer {
  id: string;
  user_id: string;
  phone: string;
  name: string;
  selfie_url: string | null;
  id_photo_url: string | null;
  datung_score: number;
  level: number;
  status: 'active' | 'frozen' | 'suspended' | 'blocked';
  on_time_repayment_count: number;
  recent_default_count: number;
  created_at: string;
}

/** Customer credit level config — mirrors DB functions */
const LEVEL_CONFIG: Record<number, { maxCentavos: number; termDays: number }> = {
  0: { maxCentavos: 50000, termDays: 3 },
  1: { maxCentavos: 50000, termDays: 5 },
  2: { maxCentavos: 200000, termDays: 14 },
  3: { maxCentavos: 500000, termDays: 30 },
  4: { maxCentavos: 1000000, termDays: 90 },
};

export function getMaxTransaction(level: number): number {
  return LEVEL_CONFIG[level]?.maxCentavos ?? 50000;
}

export function getTermDays(level: number): number {
  return LEVEL_CONFIG[level]?.termDays ?? 3;
}

export const customerService = {
  /** Register a new customer profile */
  async register(data: {
    user_id: string;
    phone: string;
    name: string;
  }): Promise<Customer> {
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        user_id: data.user_id,
        phone: data.phone,
        name: data.name,
      })
      .select()
      .single();

    if (error) throw error;
    return customer as Customer;
  },

  /** Get the current user's customer profile */
  async getMyProfile(): Promise<Customer | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as Customer | null;
  },

  /** Update customer profile */
  async updateProfile(
    customerId: string,
    updates: Partial<Pick<Customer, 'name' | 'selfie_url' | 'id_photo_url'>>,
  ): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data as Customer;
  },

  /** Get all transactions for the current customer */
  async getMyTransactions() {
    const profile = await this.getMyProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('transactions')
      .select('*, stores(name, address)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Get active (non-terminal) transactions */
  async getActiveTransactions() {
    const profile = await this.getMyProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('transactions')
      .select('*, stores(name, address)')
      .eq('customer_id', profile.id)
      .in('status', ['pending', 'approved', 'settled'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Validate that a store exists and is active, returns store or null */
  async validateStore(storeId: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, address, status')
      .eq('id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /** Convert a local image URI (blob URL or data URL) to an ArrayBuffer for upload.
   *  Works on both React Native (file:// URIs) and web (blob://, data:// URIs). */
  async _uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
    const response = await fetch(uri);
    return response.arrayBuffer();
  },

  /** Upload selfie photo (for Level 1+ verification) */
  async uploadSelfie(customerId: string, uri: string): Promise<string> {
    const fileName = `selfies/${customerId}_${Date.now()}.jpg`;
    const buffer = await this._uriToArrayBuffer(uri);

    const { error: uploadErr } = await supabase.storage
      .from('customer-docs')
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage
      .from('customer-docs')
      .getPublicUrl(fileName);

    const { error: updateErr } = await supabase
      .from('customers')
      .update({ selfie_url: urlData.publicUrl })
      .eq('id', customerId);

    if (updateErr) throw updateErr;
    return urlData.publicUrl;
  },

  /** Upload ID photo (for Level 3+ verification) */
  async uploadIdPhoto(customerId: string, uri: string): Promise<string> {
    const fileName = `ids/${customerId}_${Date.now()}.jpg`;
    const buffer = await this._uriToArrayBuffer(uri);

    const { error: uploadErr } = await supabase.storage
      .from('customer-docs')
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage
      .from('customer-docs')
      .getPublicUrl(fileName);

    const { error: updateErr } = await supabase
      .from('customers')
      .update({ id_photo_url: urlData.publicUrl })
      .eq('id', customerId);

    if (updateErr) throw updateErr;
    return urlData.publicUrl;
  },

  /** Request a new transaction at a store.
   *  Prevents duplicate pending requests at the same store. */
  async requestTransaction(data: {
    store_id: string;
    customer_id: string;
    amount_centavos: number;
    interest_centavos: number;
    due_date: string;
  }) {
    // Duplicate check: reject if customer already has a pending transaction at this store
    const { data: existing, error: checkErr } = await supabase
      .from('transactions')
      .select('id')
      .eq('store_id', data.store_id)
      .eq('customer_id', data.customer_id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (existing) {
      throw new Error('Mayroon ka nang nakabinbing (pending) request sa tindahang ito. Hintayin ang approval o kanselahin muna.');
    }

    const { data: txn, error } = await supabase
      .from('transactions')
      .insert({
        store_id: data.store_id,
        customer_id: data.customer_id,
        amount_centavos: data.amount_centavos,
        interest_centavos: data.interest_centavos,
        due_date: data.due_date,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return txn;
  },
};
