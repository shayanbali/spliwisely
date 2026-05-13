import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroups, createGroup } from '../../services/groups';
import { getGroupBalances } from '../../services/expenses';
import { Group } from '../../types';
import BottomModal from '../../components/common/BottomModal';
import { CURRENCIES } from '../../utils/currency';
import { C, S, TAB_PAD } from '../../theme';

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
        <Text style={styles.errorText}>Could not load groups</Text>
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
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.id.toString()}
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
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySub}>
              Create a group to start splitting expenses with friends.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Create a Group</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const balance = balances[item.id] ?? 0;
          const settled = Math.abs(balance) < 0.01;
          const isPositive = balance > 0;

          return (
            <TouchableOpacity
              style={[styles.card, S.shadowSm]}
              onPress={() => navigation.navigate('GroupDetail', { group: item })}
              activeOpacity={0.8}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>
                  {item.name[0].toUpperCase()}
                </Text>
              </View>

              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <View style={styles.cardSubRow}>
                  <Text style={styles.cardSub}>{item.member_count} members</Text>
                  <View style={styles.curBadge}>
                    <Text style={styles.curBadgeText}>{item.currency}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.balanceBox}>
                {settled ? (
                  <View style={styles.settledPill}>
                    <Text style={styles.settledText}>Settled</Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.balancePill,
                      isPositive ? styles.balancePillPos : styles.balancePillNeg,
                    ]}
                  >
                    <Text
                      style={[
                        styles.balanceAmount,
                        { color: isPositive ? C.positive : C.negative },
                      ]}
                    >
                      {isPositive ? '+' : ''}{balance.toFixed(2)}
                    </Text>
                  </View>
                )}
                <Text style={styles.balanceLabel}>
                  {settled ? '' : isPositive ? 'owed to you' : 'you owe'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <BottomModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <Text style={styles.modalTitle}>New Group</Text>
        <TextInput
          style={styles.input}
          placeholder="Group name"
          placeholderTextColor={C.placeholder}
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <Text style={styles.currencyLabel}>Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
              onPress={() => setCurrency(c)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.currencyChipText,
                  currency === c && styles.currencyChipTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.85}
        >
          {creating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.createBtnText}>Create</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setModalVisible(false)}
          style={styles.cancelWrap}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </BottomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  listContent: { padding: 16, paddingBottom: TAB_PAD },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addBtn: {
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgElevated,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardIconText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '700', color: C.text },
  cardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  cardSub: { fontSize: 13, color: C.textSecondary },
  curBadge: {
    backgroundColor: 'rgba(48,209,88,0.12)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  curBadgeText: {
    fontSize: 11,
    color: C.accent,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  balanceBox: { alignItems: 'flex-end' },
  balancePill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  balancePillPos: { backgroundColor: 'rgba(48,209,88,0.12)' },
  balancePillNeg: { backgroundColor: 'rgba(255,59,48,0.12)' },
  balanceAmount: { fontSize: 15, fontWeight: '700' },
  balanceLabel: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 4,
  },
  settledPill: {
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  settledText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },

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
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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
  currencyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  currencyChip: {
    borderWidth: 0,
    backgroundColor: C.inputFill,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  currencyChipActive: {
    backgroundColor: C.accent,
  },
  currencyChipText: { fontSize: 13, color: C.text, fontWeight: '700' },
  currencyChipTextActive: { color: '#fff' },
  createBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelWrap: { paddingVertical: 8 },
  cancel: { textAlign: 'center', color: C.textSecondary, fontSize: 15, fontWeight: '600' },
});
