import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroups, createGroup } from '../../services/groups';
import { getGroupBalances } from '../../services/expenses';
import { Group } from '../../types';
import BottomModal from '../../components/common/BottomModal';
import { CURRENCIES } from '../../utils/currency';

export default function GroupsScreen({ navigation }: any) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [creating, setCreating] = useState(false);

  async function load() {
    setError(false);
    try {
      const [data, bal] = await Promise.all([getGroups(), getGroupBalances()]);
      setGroups(data);
      const map: Record<number, number> = {};
      bal.forEach((b: any) => { map[b.group_id] = parseFloat(b.balance); });
      setBalances(map);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createGroup(name.trim(), currency);
      setName('');
      setCurrency('USD');
      setModalVisible(false);
      load();
    } catch {
      Alert.alert('Error', 'Could not create group.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1aa672" />;

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Could not load groups</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySub}>Create a group to start splitting expenses with friends.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyBtnText}>Create a Group</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const balance = balances[item.id] ?? 0;
          const settled = Math.abs(balance) < 0.01;
          const isPositive = balance > 0;

          return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('GroupDetail', { group: item })}>
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>{item.name[0].toUpperCase()}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSub}>{item.member_count} members · {item.currency}</Text>
              </View>
              <View style={styles.balanceBox}>
                {settled ? (
                  <Text style={styles.settled}>Settled</Text>
                ) : (
                  <>
                    <Text style={[styles.balanceAmount, { color: isPositive ? '#1aa672' : '#e53935' }]}>
                      {isPositive ? '+' : ''}{balance.toFixed(2)}
                    </Text>
                    <Text style={styles.balanceLabel}>{isPositive ? 'owed to you' : 'you owe'}</Text>
                  </>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
      />

      <BottomModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <Text style={styles.modalTitle}>New Group</Text>
        <TextInput style={styles.input} placeholder="Group name" value={name} onChangeText={setName} autoFocus />
        <Text style={styles.currencyLabel}>Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
              onPress={() => setCurrency(c)}
            >
              <Text style={[styles.currencyChipText, currency === c && styles.currencyChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating}>
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setModalVisible(false)}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </BottomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800' },
  addBtn: { backgroundColor: '#1aa672', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardIconText: { fontSize: 20, fontWeight: '700', color: '#1aa672' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 13, color: '#999', marginTop: 2 },
  balanceBox: { alignItems: 'flex-end', marginRight: 8 },
  balanceAmount: { fontSize: 15, fontWeight: '700' },
  balanceLabel: { fontSize: 11, color: '#999', marginTop: 1 },
  settled: { fontSize: 13, color: '#999' },
  chevron: { fontSize: 22, color: '#ccc' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 20 },
  retryBtn: { backgroundColor: '#1aa672', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  emptyBox: { alignItems: 'center', marginTop: 60, padding: 24 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#1aa672', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14 },
  currencyLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  currencyChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  currencyChipActive: { backgroundColor: '#1aa672', borderColor: '#1aa672' },
  currencyChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  currencyChipTextActive: { color: '#fff' },
  createBtn: { backgroundColor: '#1aa672', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10 },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancel: { textAlign: 'center', color: '#999', fontSize: 15 },
});
