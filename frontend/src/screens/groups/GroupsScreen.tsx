import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroups, createGroup } from '../../services/groups';
import { getGroupBalances } from '../../services/expenses';
import { Group } from '../../types';
import BottomModal from '../../components/common/BottomModal';

export default function GroupsScreen({ navigation }: any) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [data, bal] = await Promise.all([getGroups(), getGroupBalances()]);
      setGroups(data);
      const map: Record<number, number> = {};
      bal.forEach((b: any) => { map[b.group_id] = parseFloat(b.balance); });
      setBalances(map);
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
      await createGroup(name.trim());
      setName('');
      setModalVisible(false);
      load();
    } catch {
      Alert.alert('Error', 'Could not create group.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1aa672" />;

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
        ListEmptyComponent={<Text style={styles.empty}>No groups yet. Create one!</Text>}
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
                <Text style={styles.cardSub}>{item.member_count} members</Text>
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
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
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
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14 },
  createBtn: { backgroundColor: '#1aa672', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10 },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancel: { textAlign: 'center', color: '#999', fontSize: 15 },
});
