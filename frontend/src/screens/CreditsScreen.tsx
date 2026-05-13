import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BackButton from '../components/common/BackButton';
import Avatar from '../components/common/Avatar';
import { getCreditTransactions, topUpDemo } from '../services/credits';
import api from '../services/api';
import { CreditTransaction } from '../types';
import { S, TAB_PAD, ThemeColors } from '../theme';

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CreditsScreen({ navigation }: any) {
  const { user, setUser } = useAuth();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  async function load() {
    try {
      const [txns, meRes] = await Promise.all([
        getCreditTransactions(),
        api.get('/auth/me/'),
      ]);
      setTransactions(txns);
      setUser(meRes.data);
    } catch {
      // silently fail on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleTopUp() {
    Alert.alert(
      'Demo Top-Up',
      'Add 100 credits to your balance? (This simulates a real payment in demo mode.)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add 100 Credits',
          onPress: async () => {
            setToppingUp(true);
            try {
              await topUpDemo();
              await load();
            } catch {
              Alert.alert('Error', 'Could not add credits.');
            } finally {
              setToppingUp(false);
            }
          },
        },
      ],
    );
  }

  const balance = parseFloat(user?.credits_balance ?? '0');

  function txIcon(type: CreditTransaction['transaction_type']) {
    if (type === 'topup') return { name: 'add-circle' as const, color: C.positive };
    if (type === 'transfer_in') return { name: 'arrow-down-circle' as const, color: C.positive };
    return { name: 'arrow-up-circle' as const, color: C.negative };
  }

  function txLabel(tx: CreditTransaction) {
    if (tx.transaction_type === 'topup') return 'Demo top-up';
    const who = tx.counterpart?.name || tx.counterpart?.email || 'Someone';
    if (tx.transaction_type === 'transfer_in') return `Received from ${who}`;
    return `Sent to ${who}`;
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={item => item.id.toString()}
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
              <BackButton onPress={() => navigation.goBack()} />
              <Text style={styles.headerTitle}>Splitwise Credits</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Balance card */}
            <LinearGradient
              colors={['#5E5CE6', '#BF5AF2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.balanceCard, S.shadowSm]}
            >
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <Text style={styles.balanceAmount}>
                {balance.toFixed(2)}
                <Text style={styles.balanceCurrency}> SC</Text>
              </Text>
              <Text style={styles.balanceSub}>Splitwise Credits · use to settle debts instantly</Text>

              <TouchableOpacity
                style={styles.topUpBtn}
                onPress={handleTopUp}
                disabled={toppingUp}
                activeOpacity={0.85}
              >
                {toppingUp
                  ? <ActivityIndicator color="#5E5CE6" size="small" />
                  : (
                    <>
                      <Ionicons name="add" size={16} color="#5E5CE6" />
                      <Text style={styles.topUpBtnText}>Add Credits (Demo)</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </LinearGradient>

            {/* How it works */}
            <View style={[styles.infoCard, S.shadowSm]}>
              <Text style={styles.infoTitle}>How Credits Work</Text>
              {[
                { icon: 'wallet-outline', text: 'Top up your balance with credits' },
                { icon: 'flash-outline', text: 'Settle debts instantly — no bank transfer needed' },
                { icon: 'swap-horizontal-outline', text: 'Credits move between users in real-time' },
              ].map((item, i) => (
                <View key={i} style={styles.infoRow}>
                  <Ionicons name={item.icon as any} size={18} color={C.accent} />
                  <Text style={styles.infoText}>{item.text}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Transaction History</Text>

            {transactions.length === 0 && (
              <View style={styles.emptyBox}>
                <Ionicons name="receipt-outline" size={40} color={C.textMuted} />
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySub}>Top up your balance or settle a debt with credits.</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const icon = txIcon(item.transaction_type);
          const isIncoming = item.transaction_type === 'transfer_in' || item.transaction_type === 'topup';
          return (
            <View style={[styles.txRow, S.shadowSm]}>
              {item.counterpart ? (
                <Avatar
                  name={item.counterpart.name}
                  email={item.counterpart.email}
                  avatar={item.counterpart.avatar}
                  size={42}
                  style={{ marginRight: 12 }}
                />
              ) : (
                <View style={[styles.txIconWrap, { marginRight: 12 }]}>
                  <Ionicons name={icon.name} size={24} color={icon.color} />
                </View>
              )}
              <View style={styles.txInfo}>
                <Text style={styles.txLabel}>{txLabel(item)}</Text>
                {item.note ? (
                  <Text style={styles.txNote} numberOfLines={1}>{item.note}</Text>
                ) : (
                  <Text style={styles.txNote}>{formatDate(item.created_at)}</Text>
                )}
              </View>
              <Text style={[styles.txAmount, { color: isIncoming ? C.positive : C.negative }]}>
                {isIncoming ? '+' : '-'}{parseFloat(item.amount).toFixed(2)} SC
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingBottom: 40 },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 14,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },

    balanceCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 24,
      padding: 24,
    },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 6 },
    balanceAmount: { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -1 },
    balanceCurrency: { fontSize: 20, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
    balanceSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, marginBottom: 20 },

    topUpBtn: {
      backgroundColor: '#fff',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
    },
    topUpBtnText: { color: '#5E5CE6', fontWeight: '700', fontSize: 14 },

    infoCard: {
      marginHorizontal: 16,
      marginBottom: 24,
      backgroundColor: C.bgElevated,
      borderRadius: 18,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    infoTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    infoText: { fontSize: 14, color: C.textSecondary, flex: 1 },

    sectionTitle: {
      fontSize: 13, fontWeight: '600', color: C.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginLeft: 20, marginBottom: 8,
    },

    emptyBox: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 32, gap: 8 },
    emptyText: { fontSize: 17, fontWeight: '600', color: C.text },
    emptySub: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.bgElevated,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    txIconWrap: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: C.accentSoft,
      justifyContent: 'center', alignItems: 'center',
    },
    txInfo: { flex: 1 },
    txLabel: { fontSize: 15, fontWeight: '600', color: C.text },
    txNote: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    txAmount: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  });
}
