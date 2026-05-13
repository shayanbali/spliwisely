import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import Avatar from '../../components/common/Avatar';
import { useFocusEffect } from '@react-navigation/native';
import { getFriends } from '../../services/groups';
import { getBalances } from '../../services/expenses';
import { useCurrency } from '../../context/CurrencyContext';
import { fmt } from '../../utils/currency';
import { C, S, TAB_PAD } from '../../theme';

export default function FriendsScreen() {
  const { preferredCurrency } = useCurrency();
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Could not load friends</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); load(); }}
          activeOpacity={0.85}
        >
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
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptySub}>
              Add members to a group to connect with friends.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const balance = balances[item.to_user.id] ?? 0;
          const settled = Math.abs(balance) < 0.01;
          const isPositive = balance > 0;
          return (
            <View style={[styles.card, S.shadowSm]}>
              <Avatar
                name={item.to_user.name}
                email={item.to_user.email}
                avatar={item.to_user.avatar}
                size={48}
                style={styles.avatarMargin}
              />
              <View style={styles.info}>
                <Text style={styles.name}>
                  {item.to_user.name || item.to_user.email}
                </Text>
                <Text style={styles.email}>{item.to_user.email}</Text>
              </View>
              {settled ? (
                <View style={styles.settledPill}>
                  <Text style={styles.settledText}>Settled</Text>
                </View>
              ) : (
                <View style={styles.balanceCol}>
                  <Text
                    style={[
                      styles.balance,
                      { color: isPositive ? C.positive : C.negative },
                    ]}
                  >
                    {isPositive ? '+' : '-'}{fmt(Math.abs(balance), preferredCurrency)}
                  </Text>
                  <Text style={styles.balanceSub}>
                    {isPositive ? 'owes you' : 'you owe'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  listContent: { padding: 16, paddingBottom: TAB_PAD },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.bg,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: C.text,
  },

  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: {
    fontSize: 17,
    fontWeight: '600',
    color: C.text,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  emptyBox: { alignItems: 'center', marginTop: 60, padding: 24 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: C.text,
  },
  emptySub: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgElevated,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  avatarMargin: { marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: C.text },
  email: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  balanceCol: { alignItems: 'flex-end' },
  balance: { fontSize: 16, fontWeight: '700' },
  balanceSub: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  settledPill: {
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  settledText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
});
