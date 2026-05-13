import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { updateExpense } from '../../services/expenses';
import { Group, Expense } from '../../types';
import BottomModal from '../../components/common/BottomModal';
import Avatar from '../../components/common/Avatar';
import { CURRENCIES, symbolOf } from '../../utils/currency';
import { C, S } from '../../theme';

export default function EditExpenseScreen({ route, navigation }: any) {
  const { group, expense, onDone }: { group: Group; expense: Expense; onDone: () => void } = route.params;
  const { user } = useAuth();

  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(parseFloat(expense.amount).toString());
  const [currency, setCurrency] = useState(expense.currency ?? group.currency ?? 'USD');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>(expense.split_type);
  const [paidById, setPaidById] = useState<number>(expense.paid_by.id);

  // Pre-populate participant IDs from existing splits
  const [selectedIds, setSelectedIds] = useState<number[]>(
    expense.splits?.map((s: any) => s.user.id) ?? group.members.map(m => m.user.id),
  );

  // Pre-populate exact amounts
  const [exactAmounts, setExactAmounts] = useState<Record<number, string>>(() => {
    if (expense.split_type !== 'exact') return {};
    return Object.fromEntries(
      (expense.splits ?? []).map((s: any) => [s.user.id, parseFloat(s.amount).toString()]),
    );
  });

  // Pre-populate percentages (back-calculate from split amounts / total)
  const [percentages, setPercentages] = useState<Record<number, string>>(() => {
    if (expense.split_type !== 'percentage') return {};
    const total = parseFloat(expense.amount);
    if (!total) return {};
    return Object.fromEntries(
      (expense.splits ?? []).map((s: any) => [
        s.user.id,
        ((parseFloat(s.amount) / total) * 100).toFixed(2),
      ]),
    );
  });

  const [payerModalVisible, setPayerModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const paidByUser = group.members.find(m => m.user.id === paidById)?.user;
  const total = parseFloat(amount || '0');
  const selectedMembers = group.members.filter(m => selectedIds.includes(m.user.id));
  const sym = symbolOf(currency);

  const exactTotal = selectedMembers.reduce(
    (s, m) => s + parseFloat(exactAmounts[m.user.id] || '0'), 0,
  );
  const pctTotal = selectedMembers.reduce(
    (s, m) => s + parseFloat(percentages[m.user.id] || '0'), 0,
  );

  function toggleMember(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    if (!description.trim() || !amount.trim()) {
      Alert.alert('Error', 'Please fill in description and amount.');
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert('Error', 'Select at least one participant.');
      return;
    }
    if (splitType === 'exact' && Math.abs(exactTotal - total) > 0.01) {
      Alert.alert('Error', `Exact amounts must add up to ${sym}${total.toFixed(2)}. Currently: ${sym}${exactTotal.toFixed(2)}`);
      return;
    }
    if (splitType === 'percentage' && Math.abs(pctTotal - 100) > 0.01) {
      Alert.alert('Error', `Percentages must add up to 100%. Currently: ${pctTotal.toFixed(1)}%`);
      return;
    }
    setLoading(true);
    try {
      await updateExpense(expense.id, {
        description: description.trim(),
        amount: total,
        currency,
        paid_by_id: paidById,
        split_type: splitType,
        participant_ids: selectedIds,
        ...(splitType === 'exact' && {
          exact_amounts: Object.fromEntries(
            Object.entries(exactAmounts).map(([k, v]) => [k, parseFloat(v || '0')]),
          ),
        }),
        ...(splitType === 'percentage' && {
          percentages: Object.fromEntries(
            Object.entries(percentages).map(([k, v]) => [k, parseFloat(v || '0')]),
          ),
        }),
      });
      onDone();
      navigation.goBack();
    } catch (e: any) {
      const msg = e.response?.data?.non_field_errors?.[0] ?? 'Could not update expense.';
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
          <Avatar
            name={m.user.name}
            email={m.user.email}
            avatar={m.user.avatar}
            size={36}
            style={styles.avatarGap}
          />
          <Text style={styles.memberName}>{displayName}</Text>
          <Switch
            value={isSelected}
            onValueChange={() => toggleMember(m.user.id)}
            trackColor={{ true: C.accent, false: '#E5E5EA' }}
            thumbColor="#fff"
            ios_backgroundColor="#E5E5EA"
          />
        </View>

        {isSelected && splitType === 'exact' && (
          <View style={styles.splitInputRow}>
            <Text style={styles.splitInputLabel}>{displayName} pays</Text>
            <View style={styles.splitInputBox}>
              <Text style={styles.splitInputPrefix}>{sym}</Text>
              <TextInput
                style={styles.splitInput}
                placeholder="0.00"
                placeholderTextColor={C.placeholder}
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
                placeholderTextColor={C.placeholder}
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Expense</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} hitSlop={10}>
          {loading
            ? <ActivityIndicator color={C.accent} />
            : <Text style={styles.save}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Description + Amount */}
        <View style={[styles.section, S.shadowSm]}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Dinner, Uber, Groceries"
            placeholderTextColor={C.placeholder}
            value={description}
            onChangeText={setDescription}
          />
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountRow}>
            <TouchableOpacity
              style={styles.currencyBtn}
              onPress={() => setCurrencyModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.currencyBtnText}>{currency}</Text>
              <Text style={styles.currencyChevron}>▾</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={C.placeholder}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Paid by */}
        <View style={[styles.section, S.shadowSm]}>
          <Text style={styles.label}>Paid By</Text>
          <TouchableOpacity
            style={styles.payerRow}
            onPress={() => setPayerModalVisible(true)}
            activeOpacity={0.7}
          >
            <Avatar
              name={paidByUser?.name}
              email={paidByUser?.email}
              avatar={paidByUser?.avatar}
              size={36}
              style={styles.avatarGap}
            />
            <Text style={styles.payerName}>
              {paidById === user!.id ? 'You' : (paidByUser?.name || paidByUser?.email)}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Split method */}
        <View style={[styles.section, S.shadowSm]}>
          <Text style={styles.label}>Split Method</Text>
          <View style={styles.splitTypeRow}>
            {([
              { key: 'equal', label: 'Equal', hint: 'Split evenly' },
              { key: 'exact', label: 'Exact', hint: `Set ${sym}` },
              { key: 'percentage', label: 'Percent', hint: 'Set %' },
            ] as const).map(({ key, label, hint }) => {
              const active = splitType === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.splitBtn, active && styles.splitBtnActive]}
                  onPress={() => setSplitType(key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.splitBtnText, active && styles.splitBtnTextActive]}>
                    {label}
                  </Text>
                  <Text style={[styles.splitBtnHint, active && styles.splitBtnHintActive]}>
                    {hint}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Participants */}
        <View style={[styles.section, S.shadowSm]}>
          <Text style={styles.label}>Participants</Text>
          {group.members.map(m => renderParticipantRow(m))}

          {splitType === 'equal' && total > 0 && selectedMembers.length > 0 && (
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>
                Each person pays {sym}{(total / selectedMembers.length).toFixed(2)}
              </Text>
            </View>
          )}
          {splitType === 'exact' && total > 0 && (
            <View style={[styles.preview, Math.abs(exactTotal - total) > 0.01 ? styles.previewError : styles.previewOk]}>
              <Text style={[styles.previewLabel, Math.abs(exactTotal - total) > 0.01 ? styles.previewLabelError : styles.previewLabelOk]}>
                {sym}{exactTotal.toFixed(2)} of {sym}{total.toFixed(2)} assigned
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
      </ScrollView>

      {/* Currency picker modal */}
      <BottomModal visible={currencyModalVisible} onClose={() => setCurrencyModalVisible(false)}>
        <Text style={styles.modalTitle}>Select Currency</Text>
        {CURRENCIES.map(c => (
          <TouchableOpacity
            key={c}
            style={styles.currencyOption}
            onPress={() => { setCurrency(c); setCurrencyModalVisible(false); }}
            activeOpacity={0.7}
          >
            <Text style={styles.currencyOptionSym}>{symbolOf(c)}</Text>
            <Text style={styles.currencyOptionCode}>{c}</Text>
            {currency === c && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </BottomModal>

      {/* Payer picker modal */}
      <BottomModal visible={payerModalVisible} onClose={() => setPayerModalVisible(false)}>
        <Text style={styles.modalTitle}>Who paid?</Text>
        {group.members.map(m => (
          <TouchableOpacity
            key={m.id}
            style={styles.payerOption}
            onPress={() => { setPaidById(m.user.id); setPayerModalVisible(false); }}
            activeOpacity={0.7}
          >
            <Avatar
              name={m.user.name}
              email={m.user.email}
              avatar={m.user.avatar}
              size={36}
              style={styles.avatarGap}
            />
            <Text style={styles.payerOptionName}>
              {m.user.id === user!.id ? 'You' : (m.user.name || m.user.email)}
            </Text>
            {paidById === m.user.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </BottomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: C.bg,
  },
  back: { fontSize: 16, color: C.accent, fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  save: { fontSize: 16, color: C.accent, fontWeight: '700' },

  section: {
    backgroundColor: C.bgElevated,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
  },
  label: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48,209,88,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  currencyBtnText: { fontSize: 15, fontWeight: '700', color: C.accent },
  currencyChevron: { fontSize: 11, color: C.accent },
  amountInput: {
    flex: 1,
    backgroundColor: C.inputFill,
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: C.text,
  },

  payerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  payerName: { flex: 1, fontSize: 16, fontWeight: '600', color: C.text },
  chevron: { fontSize: 22, color: C.chevron, fontWeight: '300' },

  splitTypeRow: { flexDirection: 'row', gap: 8 },
  splitBtn: {
    flex: 1,
    backgroundColor: C.inputFill,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  splitBtnActive: { backgroundColor: C.accent },
  splitBtnText: { color: C.text, fontWeight: '700', fontSize: 14 },
  splitBtnTextActive: { color: '#fff' },
  splitBtnHint: { color: C.textSecondary, fontSize: 11, marginTop: 2 },
  splitBtnHintActive: { color: 'rgba(255,255,255,0.85)' },

  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  avatarGap: { marginRight: 10 },
  memberName: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },

  splitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 46,
    paddingBottom: 10,
  },
  splitInputLabel: { fontSize: 13, color: C.textSecondary },
  splitInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputFill,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 100,
  },
  splitInputPrefix: { fontSize: 15, color: C.textSecondary, marginRight: 4 },
  splitInputSuffix: { fontSize: 15, color: C.textSecondary, marginLeft: 4 },
  splitInput: { fontSize: 15, minWidth: 60, textAlign: 'right', color: C.text },

  preview: { marginTop: 12, borderRadius: 12, padding: 12, alignItems: 'center' },
  previewOk: { backgroundColor: 'rgba(48,209,88,0.12)' },
  previewError: { backgroundColor: 'rgba(255,59,48,0.12)' },
  previewLabel: { fontSize: 13, fontWeight: '700' },
  previewLabelOk: { color: C.positive },
  previewLabelError: { color: C.negative },

  modalTitle: {
    fontSize: 22, fontWeight: '800', marginBottom: 16, color: C.text, letterSpacing: -0.3,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  currencyOptionSym: { fontSize: 18, width: 36, fontWeight: '700', color: C.text },
  currencyOptionCode: { flex: 1, fontSize: 16, color: C.text, fontWeight: '500' },
  payerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  payerOptionName: { flex: 1, fontSize: 16, color: C.text, fontWeight: '500' },
  checkmark: { fontSize: 18, color: C.accent, fontWeight: '800' },
});
