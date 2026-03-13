import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCentavos } from '../utils/currency';
import { formatDate, daysUntil } from '../utils/date';

interface Transaction {
  id: string;
  amount_centavos: number;
  interest_centavos: number;
  status: string;
  due_date: string;
  created_at: string;
}

interface Props {
  transaction: Transaction;
  /** Show store name or customer name as subtitle */
  subtitle?: string;
  onPress?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#E65100', bg: '#FFF3E0' },
  approved: { label: 'Approved', color: '#1565C0', bg: '#E3F2FD' },
  settled: { label: 'Settled', color: '#2E7D32', bg: '#E8F5E9' },
  repaid: { label: 'Bayad na', color: '#0D5C37', bg: '#E8F5EE' },
  defaulted: { label: 'Defaulted', color: '#C62828', bg: '#FFEBEE' },
};

export default function TransactionCard({ transaction, subtitle, onPress }: Props) {
  const status = STATUS_LABELS[transaction.status] ?? STATUS_LABELS.pending;
  const days = daysUntil(transaction.due_date);
  const isOverdue = days < 0 && !['repaid', 'defaulted'].includes(transaction.status);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.amount}>{formatCentavos(transaction.amount_centavos)}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <Text style={styles.date}>
            Due: {formatDate(transaction.due_date)}
            {isOverdue && <Text style={styles.overdue}> ({Math.abs(days)}d overdue)</Text>}
          </Text>
        </View>
        <View style={styles.right}>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pressed: { opacity: 0.92 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  left: { flex: 1, marginRight: 12 },
  right: { alignItems: 'flex-end' },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 13,
    color: '#5E6A7A',
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: '#5E6A7A',
    marginTop: 4,
  },
  overdue: {
    color: '#C62828',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
