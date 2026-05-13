import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getActivityFeed } from '../services/expenses';
import { useAuth } from '../context/AuthContext';

function timeAgo(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    try {
      const data = await getActivityFeed();
      setItems(data);
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 20 }}>Could not load activity</Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1aa672', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 }}
          onPress={() => { setLoading(true); load(); }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderExpense(item: any) {
    const myShare = item.my_share ? parseFloat(item.my_share) : 0;
    const total = parseFloat(item.amount);
    const lent = item.i_paid ? total - myShare : 0;

    let shareText = '';
    let shareColor = '#999';
    if (item.i_paid && lent > 0) {
      shareText = `you lent $${lent.toFixed(2)}`;
      shareColor = '#1aa672';
    } else if (item.i_paid) {
      shareText = 'you paid in full';
      shareColor = '#1aa672';
    } else if (myShare > 0) {
      shareText = `your share $${myShare.toFixed(2)}`;
      shareColor = '#e53935';
    }

    const paidByName = item.i_paid ? 'You' : (item.paid_by.name || item.paid_by.email);

    return (
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: '#fff9e6' }]}>
          <Text style={styles.icon}>💸</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>{item.description}</Text>
          <Text style={styles.sub}>
            {paidByName} paid{' '}
            <Text style={styles.amount}>${total.toFixed(2)}</Text>
            {item.group ? ` · ${item.group}` : ''}
          </Text>
          <View style={styles.tagRow}>
            <Text style={styles.badge}>{item.split_type} split</Text>
            {shareText ? <Text style={[styles.shareTag, { color: shareColor }]}>{shareText}</Text> : null}
          </View>
        </View>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
    );
  }

  function renderSettlement(item: any) {
    const isPayer = item.payer.id === user?.id;
    return (
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: '#e8f5e9' }]}>
          <Text style={styles.icon}>✅</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>Settlement</Text>
          <Text style={styles.sub}>
            {isPayer ? 'You paid' : `${item.payer.name || item.payer.email} paid`}
            {' '}
            <Text style={styles.amount}>${parseFloat(item.amount).toFixed(2)}</Text>
            {' to '}
            {isPayer ? (item.receiver.name || item.receiver.email) : 'you'}
            {item.group ? ` · ${item.group}` : ''}
          </Text>
          {item.note ? <Text style={styles.note}>"{item.note}"</Text> : null}
        </View>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60, padding: 24 }}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>🕐</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 6 }}>No activity yet</Text>
            <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 }}>
              Add an expense in a group to see your activity here.
            </Text>
          </View>
        }
        renderItem={({ item }) => item.type === 'expense' ? renderExpense(item) : renderSettlement(item)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, lineHeight: 22 },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  iconBox: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sub: { fontSize: 13, color: '#555', lineHeight: 18 },
  amount: { fontWeight: '700', color: '#333' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: { fontSize: 11, color: '#1aa672', fontWeight: '600', textTransform: 'capitalize' },
  shareTag: { fontSize: 11, fontWeight: '700' },
  note: { marginTop: 4, fontSize: 12, color: '#999', fontStyle: 'italic' },
  time: { fontSize: 11, color: '#bbb', marginLeft: 8, marginTop: 2 },
});
