import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminKPIs, useOverdueTransactions } from '../../hooks/use-admin';
import { adminService } from '../../services/admin-service';
import { formatCentavos } from '../../utils/currency';
import { formatDate, daysUntil } from '../../utils/date';
import { userFriendlyError } from '../../utils/errors';
import LoadingSpinner from '../../components/loading-spinner';
import ErrorBanner from '../../components/error-banner';

const C = {
  primary: '#0D5C37',
  primaryDark: '#09402A',
  primaryLight: '#E8F5EE',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1A1A2E',
  textSub: '#5E6A7A',
  error: '#C62828',
  errorLight: '#FFEBEE',
  warning: '#E65100',
  warningLight: '#FFF3E0',
  accent: '#F4A200',
  accentLight: '#FFF8E1',
  purple: '#7C3AED',
  purpleLight: '#F3E8FF',
  blue: '#1565C0',
  blueLight: '#E3F2FD',
  disabled: '#A8B4C0',
};

export default function AdminDashboardScreen() {
  const { kpis, isLoading, error, refetch: refetchKPIs } = useAdminKPIs();
  const { transactions: overdue, refetch: refetchOverdue } = useOverdueTransactions();

  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchKPIs(), refetchOverdue()]);
    setRefreshing(false);
  }, [refetchKPIs, refetchOverdue]);

  const handleRunEscalation = async () => {
    setRunning('escalation');
    try {
      const result = await adminService.runEscalation();
      Alert.alert('Escalation Complete', `Processed: ${result?.processed ?? 0} transactions`);
      await onRefresh();
    } catch (err) {
      Alert.alert('Error', userFriendlyError(err));
    } finally {
      setRunning(null);
    }
  };

  const handleRunSettlement = async () => {
    setRunning('settlement');
    try {
      const result = await adminService.runSettlementProcessing();
      Alert.alert('Settlement Processing', `Settled: ${result?.settled ?? 0} transactions`);
      await onRefresh();
    } catch (err) {
      Alert.alert('Error', userFriendlyError(err));
    } finally {
      setRunning(null);
    }
  };

  if (isLoading && !kpis) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Datung Operations Overview</Text>

        {error && <ErrorBanner message={error} />}

        {/* Revenue KPIs */}
        <Text style={styles.sectionTitle}>Revenue</Text>
        <View style={styles.cardRow}>
          <KPICard
            label="Outstanding"
            value={formatCentavos(kpis?.total_outstanding_centavos ?? 0)}
            bg={C.accentLight}
            color={C.accent}
          />
          <KPICard
            label="Repaid"
            value={formatCentavos(kpis?.total_repaid_centavos ?? 0)}
            bg={C.primaryLight}
            color={C.primary}
          />
        </View>
        <View style={styles.cardRow}>
          <KPICard
            label="Interest Earned"
            value={formatCentavos(kpis?.total_interest_earned_centavos ?? 0)}
            bg={C.purpleLight}
            color={C.purple}
          />
          <KPICard
            label="Defaulted"
            value={formatCentavos(kpis?.total_defaulted_centavos ?? 0)}
            bg={C.errorLight}
            color={C.error}
          />
        </View>

        {/* Entities KPIs */}
        <Text style={styles.sectionTitle}>Users</Text>
        <View style={styles.cardRow}>
          <KPICard
            label="Stores"
            value={`${kpis?.active_stores ?? 0} / ${kpis?.total_stores ?? 0}`}
            bg={C.primaryLight}
            color={C.primary}
            sub={kpis?.frozen_stores ? `${kpis.frozen_stores} frozen` : undefined}
          />
          <KPICard
            label="Customers"
            value={`${kpis?.active_customers ?? 0} / ${kpis?.total_customers ?? 0}`}
            bg={C.blueLight}
            color={C.blue}
            sub={
              (kpis?.frozen_customers || kpis?.blocked_customers)
                ? `${kpis?.frozen_customers ?? 0}F / ${kpis?.blocked_customers ?? 0}B`
                : undefined
            }
          />
        </View>

        {/* Transaction KPIs */}
        <Text style={styles.sectionTitle}>Transactions</Text>
        <View style={styles.statsRow}>
          <StatItem label="Pending" value={kpis?.pending_transactions ?? 0} />
          <View style={styles.statDivider} />
          <StatItem label="Active" value={kpis?.active_transactions ?? 0} />
          <View style={styles.statDivider} />
          <StatItem label="Repaid" value={kpis?.repaid_transactions ?? 0} />
          <View style={styles.statDivider} />
          <StatItem label="Default" value={kpis?.defaulted_transactions ?? 0} color={C.error} />
        </View>

        {/* Settlement KPIs */}
        <Text style={styles.sectionTitle}>Settlements</Text>
        <View style={styles.cardRow}>
          <KPICard
            label="Pending"
            value={formatCentavos(kpis?.pending_settlement_centavos ?? 0)}
            bg={C.warningLight}
            color={C.warning}
          />
          <KPICard
            label="Completed"
            value={formatCentavos(kpis?.completed_settlement_centavos ?? 0)}
            bg={C.primaryLight}
            color={C.primary}
          />
        </View>

        {/* Overdue Alert */}
        {(kpis?.overdue_count ?? 0) > 0 && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>
              {kpis?.overdue_count} Overdue Transactions
            </Text>
            {overdue.slice(0, 5).map((t) => (
              <View key={t.id} style={styles.overdueRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overdueCustomer}>
                    {t.customers?.name ?? 'Unknown'} @ {t.stores?.name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.overdueAmount}>
                    {formatCentavos(t.amount_centavos)} · Due: {formatDate(t.due_date)}
                  </Text>
                </View>
                <Text style={styles.overdueDays}>
                  {Math.abs(daysUntil(t.due_date))}d
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Admin Actions */}
        <Text style={styles.sectionTitle}>Backend Actions</Text>
        <View style={styles.actionsCard}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && styles.actionBtnPressed,
            ]}
            onPress={handleRunEscalation}
            disabled={!!running}
          >
            {running === 'escalation' ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <>
                <Text style={styles.actionBtnText}>Run Escalation</Text>
                <Text style={styles.actionBtnSub}>Day 3/5/10/30 processing</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: C.blue },
              pressed && { backgroundColor: '#0D47A1' },
            ]}
            onPress={handleRunSettlement}
            disabled={!!running}
          >
            {running === 'settlement' ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <>
                <Text style={styles.actionBtnText}>Run Settlements</Text>
                <Text style={styles.actionBtnSub}>Process pending 48hr/same-day</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({
  label, value, bg, color, sub,
}: { label: string; value: string; bg: string; color: string; sub?: string }) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: C.text, paddingHorizontal: 20, paddingTop: 16 },
  subtitle: { fontSize: 14, color: C.textSub, paddingHorizontal: 20, marginBottom: 20 },

  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: C.textSub,
    paddingHorizontal: 20, marginTop: 20, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  cardRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  kpiCard: { flex: 1, borderRadius: 14, padding: 16 },
  kpiLabel: { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiSub: { fontSize: 11, color: C.textSub, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', backgroundColor: C.white,
    marginHorizontal: 16, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.textSub, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E8ECF0', marginVertical: 4 },

  alertCard: {
    backgroundColor: C.errorLight, borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginTop: 16,
  },
  alertTitle: { fontSize: 15, fontWeight: '700', color: C.error, marginBottom: 12 },
  overdueRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FFCDD2',
  },
  overdueCustomer: { fontSize: 13, fontWeight: '600', color: C.text },
  overdueAmount: { fontSize: 12, color: C.textSub, marginTop: 2 },
  overdueDays: { fontSize: 16, fontWeight: '800', color: C.error },

  actionsCard: {
    marginHorizontal: 16, gap: 12, marginTop: 4,
  },
  actionBtn: {
    backgroundColor: C.primary, borderRadius: 12, padding: 16,
    alignItems: 'center',
  },
  actionBtnPressed: { backgroundColor: C.primaryDark },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
  actionBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
