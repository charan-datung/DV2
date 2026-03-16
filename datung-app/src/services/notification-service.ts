import { supabase } from '../config/supabase';
import { adminService } from './admin-service';

/**
 * Notification service — sends SMS/push notifications.
 *
 * In MVP, notifications are logged to the notification_log table.
 * Actual SMS delivery (Semaphore, Globe Labs) and push (Expo Push)
 * will be integrated in production builds.
 */

export const notificationService = {
  /** Notify customer about upcoming due date (1 day before) */
  async sendDueDateReminder(customerId: string, customerName: string, daysLeft: number, amountCentavos: number) {
    const pesos = (amountCentavos / 100).toLocaleString();
    return adminService.createNotification({
      recipient_type: 'customer',
      recipient_id: customerId,
      channel: 'sms',
      event_type: 'due_date_reminder',
      title: 'Paalala: Malapit nang mag-due',
      body: `Hi ${customerName}, ${daysLeft} araw na lang bago mag-due ang ₱${pesos} mo. Magbayad na para maiwasan ang penalty.`,
    });
  },

  /** Notify customer that their account was frozen (Day 5 escalation) */
  async sendFreezeNotice(customerId: string, customerName: string) {
    return adminService.createNotification({
      recipient_type: 'customer',
      recipient_id: customerId,
      channel: 'sms',
      event_type: 'account_frozen',
      title: 'Account Frozen',
      body: `Hi ${customerName}, naka-freeze ang iyong Datung account dahil sa overdue na bayad. Magbayad agad para ma-unfreeze.`,
    });
  },

  /** Notify store owner that their store was frozen due to customer default */
  async sendStoreFreezeNotice(storeId: string, storeName: string, customerName: string) {
    return adminService.createNotification({
      recipient_type: 'store',
      recipient_id: storeId,
      channel: 'sms',
      event_type: 'store_frozen',
      title: 'Tindahan Frozen',
      body: `${storeName}: Naka-freeze ang tindahan dahil may customer (${customerName}) na overdue ng 5+ araw. Hindi muna maaaring mag-approve ng bagong transaksyon.`,
    });
  },

  /** Notify customer about Day 3 overdue */
  async sendOverdueDay3(customerId: string, customerName: string, amountCentavos: number) {
    const pesos = (amountCentavos / 100).toLocaleString();
    return adminService.createNotification({
      recipient_type: 'customer',
      recipient_id: customerId,
      channel: 'sms',
      event_type: 'overdue_day3',
      title: 'Overdue na ang bayad mo',
      body: `Hi ${customerName}, 3 araw nang overdue ang ₱${pesos} mo. Bayaran agad para maiwasan ang freeze ng account.`,
    });
  },

  /** Notify customer about permanent block (Day 30) */
  async sendPermanentBlock(customerId: string, customerName: string) {
    return adminService.createNotification({
      recipient_type: 'customer',
      recipient_id: customerId,
      channel: 'sms',
      event_type: 'permanent_block',
      title: 'Account Permanently Blocked',
      body: `Hi ${customerName}, permanenteng na-block ang iyong account dahil sa 30 araw na di pagbabayad. Makipag-ugnayan sa support.`,
    });
  },

  /** Notify store owner about new transaction request */
  async sendNewTransactionRequest(storeId: string, storeName: string, customerName: string, amountCentavos: number) {
    const pesos = (amountCentavos / 100).toLocaleString();
    return adminService.createNotification({
      recipient_type: 'store',
      recipient_id: storeId,
      channel: 'push',
      event_type: 'new_transaction_request',
      title: 'Bagong Request',
      body: `${storeName}: Si ${customerName} ay nag-request ng ₱${pesos}. Buksan ang app para i-approve o i-decline.`,
    });
  },

  /** Notify customer that their transaction was approved */
  async sendTransactionApproved(customerId: string, customerName: string, storeName: string, amountCentavos: number) {
    const pesos = (amountCentavos / 100).toLocaleString();
    return adminService.createNotification({
      recipient_type: 'customer',
      recipient_id: customerId,
      channel: 'push',
      event_type: 'transaction_approved',
      title: 'Na-approve na!',
      body: `Hi ${customerName}, na-approve na ng ${storeName} ang ₱${pesos} mo. Tandaan ang due date!`,
    });
  },

  /** Notify customer about successful repayment */
  async sendRepaymentConfirmation(customerId: string, customerName: string, amountCentavos: number) {
    const pesos = (amountCentavos / 100).toLocaleString();
    return adminService.createNotification({
      recipient_type: 'customer',
      recipient_id: customerId,
      channel: 'push',
      event_type: 'repayment_confirmed',
      title: 'Bayad na!',
      body: `Hi ${customerName}, natanggap na ang ₱${pesos} mo. Salamat sa pagbabayad on time!`,
    });
  },

  /** Notify store about settlement completed */
  async sendSettlementComplete(storeId: string, storeName: string, amountCentavos: number) {
    const pesos = (amountCentavos / 100).toLocaleString();
    return adminService.createNotification({
      recipient_type: 'store',
      recipient_id: storeId,
      channel: 'push',
      event_type: 'settlement_completed',
      title: 'Settlement Na-process',
      body: `${storeName}: Na-settle na ang ₱${pesos}. Na-credit na sa iyong account.`,
    });
  },
};
