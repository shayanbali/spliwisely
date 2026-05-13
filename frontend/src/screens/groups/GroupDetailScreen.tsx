import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroup, addMember } from '../../services/groups';
import { useAuth } from '../../context/AuthContext';
import { getExpenses, getSimplifiedBalances, deleteExpense } from '../../services/expenses';
import { Group, Expense } from '../../types';
import BottomModal from '../../components/common/BottomModal';
import Avatar from '../../components/common/Avatar';
import { useCurrency } from '../../context/CurrencyContext';
import { fmt } from '../../utils/currency';
import { C, S, TAB_PAD } from '../../theme';

export default function GroupDetailScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const { group: initialGroup } = route.params;
  const [group, setGroup] = useState<Group>(initialGroup);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [simplified, setSimplified] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const { converted } = useCurrency();

  async function load() {
    setError(false);
    try {
      const [g, e, s] = await Promise.all([
        getGroup(initialGroup.id),
        getExpenses(initialGroup.id),
        getSimplifiedBalances(initialGroup.id),
      ]);
      setGroup(g);
      setExpenses(e);
      setSimplified(s);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleAddMember() {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await addMember(group.id, email.trim().toLowerCase());
      setEmail('');
      setAddModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.email?.[0] || 'Could not add member.');
    } finally {
      setAdding(false);
    }
  }

  function handleExpenseActions(item: any) {
    Alert.alert(
      item.description,
      'What would you like to do?',
      [
        {
          text: 'Edit',
          onPress: () => navigation.navigate('EditExpense', { group, expense: item, onDone: load }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(item.id, item.description),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function confirmDelete(id: number, description: string) {
    Alert.alert(
      'Delete Expense',
      `Delete "${description}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(id);
              load();
            } catch {
              Alert.alert('Error', 'Could not delete expense.');
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{initialGroup.name}</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Could not load group</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setLoading(true); load(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{group.name}</Text>
          <View style={styles.curBadge}>
            <Text style={styles.curBadgeText}>{group.currency}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setAddModal(true)} hitSlop={10}>
          <Text style={styles.addMemberBtn}>+ Member</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
        ListHeaderComponent={() => (
          <>
            {simplified.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Suggested Settlements</Text>
                <View style={[styles.card, S.shadowSm]}>
                  {simplified.map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.settlementRow,
                        i < simplified.length - 1 && styles.settlementBorder,
                      ]}
                      onPress={() => navigation.navigate('SettleUp', { transaction: t, groupId: group.id, onDone: load })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.settlementLeft}>
                        <Avatar
                          name={t.from.name}
                          email={t.from.email}
                          avatar={t.from.avatar}
                          size={32}
                        />
                        <Text style={styles.settlementArrow}>→</Text>
                        <Avatar
                          name={t.to.name}
                          email={t.to.email}
                          avatar={t.to.avatar}
                          size={32}
                        />
                        <View style={styles.settlementNames}>
                          <Text style={styles.settlementText} numberOfLines={1}>
                            {t.from.name || t.from.email}
                            <Text style={styles.settlementTextMuted}> pays </Text>
                            {t.to.name || t.to.email}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.settlementAmount}>
                        {fmt(parseFloat(t.amount), t.currency ?? 'USD')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Members</Text>
              <View style={[styles.card, S.shadowSm]}>
                {group.members.map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      styles.memberRow,
                      i < group.members.length - 1 && styles.memberBorder,
                    ]}
                  >
                    <Avatar
                      name={m.user.name}
                      email={m.user.email}
                      avatar={m.user.avatar}
                      size={40}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={styles.memberName}>{m.user.name || m.user.email}</Text>
                    <View style={styles.rolePill}>
                      <Text style={styles.roleText}>{m.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.expensesHeader}>
              <Text style={styles.sectionLabel}>Expenses</Text>
              <TouchableOpacity
                style={styles.addExpenseBtn}
                onPress={() => navigation.navigate('AddExpense', { group, onDone: load })}
                activeOpacity={0.85}
              >
                <Text style={styles.addExpenseBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        data={expenses}
        keyExtractor={e => e.id.toString()}
        contentContainerStyle={{ paddingBottom: TAB_PAD }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptySub}>Tap "+ Add" to record your first expense.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const myId = user?.id;
          const mySplit = item.splits?.find((s: any) => s.user.id === myId);
          const myShare = mySplit ? parseFloat(mySplit.amount) : 0;
          const iPaid = item.paid_by.id === myId;
          const paidByName = iPaid ? 'You' : (item.paid_by.name || item.paid_by.email);
          const expCurrency: string = item.currency ?? group.currency ?? 'USD';
          const total = parseFloat(item.amount);

          let shareLabel = '';
          let shareColor = C.textSecondary;
          if (iPaid && myShare > 0) {
            const lent = total - myShare;
            shareLabel = lent > 0.005 ? `you lent ${fmt(lent, expCurrency)}` : 'you paid in full';
            shareColor = C.positive;
          } else if (iPaid) {
            shareLabel = 'you paid in full';
            shareColor = C.positive;
          } else if (myShare > 0) {
            shareLabel = `you owe ${fmt(myShare, expCurrency)}`;
            shareColor = C.negative;
          }

          const convStr = converted(total, expCurrency);

          return (
            <TouchableOpacity
              style={[styles.expenseRow, S.shadowSm]}
              onLongPress={() => handleExpenseActions(item)}
              delayLongPress={400}
              activeOpacity={0.8}
            >
              <View style={styles.expenseIcon}>
                <Text style={styles.expenseIconText}>{expCurrency[0]}</Text>
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc}>{item.description}</Text>
                <Text style={styles.expenseSub}>
                  Paid by {paidByName} · {fmt(total, expCurrency)}{convStr ? ` (${convStr})` : ''}
                </Text>
                {shareLabel ? (
                  <Text style={[styles.expenseShare, { color: shareColor }]}>{shareLabel}</Text>
                ) : null}
              </View>
              <Text style={styles.deleteHint}>⋮</Text>
            </TouchableOpacity>
          );
        }}
      />

      <BottomModal visible={addModal} onClose={() => setAddModal(false)}>
        <Text style={styles.modalTitle}>Add Member</Text>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={C.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
        />
        <TouchableOpacity
          style={styles.modalBtn}
          onPress={handleAddMember}
          disabled={adding}
          activeOpacity={0.85}
        >
          {adding
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.modalBtnText}>Add Member</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAddModal(false)} style={styles.cancelWrap}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </BottomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: C.bg,
  },
  headerCenter: { alignItems: 'center', gap: 4 },
  back: { fontSize: 17, color: C.accent, fontWeight: '500', width: 80 },
  title: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  curBadge: {
    backgroundColor: C.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  curBadgeText: { fontSize: 11, color: C.accent, fontWeight: '700', letterSpacing: 0.2 },
  addMemberBtn: { fontSize: 14, color: C.accent, fontWeight: '600', width: 80, textAlign: 'right' },

  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: C.bgElevated,
    borderRadius: 20,
    overflow: 'hidden',
  },

  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settlementBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  settlementLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  settlementArrow: { fontSize: 14, color: C.textSecondary },
  settlementNames: { flex: 1, marginLeft: 4 },
  settlementText: { fontSize: 13, fontWeight: '600', color: C.text },
  settlementTextMuted: { fontWeight: '400', color: C.textSecondary },
  settlementAmount: { fontSize: 14, fontWeight: '700', color: C.accent },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  memberName: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  rolePill: {
    backgroundColor: C.inputFill,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleText: { fontSize: 11, color: C.textSecondary, fontWeight: '600', textTransform: 'capitalize' },

  expensesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  addExpenseBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  addExpenseBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgElevated,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,159,10,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseIconText: { fontSize: 16, fontWeight: '800', color: '#FF9F0A' },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 15, fontWeight: '700', color: C.text },
  expenseSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  expenseShare: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  deleteHint: { fontSize: 20, color: C.textMuted, paddingLeft: 8 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.textSecondary, textAlign: 'center', lineHeight: 18 },

  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 20 },
  retryBtn: { backgroundColor: C.accent, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: C.text,
    letterSpacing: -0.3,
  },
  input: {
    backgroundColor: C.inputFill,
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 14,
    color: C.text,
  },
  modalBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelWrap: { paddingVertical: 8 },
  cancel: { textAlign: 'center', color: C.textSecondary, fontSize: 15, fontWeight: '600' },
});
