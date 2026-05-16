import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getActivityFeed } from '../services/expenses';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/common/Avatar';
import { fmt } from '../utils/currency';
import { S, TAB_PAD, ThemeColors } from '../theme';

function timeAgo(isoString: string) {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const { converted, preferredCurrency } = useCurrency();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
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
        <Ionicons name="warning-outline" size={48} color={C.warning} style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>Could not load activity</Text>
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

  function renderExpense(item: any) {
    const currency: string = item.currency ?? 'USD';
    const total = parseFloat(item.amount);
    const totalFmt = fmt(total, currency);
    const totalConverted = converted(total, currency);

    const myShare = item.my_share ? parseFloat(item.my_share) : 0;
    const lent = item.i_paid ? total - myShare : 0;

    let shareText = '';
    let shareColor: string = C.textSecondary;
    if (item.i_paid && lent > 0.005) {
      shareText = `you lent ${fmt(lent, currency)}`;
      shareColor = C.positive;
    } else if (item.i_paid) {
      shareText = 'you paid in full';
      shareColor = C.positive;
    } else if (myShare > 0) {
      shareText = `your share ${fmt(myShare, currency)}`;
      shareColor = C.negative;
    }

    const paidByName = item.i_paid ? 'You' : (item.paid_by.name || item.paid_by.email);
    const paidByUser = item.i_paid ? user : item.paid_by;

    return (
      <View style={[styles.card, S.shadowSm]}>
        <Avatar
          name={paidByUser?.name}
          email={paidByUser?.email}
          avatar={paidByUser?.avatar}
          size={42}
          style={styles.avatarMargin}
        />
        <View style={styles.info}>
          <Text style={styles.title}>{item.description}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.sub}>{paidByName} paid </Text>
            <Text style={styles.amountMain}>{totalFmt}</Text>
            {totalConverted ? <Text style={styles.amountConverted}> {totalConverted}</Text> : null}
            {item.group ? <Text style={styles.sub}> · {item.group}</Text> : null}
          </View>
          <View style={styles.tagRow}>
            <View style={styles.badgePill}>
              <Text style={styles.badge}>{item.split_type} split</Text>
            </View>
            {shareText ? (
              <Text style={[styles.shareTag, { color: shareColor }]}>{shareText}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
    );
  }

  function renderSettlement(item: any) {
    const isPayer = item.payer.id === user?.id;
    const currency: string = item.currency ?? 'USD';
    const amount = parseFloat(item.amount);
    const amountFmt = fmt(amount, currency);
    const amountConverted = converted(amount, currency);
    const displayUser = isPayer ? user : item.payer;

    return (
      <View style={[styles.card, S.shadowSm]}>
        <View style={styles.settlementAvatarBox}>
          <Avatar
            name={displayUser?.name}
            email={displayUser?.email}
            avatar={displayUser?.avatar}
            size={42}
          />
          <View style={styles.settlementBadge}>
            <Ionicons name="checkmark" size={10} color={C.positive} />
          </View>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>Settlement</Text>
          <View style={styles.amountRow}>
            <Text style={styles.sub}>
              {isPayer ? 'You paid' : `${item.payer.name || item.payer.email} paid`}{' '}
            </Text>
            <Text style={styles.amountMain}>{amountFmt}</Text>
            {amountConverted ? <Text style={styles.amountConverted}> {amountConverted}</Text> : null}
            <Text style={styles.sub}>
              {' '}to {isPayer ? (item.receiver.name || item.receiver.email) : 'you'}
            </Text>
          </View>
          {item.group ? <Text style={styles.groupTag}>· {item.group}</Text> : null}
          {item.note ? <Text style={styles.note}>"{item.note}"</Text> : null}
        </View>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: TAB_PAD,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Activity</Text>
            <View style={styles.currencyPill}>
              <Text style={styles.currencyPillText}>{preferredCurrency}</Text>
            </View>
          </View>
        }
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
            <View style={styles.emptyIconCircle}>
              <Ionicons name="time-outline" size={36} color={C.accent} />
            </View>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySub}>
              Add an expense in a group to see your activity here.
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.type === 'expense' ? renderExpense(item) : renderSettlement(item)
        }
      />
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

    header: {
      paddingTop: 60,
      paddingHorizontal: 4,
      paddingBottom: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    headerTitle: {
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: C.text,
    },
    currencyPill: {
      backgroundColor: C.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 6,
    },
    currencyPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: C.accent,
      letterSpacing: 0.3,
    },

    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    avatarMargin: { marginRight: 12 },
    settlementAvatarBox: { position: 'relative', marginRight: 12 },
    settlementBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: C.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#fff',
    },
    info: { flex: 1 },
    title: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 2,
      color: C.text,
    },
    amountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    sub: { fontSize: 13, color: C.textSecondary },
    amountMain: { fontSize: 13, fontWeight: '700', color: C.text },
    amountConverted: { fontSize: 12, color: C.textTertiary },
    groupTag: { fontSize: 12, color: C.textTertiary, marginTop: 1 },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    badgePill: {
      backgroundColor: C.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badge: {
      fontSize: 11,
      color: C.accent,
      fontWeight: '700',
      textTransform: 'capitalize',
      letterSpacing: 0.2,
    },
    shareTag: { fontSize: 11, fontWeight: '700' },
    note: { marginTop: 4, fontSize: 12, color: C.textSecondary, fontStyle: 'italic' },
    time: { fontSize: 11, color: C.textMuted, marginLeft: 8, marginTop: 2 },

    emptyBox: { alignItems: 'center', marginTop: 60, padding: 24 },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
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
  });
}
