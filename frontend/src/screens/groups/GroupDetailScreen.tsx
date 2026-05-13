import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroup, addMember } from '../../services/groups';
import { useAuth } from '../../context/AuthContext';
import { getExpenses, getSimplifiedBalances, deleteExpense } from '../../services/expenses';
import { Group, Expense } from '../../types';
import BottomModal from '../../components/common/BottomModal';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', IRR: '﷼',
};

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

  const symbol = CURRENCY_SYMBOLS[group.currency] ?? group.currency;

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

  function handleDeleteExpense(id: number, description: string) {
    Alert.alert(
      'Delete Expense',
      `Delete "${description}"?`,
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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1aa672" />;

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{initialGroup.name}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Could not load group</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.headerSub}>{group.currency}</Text>
        </View>
        <TouchableOpacity onPress={() => setAddModal(true)}>
          <Text style={styles.addBtn}>+ Member</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={() => (
          <>
            {simplified.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Suggested Settlements</Text>
                {simplified.map((t, i) => (
                  <TouchableOpacity key={i} style={styles.settlementRow}
                    onPress={() => navigation.navigate('SettleUp', { transaction: t, groupId: group.id, onDone: load })}>
                    <Text style={styles.settlementText}>
                      <Text style={{ fontWeight: '700' }}>{t.from.name || t.from.email}</Text>
                      {' → '}
                      <Text style={{ fontWeight: '700' }}>{t.to.name || t.to.email}</Text>
                    </Text>
                    <Text style={styles.settlementAmount}>{symbol}{parseFloat(t.amount).toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members</Text>
              {group.members.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{m.user.name?.[0] || m.user.email[0]}</Text>
                  </View>
                  <Text style={styles.memberName}>{m.user.name || m.user.email}</Text>
                  <Text style={styles.memberRole}>{m.role}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.expenseHeader}>
                <Text style={styles.sectionTitle}>Expenses</Text>
                <TouchableOpacity style={styles.addExpenseBtn}
                  onPress={() => navigation.navigate('AddExpense', { group, onDone: load })}>
                  <Text style={styles.addExpenseBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        data={expenses}
        keyExtractor={e => e.id.toString()}
        contentContainerStyle={{ paddingBottom: 40 }}
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

          let shareLabel = '';
          let shareColor = '#999';
          if (iPaid && myShare > 0) {
            const lent = parseFloat(item.amount) - myShare;
            shareLabel = lent > 0 ? `you lent ${symbol}${lent.toFixed(2)}` : 'you paid in full';
            shareColor = '#1aa672';
          } else if (iPaid) {
            shareLabel = 'you paid in full';
            shareColor = '#1aa672';
          } else if (myShare > 0) {
            shareLabel = `you owe ${symbol}${myShare.toFixed(2)}`;
            shareColor = '#e53935';
          }

          return (
            <TouchableOpacity
              style={styles.expenseRow}
              onLongPress={() => handleDeleteExpense(item.id, item.description)}
              delayLongPress={400}
            >
              <View style={styles.expenseIcon}>
                <Text style={styles.expenseIconText}>{symbol}</Text>
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc}>{item.description}</Text>
                <Text style={styles.expenseSub}>
                  Paid by {paidByName} · total {symbol}{parseFloat(item.amount).toFixed(2)}
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
        <TextInput style={styles.input} placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoFocus />
        <TouchableOpacity style={styles.modalBtn} onPress={handleAddMember} disabled={adding}>
          {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Add</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAddModal(false)}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </BottomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: '#fff' },
  back: { fontSize: 17, color: '#1aa672' },
  headerCenter: { alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, color: '#999', marginTop: 2 },
  addBtn: { fontSize: 14, color: '#1aa672', fontWeight: '600' },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  settlementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  settlementText: { fontSize: 14, color: '#333' },
  settlementAmount: { fontSize: 14, fontWeight: '700', color: '#1aa672' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { fontWeight: '700', color: '#1aa672' },
  memberName: { flex: 1, fontSize: 15 },
  memberRole: { fontSize: 12, color: '#999', textTransform: 'capitalize' },
  expenseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addExpenseBtn: { backgroundColor: '#1aa672', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  addExpenseBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 20 },
  retryBtn: { backgroundColor: '#1aa672', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#999', textAlign: 'center' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  expenseIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff9e6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  expenseIconText: { fontSize: 15, fontWeight: '700', color: '#f5a623' },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 15, fontWeight: '600' },
  expenseSub: { fontSize: 12, color: '#999', marginTop: 2 },
  expenseShare: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  deleteHint: { fontSize: 20, color: '#ccc', paddingLeft: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14 },
  modalBtn: { backgroundColor: '#1aa672', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10 },
  modalBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancel: { textAlign: 'center', color: '#999', fontSize: 15 },
});
