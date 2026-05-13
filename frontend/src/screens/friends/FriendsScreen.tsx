import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getFriends } from '../../services/groups';
import { getBalances } from '../../services/expenses';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [f, b] = await Promise.all([getFriends(), getBalances()]);
      setFriends(f);
      const balanceMap: Record<number, number> = {};
      b.forEach((bal: any) => { balanceMap[bal.user.id] = parseFloat(bal.amount); });
      setBalances(balanceMap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1aa672" />;

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
        ListEmptyComponent={<Text style={styles.empty}>No friends yet. Add members to a group to connect!</Text>}
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
  empty: { textAlign: 'center', color: '#999', marginTop: 40, lineHeight: 22 },
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
