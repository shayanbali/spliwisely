import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getFriends } from '../../services/groups';
import { getBalances } from '../../services/expenses';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    try {
      const [f, b] = await Promise.all([getFriends(), getBalances()]);
      setFriends(f);
      const balanceMap: Record<number, number> = {};
      b.forEach((bal: any) => { balanceMap[bal.user.id] = parseFloat(bal.amount); });
      setBalances(balanceMap);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1aa672" />;

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Could not load friends</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
      </View>
      <FlatList
        data={friends}
        keyExtractor={f => f.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptySub}>Add members to a group to connect with friends.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const balance = balances[item.to_user.id] ?? 0;
          return (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.to_user.name?.[0] || item.to_user.email[0]}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.to_user.name || item.to_user.email}</Text>
                <Text style={styles.email}>{item.to_user.email}</Text>
              </View>
              {balance !== 0 && (
                <View>
                  <Text style={[styles.balance, { color: balance > 0 ? '#1aa672' : '#e53935' }]}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(2)}
                  </Text>
                  <Text style={styles.balanceSub}>{balance > 0 ? 'owes you' : 'you owe'}</Text>
                </View>
              )}
              {balance === 0 && <Text style={styles.settled}>Settled</Text>}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 20 },
  retryBtn: { backgroundColor: '#1aa672', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  emptyBox: { alignItems: 'center', marginTop: 60, padding: 24 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#1aa672' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  email: { fontSize: 12, color: '#999', marginTop: 2 },
  balance: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  balanceSub: { fontSize: 11, color: '#999', textAlign: 'right' },
  settled: { fontSize: 13, color: '#999' },
});
