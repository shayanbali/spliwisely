import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar from '../components/common/Avatar';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { getBalances } from '../services/expenses';
import { fmt } from '../utils/currency';
import { C, S, TAB_PAD } from '../theme';

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { preferredCurrency } = useCurrency();
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

  const firstName = (user?.name || user?.email || '').split(' ')[0].split('@')[0];
  const greet = `${greetingFor()}, ${firstName}!`;

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
        <Text style={styles.errorText}>Could not load balances</Text>
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

  const positiveTotal = totalBalance >= 0;
  const statusText =
    totalBalance > 0 ? 'You are owed money'
      : totalBalance < 0 ? 'You owe money'
      : 'All settled up!';

  return (
    <View style={styles.container}>
      <FlatList
        data={balances}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.greeting}>{greet}</Text>
              <Text style={styles.greetSub}>Here's your balance overview</Text>
            </View>

            <View style={styles.heroWrap}>
              <LinearGradient
                colors={[C.accent, C.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <Text style={styles.heroLabel}>
                  Total Balance · {preferredCurrency}
                </Text>
                <Text style={styles.heroAmount}>
                  {positiveTotal ? '+' : '-'}{fmt(Math.abs(totalBalance), preferredCurrency)}
                </Text>
                <Text style={styles.heroSub}>{statusText}</Text>
              </LinearGradient>
            </View>

            <Text style={styles.sectionTitle}>Balances</Text>

            {balances.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyTitle}>All settled up!</Text>
                <Text style={styles.emptySub}>
                  Add expenses in a group to see who owes what.
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const amount = parseFloat(item.amount);
          const isPositive = amount > 0;
          return (
            <View style={[styles.balanceRow, S.shadowSm]}>
              <Avatar
                name={item.user.name}
                email={item.user.email}
                avatar={item.user.avatar}
                size={44}
                style={styles.avatarMargin}
              />
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceName}>
                  {item.user.name || item.user.email}
                </Text>
                <Text style={styles.balanceSub}>
                  {isPositive ? 'owes you' : 'you owe'}
                </Text>
              </View>
              <Text
                style={[
                  styles.balanceAmount,
                  { color: isPositive ? C.positive : C.negative },
                ]}
              >
                {isPositive ? '+' : '-'}
                {fmt(Math.abs(amount), item.currency ?? preferredCurrency)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  listContent: { paddingBottom: TAB_PAD },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.bg,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: C.text,
  },
  greetSub: {
    fontSize: 15,
    color: C.textSecondary,
    marginTop: 4,
  },

  heroWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 24,
    borderRadius: 24,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  hero: {
    borderRadius: 24,
    padding: 28,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroAmount: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 20,
  },

  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
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

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgElevated,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
  },
  avatarMargin: { marginRight: 12 },
  balanceInfo: { flex: 1 },
  balanceName: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },
  balanceSub: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
