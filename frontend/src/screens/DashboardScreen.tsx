import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Avatar from '../components/common/Avatar';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getBalances } from '../services/expenses';

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const totalBalance = balances.reduce((sum, b) => sum + parseFloat(b.amount), 0);

  async function load() {
    setError(false);
    try {
      const data = await getBalances();
      setBalances(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#1aa672" />;

  if (error) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Could not load balances</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user?.name || user?.email} 👋</Text>
        <Avatar name={user?.name} email={user?.email} avatar={user?.avatar} size={36} />
      </View>

      <View style={[styles.totalCard, { backgroundColor: totalBalance >= 0 ? '#1aa672' : '#e53935' }]}>
        <Text style={styles.totalLabel}>Overall Balance</Text>
        <Text style={styles.totalAmount}>
          {totalBalance >= 0 ? '+' : ''}{totalBalance.toFixed(2)}
        </Text>
        <Text style={styles.totalSub}>
          {totalBalance > 0 ? 'You are owed money' : totalBalance < 0 ? 'You owe money' : 'All settled up!'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Balances</Text>

      {balances.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>⚖️</Text>
          <Text style={styles.emptyTitle}>All settled up!</Text>
          <Text style={styles.emptySub}>Add expenses in a group to see who owes what.</Text>
        </View>
      ) : (
        <FlatList
          data={balances}
          keyExtractor={(_, i) => i.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const amount = parseFloat(item.amount);
            const isPositive = amount > 0;
            return (
              <View style={styles.balanceRow}>
                <Avatar
                  name={item.user.name}
                  email={item.user.email}
                  avatar={item.user.avatar}
                  size={42}
                  style={styles.avatarMargin}
                />
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{item.user.name || item.user.email}</Text>
                  <Text style={styles.balanceSub}>{isPositive ? 'owes you' : 'you owe'}</Text>
                </View>
                <Text style={[styles.balanceAmount, { color: isPositive ? '#1aa672' : '#e53935' }]}>
                  {isPositive ? '+' : ''}{amount.toFixed(2)}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  greeting: { fontSize: 18, fontWeight: '700' },
  totalCard: { margin: 16, borderRadius: 16, padding: 24, alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  totalAmount: { color: '#fff', fontSize: 40, fontWeight: '800', marginVertical: 4 },
  totalSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginHorizontal: 16, marginBottom: 8 },
  emptyBox: { alignItems: 'center', marginTop: 48, padding: 24 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  centerBox: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 20 },
  retryBtn: { backgroundColor: '#1aa672', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  avatarMargin: { marginRight: 12 },
  balanceInfo: { flex: 1 },
  balanceName: { fontSize: 15, fontWeight: '600' },
  balanceSub: { fontSize: 12, color: '#999' },
  balanceAmount: { fontSize: 16, fontWeight: '700' },
});
