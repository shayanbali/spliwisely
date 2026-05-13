import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { createExpense } from '../../services/expenses';
import { Group } from '../../types';
import BottomModal from '../../components/common/BottomModal';

export default function AddExpenseScreen({ route, navigation }: any) {
  const { group, onDone }: { group: Group; onDone: () => void } = route.params;
  const { user } = useAuth();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [selectedIds, setSelectedIds] = useState<number[]>(group.members.map(m => m.user.id));
  const [paidById, setPaidById] = useState<number>(user!.id);
  const [exactAmounts, setExactAmounts] = useState<Record<number, string>>({});
  const [percentages, setPercentages] = useState<Record<number, string>>({});
  const [payerModalVisible, setPayerModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const paidByUser = group.members.find(m => m.user.id === paidById)?.user;
  const total = parseFloat(amount || '0');
  const selectedMembers = group.members.filter(m => selectedIds.includes(m.user.id));

  const exactTotal = selectedMembers.reduce((s, m) => s + parseFloat(exactAmounts[m.user.id] || '0'), 0);
  const pctTotal = selectedMembers.reduce((s, m) => s + parseFloat(percentages[m.user.id] || '0'), 0);

  function toggleMember(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    if (!description.trim() || !amount.trim()) {
      Alert.alert('Error', 'Please fill in description and amount.');
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert('Error', 'Select at least one participant.');
      return;
    }
    if (splitType === 'exact' && Math.abs(exactTotal - total) > 0.01) {
      Alert.alert('Error', `Exact amounts must add up to $${total.toFixed(2)}. Currently: $${exactTotal.toFixed(2)}`);
      return;
    }
    if (splitType === 'percentage' && Math.abs(pctTotal - 100) > 0.01) {
      Alert.alert('Error', `Percentages must add up to 100%. Currently: ${pctTotal.toFixed(1)}%`);
      return;
    }
    setLoading(true);
    try {
      await createExpense({
        description: description.trim(),
        amount: total,
        paid_by_id: paidById,
        group: group.id,
        split_type: splitType,
        participant_ids: selectedIds,
        ...(splitType === 'exact' && {
          exact_amounts: Object.fromEntries(
            Object.entries(exactAmounts).map(([k, v]) => [k, parseFloat(v || '0')])
          ),
        }),
        ...(splitType === 'percentage' && {
          percentages: Object.fromEntries(
            Object.entries(percentages).map(([k, v]) => [k, parseFloat(v || '0')])
          ),
        }),
      });
      onDone();
      navigation.goBack();
    } catch (e: any) {
      const msg = e.response?.data?.non_field_errors?.[0] ?? 'Could not create expense.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  function renderParticipantRow(m: Group['members'][0]) {
    const isSelected = selectedIds.includes(m.user.id);
    const displayName = m.user.id === user!.id ? 'You' : (m.user.name || m.user.email);

    return (
      <View key={m.id}>
        <View style={styles.memberRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{m.user.name?.[0] || m.user.email[0]}</Text>
          </View>
          <Text style={styles.memberName}>{displayName}</Text>
          <Switch
            value={isSelected}
            onValueChange={() => toggleMember(m.user.id)}
            trackColor={{ true: '#1aa672' }}
          />
        </View>

        {isSelected && splitType === 'exact' && (
          <View style={styles.splitInputRow}>
            <Text style={styles.splitInputLabel}>{displayName} pays</Text>
            <View style={styles.splitInputBox}>
              <Text style={styles.splitInputPrefix}>$</Text>
              <TextInput
                style={styles.splitInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={exactAmounts[m.user.id] || ''}
                onChangeText={val => setExactAmounts(prev => ({ ...prev, [m.user.id]: val }))}
              />
            </View>
          </View>
        )}

        {isSelected && splitType === 'percentage' && (
          <View style={styles.splitInputRow}>
            <Text style={styles.splitInputLabel}>{displayName}'s share</Text>
            <View style={styles.splitInputBox}>
              <TextInput
                style={styles.splitInput}
                placeholder="0"
                keyboardType="decimal-pad"
                value={percentages[m.user.id] || ''}
                onChangeText={val => setPercentages(prev => ({ ...prev, [m.user.id]: val }))}
              />
              <Text style={styles.splitInputSuffix}>%</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Expense</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#1aa672" /> : <Text style={styles.save}>Save</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} placeholder="e.g. Dinner, Uber, Groceries" value={description} onChangeText={setDescription} />
        <Text style={styles.label}>Amount ($)</Text>
        <TextInput style={styles.input} placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Paid By</Text>
        <TouchableOpacity style={styles.payerRow} onPress={() => setPayerModalVisible(true)}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{paidByUser?.name?.[0] || paidByUser?.email[0]}</Text>
          </View>
          <Text style={styles.payerName}>
            {paidById === user!.id ? 'You' : (paidByUser?.name || paidByUser?.email)}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Split Method</Text>
        <View style={styles.splitTypeRow}>
          {([
            { key: 'equal', label: 'Equal', hint: 'Split evenly' },
            { key: 'exact', label: 'Exact', hint: 'Set $ per person' },
            { key: 'percentage', label: 'Percentage', hint: 'Set % per person' },
          ] as const).map(({ key, label, hint }) => (
            <TouchableOpacity
              key={key}
              style={[styles.splitBtn, splitType === key && styles.splitBtnActive]}
              onPress={() => setSplitType(key)}
            >
              <Text style={[styles.splitBtnText, splitType === key && styles.splitBtnTextActive]}>{label}</Text>
              <Text style={[styles.splitBtnHint, splitType === key && styles.splitBtnHintActive]}>{hint}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Participants</Text>
        {group.members.map(m => renderParticipantRow(m))}

        {splitType === 'equal' && total > 0 && selectedMembers.length > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Each person pays ${(total / selectedMembers.length).toFixed(2)}</Text>
          </View>
        )}
        {splitType === 'exact' && total > 0 && (
          <View style={[styles.preview, Math.abs(exactTotal - total) > 0.01 ? styles.previewError : styles.previewOk]}>
            <Text style={[styles.previewLabel, Math.abs(exactTotal - total) > 0.01 ? styles.previewLabelError : styles.previewLabelOk]}>
              ${exactTotal.toFixed(2)} of ${total.toFixed(2)} assigned
            </Text>
          </View>
        )}
        {splitType === 'percentage' && (
          <View style={[styles.preview, Math.abs(pctTotal - 100) > 0.01 ? styles.previewError : styles.previewOk]}>
            <Text style={[styles.previewLabel, Math.abs(pctTotal - 100) > 0.01 ? styles.previewLabelError : styles.previewLabelOk]}>
              {pctTotal.toFixed(1)}% of 100% assigned
            </Text>
          </View>
        )}
      </View>

      <BottomModal visible={payerModalVisible} onClose={() => setPayerModalVisible(false)}>
        <Text style={styles.modalTitle}>Who paid?</Text>
        {group.members.map(m => (
          <TouchableOpacity
            key={m.id}
            style={styles.payerOption}
            onPress={() => { setPaidById(m.user.id); setPayerModalVisible(false); }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{m.user.name?.[0] || m.user.email[0]}</Text>
            </View>
            <Text style={styles.payerOptionName}>
              {m.user.id === user!.id ? 'You' : (m.user.name || m.user.email)}
            </Text>
            {paidById === m.user.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </BottomModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: '#fff' },
  back: { fontSize: 16, color: '#e53935' },
  title: { fontSize: 18, fontWeight: '700' },
  save: { fontSize: 16, color: '#1aa672', fontWeight: '700' },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 16 },
  label: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14 },
  payerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  payerName: { flex: 1, fontSize: 16, fontWeight: '500', marginLeft: 4 },
  chevron: { fontSize: 22, color: '#ccc' },
  splitTypeRow: { flexDirection: 'row', gap: 8 },
  splitBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 10, alignItems: 'center' },
  splitBtnActive: { borderColor: '#1aa672', backgroundColor: '#e8f5e9' },
  splitBtnText: { color: '#999', fontWeight: '600', fontSize: 13 },
  splitBtnTextActive: { color: '#1aa672' },
  splitBtnHint: { color: '#bbb', fontSize: 10, marginTop: 2 },
  splitBtnHintActive: { color: '#1aa672' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { fontWeight: '700', color: '#1aa672' },
  memberName: { flex: 1, fontSize: 15 },
  splitInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 46, paddingBottom: 10 },
  splitInputLabel: { fontSize: 13, color: '#999' },
  splitInputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90 },
  splitInputPrefix: { fontSize: 15, color: '#999', marginRight: 4 },
  splitInputSuffix: { fontSize: 15, color: '#999', marginLeft: 4 },
  splitInput: { fontSize: 15, minWidth: 60, textAlign: 'right' },
  preview: { marginTop: 12, borderRadius: 8, padding: 10, alignItems: 'center' },
  previewOk: { backgroundColor: '#e8f5e9' },
  previewError: { backgroundColor: '#fdecea' },
  previewLabel: { fontSize: 13, fontWeight: '600' },
  previewLabelOk: { color: '#1aa672' },
  previewLabelError: { color: '#e53935' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  payerOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  payerOptionName: { flex: 1, fontSize: 16, marginLeft: 4 },
  checkmark: { fontSize: 18, color: '#1aa672', fontWeight: '700' },
});
