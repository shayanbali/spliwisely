import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView,
  Platform, Animated, Easing,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { scanReceipt, createExpense, updateExpense, uploadExpenseImage } from '../../services/expenses';
import BackButton from '../../components/common/BackButton';
import { Group, Expense, ReceiptScanResult, ReceiptData } from '../../types';
import BottomModal from '../../components/common/BottomModal';
import Avatar from '../../components/common/Avatar';
import { symbolOf, CURRENCIES } from '../../utils/currency';
import { S, ThemeColors } from '../../theme';

function DynamicReceiptIcon({ C }: { C: any }) {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ripple ring 1
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])
    ).start();

    // Ripple ring 2 — offset by 1100ms
    Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(pulse2, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])
    ).start();

    // Icon breath
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.06, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Scan line sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(scanLine, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(200),
      ])
    ).start();
  }, []);

  const ripple = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.35, 0] }),
  });

  const scanTranslate = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-38, 38] });

  return (
    <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
      {/* Ripple rings */}
      <Animated.View style={[{
        position: 'absolute',
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: C.accent,
      }, ripple(pulse1)]} />
      <Animated.View style={[{
        position: 'absolute',
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: C.accent,
      }, ripple(pulse2)]} />

      {/* Icon box */}
      <Animated.View style={{
        width: 100, height: 100, borderRadius: 28,
        backgroundColor: C.accentSoft,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        transform: [{ scale: iconScale }],
      }}>
        <Ionicons name="receipt-outline" size={52} color={C.accent} />

        {/* Scan line */}
        <Animated.View style={{
          position: 'absolute',
          left: 0, right: 0,
          height: 2,
          borderRadius: 1,
          backgroundColor: C.accent,
          opacity: 0.6,
          transform: [{ translateY: scanTranslate }],
        }} />
        {/* Glow below scan line */}
        <Animated.View style={{
          position: 'absolute',
          left: 0, right: 0,
          height: 20,
          backgroundColor: C.accent,
          opacity: 0.08,
          transform: [{ translateY: Animated.add(scanTranslate, new Animated.Value(10)) }],
        }} />
      </Animated.View>
    </View>
  );
}

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound',
  CAD: 'Canadian Dollar', AUD: 'Australian Dollar', JPY: 'Japanese Yen',
  CHF: 'Swiss Franc', CNY: 'Chinese Yuan', INR: 'Indian Rupee',
};

type Step = 'capture' | 'scanning' | 'review';
type SplitMode = 'equal' | 'by_item';

interface EditableItem {
  id: string;
  name: string;
  price: string;
}

export default function ReceiptScanScreen({ route, navigation }: any) {
  const {
    group,
    onDone,
    // edit mode: passed when editing an existing receipt expense
    editExpense,
  }: { group: Group; onDone: () => void; editExpense?: Expense } = route.params;

  const { user } = useAuth();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  // If editing, start at review with stored data; otherwise start at capture
  const [step, setStep] = useState<Step>(editExpense?.receipt_data ? 'review' : 'capture');
  const [imageUri, setImageUri] = useState<string | null>(editExpense?.image ?? null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Extracted receipt data — seeded from stored receipt_data when editing
  const rd = editExpense?.receipt_data as ReceiptData | undefined;
  const [items, setItems] = useState<EditableItem[]>(() =>
    rd?.items.map((it, i) => ({ id: String(i), name: it.name, price: it.price.toFixed(2) })) ?? []
  );
  const [subtotalOverride, setSubtotalOverride] = useState<string | null>(null);
  const [tax, setTax] = useState(rd?.tax ? rd.tax.toFixed(2) : '0');
  const [serviceCharge, setServiceCharge] = useState(rd?.service_charge ? rd.service_charge.toFixed(2) : '0');
  const [tip, setTip] = useState(rd?.tip ? rd.tip.toFixed(2) : '0');
  const [detectedCurrency, setDetectedCurrency] = useState(editExpense?.currency ?? rd?.currency ?? 'USD');

  // Split configuration
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [selectedIds, setSelectedIds] = useState<number[]>(
    editExpense?.splits?.map((s: any) => s.user.id) ?? group.members.map(m => m.user.id)
  );
  const [itemAssignees, setItemAssignees] = useState<Record<string, number[]>>(() => {
    const defaultAll = group.members.map(m => m.user.id);
    const ids = rd?.items.map((_, i) => String(i)) ?? [];
    return Object.fromEntries(ids.map(id => [id, defaultAll]));
  });
  const [paidById, setPaidById] = useState<number>(editExpense?.paid_by.id ?? user!.id);
  const [description, setDescription] = useState(editExpense?.description ?? 'Receipt');
  const [payerModalVisible, setPayerModalVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const paidByUser = group.members.find(m => m.user.id === paidById)?.user;
  const sym = symbolOf(detectedCurrency);

  // ─── Totals ───────────────────────────────────────────────────────
  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  // subtotalOverride=null → auto-computed from items; string → user-entered
  const effectiveSubtotal = subtotalOverride !== null ? (parseFloat(subtotalOverride) || 0) : itemsTotal;
  const taxVal = parseFloat(tax) || 0;
  const serviceVal = parseFloat(serviceCharge) || 0;
  const tipVal = parseFloat(tip) || 0;
  const extras = taxVal + serviceVal + tipVal;
  const grandTotal = effectiveSubtotal + extras;

  // ─── Per-person breakdown ─────────────────────────────────────────
  const perPerson: Record<number, number> = {};
  if (splitMode === 'equal' && selectedIds.length > 0) {
    const share = grandTotal / selectedIds.length;
    selectedIds.forEach(id => { perPerson[id] = share; });
  } else if (splitMode === 'by_item') {
    group.members.forEach(m => { perPerson[m.user.id] = 0; });
    items.forEach(item => {
      const priceNum = parseFloat(item.price) || 0;
      const assignees = itemAssignees[item.id] ?? group.members.map(m => m.user.id);
      if (assignees.length === 0) return;
      const share = priceNum / assignees.length;
      assignees.forEach(uid => { perPerson[uid] = (perPerson[uid] ?? 0) + share; });
    });
    // distribute extras proportionally
    if (extras > 0 && itemsTotal > 0) {
      group.members.forEach(m => {
        const proportion = (perPerson[m.user.id] ?? 0) / itemsTotal;
        perPerson[m.user.id] = (perPerson[m.user.id] ?? 0) + extras * proportion;
      });
    }
  }

  // ─── Image picker ─────────────────────────────────────────────────
  async function pickImage(fromCamera: boolean) {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to scan receipts.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85, base64: false });
      if (!result.canceled) await startScan(result.assets[0].uri);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to scan receipts.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, base64: false });
      if (!result.canceled) await startScan(result.assets[0].uri);
    }
  }

  async function startScan(uri: string) {
    setImageUri(uri);
    setStep('scanning');
    setScanError(null);
    try {
      const result: ReceiptScanResult = await scanReceipt(uri);
      applyResult(result);
      setStep('review');
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Could not read the receipt. Try a clearer photo.';
      setScanError(msg);
      setStep('capture');
    }
  }

  function applyResult(result: ReceiptScanResult) {
    setSubtotalOverride(null);
    const newItems: EditableItem[] = result.items.map((it, i) => ({
      id: String(i),
      name: it.name,
      price: it.price.toFixed(2),
    }));
    setItems(newItems);
    setTax(result.tax > 0 ? result.tax.toFixed(2) : '0');
    setServiceCharge(result.service_charge > 0 ? result.service_charge.toFixed(2) : '0');
    setTip(result.tip > 0 ? result.tip.toFixed(2) : '0');
    setDetectedCurrency(result.currency ?? 'USD');
    // Default: all members assigned to each item
    const defaultAssignees: Record<string, number[]> = {};
    newItems.forEach(it => {
      defaultAssignees[it.id] = group.members.map(m => m.user.id);
    });
    setItemAssignees(defaultAssignees);
  }

  function toggleMember(uid: number) {
    setSelectedIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  }

  function toggleItemAssignee(itemId: string, uid: number) {
    setItemAssignees(prev => {
      const current = prev[itemId] ?? group.members.map(m => m.user.id);
      const next = current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid];
      return { ...prev, [itemId]: next.length > 0 ? next : current }; // don't allow 0 assignees
    });
  }

  function updateItemName(id: string, name: string) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, name } : it));
  }

  function updateItemPrice(id: string, price: string) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, price } : it));
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id));
    setItemAssignees(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  function addItem() {
    const id = String(Date.now());
    setItems(prev => [...prev, { id, name: '', price: '0.00' }]);
    setItemAssignees(prev => ({ ...prev, [id]: group.members.map(m => m.user.id) }));
  }

  async function handleConfirm() {
    if (grandTotal <= 0) {
      Alert.alert('Error', 'Total amount must be greater than 0.');
      return;
    }
    if (splitMode === 'equal' && selectedIds.length === 0) {
      Alert.alert('Error', 'Select at least one person to split with.');
      return;
    }

    const exactAmounts: Record<string, number> = {};
    group.members.forEach(m => {
      const share = perPerson[m.user.id] ?? 0;
      if (share > 0.005) exactAmounts[String(m.user.id)] = Math.round(share * 100) / 100;
    });

    // Ensure the payer is included if they have no share assigned
    if (!exactAmounts[String(paidById)]) {
      exactAmounts[String(paidById)] = 0;
    }

    // Normalize rounding: adjust largest share to fix floating point drift
    const sumShares = Object.values(exactAmounts).reduce((a, b) => a + b, 0);
    const diff = Math.round((grandTotal - sumShares) * 100) / 100;
    if (Math.abs(diff) > 0.001) {
      const largestId = Object.entries(exactAmounts).sort((a, b) => b[1] - a[1])[0][0];
      exactAmounts[largestId] = Math.round((exactAmounts[largestId] + diff) * 100) / 100;
    }

    const participantIds = Object.keys(exactAmounts).map(Number);

    const receiptData: ReceiptData = {
      items: items.map(it => ({ name: it.name, price: parseFloat(it.price) || 0 })),
      subtotal: effectiveSubtotal,
      tax: taxVal,
      service_charge: serviceVal,
      tip: tipVal,
      currency: detectedCurrency,
    };

    setSubmitting(true);
    try {
      let expenseId: number;
      if (editExpense) {
        await updateExpense(editExpense.id, {
          description: description.trim() || 'Receipt',
          amount: Math.round(grandTotal * 100) / 100,
          currency: detectedCurrency,
          paid_by_id: paidById,
          split_type: 'exact',
          participant_ids: participantIds,
          exact_amounts: exactAmounts,
          receipt_data: receiptData,
        } as any);
        expenseId = editExpense.id;
        if (imageUri && imageUri !== editExpense.image) {
          await uploadExpenseImage(expenseId, imageUri).catch(() => {});
        }
      } else {
        const expense = await createExpense({
          description: description.trim() || 'Receipt',
          amount: Math.round(grandTotal * 100) / 100,
          currency: detectedCurrency,
          paid_by_id: paidById,
          group: group.id,
          split_type: 'exact',
          participant_ids: participantIds,
          exact_amounts: exactAmounts,
          receipt_data: receiptData,
        });
        expenseId = expense.id;
        if (imageUri) {
          await uploadExpenseImage(expenseId, imageUri).catch(() => {});
        }
      }
      onDone();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Could not create expense.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────
  if (step === 'capture') {
    return (
      <View style={styles.container}>
        <BackButton
          variant="close"
          onPress={() => navigation.goBack()}
          style={styles.closeBtnPos}
        />

        <View style={styles.captureCenter}>
          <DynamicReceiptIcon C={C} />
          <Text style={styles.captureTitle}>Scan a Receipt</Text>
          <Text style={styles.captureSub}>
            Claude AI will extract the items, tax, and total automatically.
          </Text>
          {scanError && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={15} color={C.negative} />
              <Text style={styles.errorText}>{scanError}</Text>
            </View>
          )}
        </View>

        <View style={styles.captureActions}>
          <TouchableOpacity
            style={[styles.captureBtn, { backgroundColor: C.accent }]}
            onPress={() => pickImage(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.captureBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureBtn, { backgroundColor: C.inputFill }]}
            onPress={() => pickImage(false)}
            activeOpacity={0.85}
          >
            <Ionicons name="images-outline" size={22} color={C.text} />
            <Text style={[styles.captureBtnText, { color: C.text }]}>Choose from Library</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'scanning') {
    return (
      <View style={styles.container}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.scanningPreview} resizeMode="cover" />
        )}
        <View style={styles.scanningOverlay}>
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.scanningTitle}>Analyzing receipt…</Text>
            <Text style={styles.scanningSub}>Claude AI is reading your receipt</Text>
          </View>
        </View>
      </View>
    );
  }

  // ─── Review step ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.reviewHeader}>
        <BackButton onPress={() => setStep('capture')} />
        <Text style={styles.reviewTitle}>Review Receipt</Text>
        <BackButton variant="close" onPress={() => navigation.goBack()} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reviewContent}>

        {/* Image thumbnail */}
        {imageUri && (
          <TouchableOpacity onPress={() => setStep('capture')} activeOpacity={0.85}>
            <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
            <Text style={styles.thumbHint}>Tap to rescan</Text>
          </TouchableOpacity>
        )}

        {/* Description */}
        <Text style={styles.sectionLabel}>Description</Text>
        <View style={[styles.card, S.shadowSm]}>
          <TextInput
            style={styles.descInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Expense name"
            placeholderTextColor={C.placeholder}
            autoCapitalize="sentences"
          />
        </View>

        {/* Items */}
        <Text style={styles.sectionLabel}>Items</Text>
        <View style={[styles.card, S.shadowSm]}>
          {items.map((item, idx) => (
            <View key={item.id} style={[styles.itemRow, idx > 0 && styles.itemBorder]}>
              <TextInput
                style={styles.itemName}
                value={item.name}
                onChangeText={v => updateItemName(item.id, v)}
                placeholder="Item name"
                placeholderTextColor={C.placeholder}
              />
              <View style={styles.itemPriceRow}>
                <Text style={styles.itemSym}>{sym}</Text>
                <TextInput
                  style={styles.itemPrice}
                  value={item.price}
                  onChangeText={v => updateItemPrice(item.id, v)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.itemRemove}>
                  <Ionicons name="close-circle" size={18} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addItemBtn} onPress={addItem} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={C.accent} />
            <Text style={styles.addItemText}>Add item</Text>
          </TouchableOpacity>
        </View>

        {/* Totals */}
        <Text style={styles.sectionLabel}>Totals</Text>
        <View style={[styles.card, S.shadowSm]}>
          <View style={styles.totalRow}>
            <View style={styles.subtotalLabelRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              {subtotalOverride !== null && (
                <TouchableOpacity onPress={() => setSubtotalOverride(null)} style={styles.autoResetBtn}>
                  <Text style={styles.autoResetText}>auto</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.totalEditRow}>
              <Text style={styles.itemSym}>{sym}</Text>
              <TextInput
                style={styles.totalInput}
                value={subtotalOverride !== null ? subtotalOverride : itemsTotal.toFixed(2)}
                onChangeText={v => setSubtotalOverride(v)}
                onFocus={() => { if (subtotalOverride === null) setSubtotalOverride(itemsTotal.toFixed(2)); }}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
          </View>
          <View style={[styles.totalRow, styles.totalBorder]}>
            <Text style={styles.totalLabel}>Tax</Text>
            <View style={styles.totalEditRow}>
              <Text style={styles.itemSym}>{sym}</Text>
              <TextInput
                style={styles.totalInput}
                value={tax}
                onChangeText={setTax}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
          </View>
          <View style={[styles.totalRow, styles.totalBorder]}>
            <Text style={styles.totalLabel}>Service charge</Text>
            <View style={styles.totalEditRow}>
              <Text style={styles.itemSym}>{sym}</Text>
              <TextInput
                style={styles.totalInput}
                value={serviceCharge}
                onChangeText={setServiceCharge}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
          </View>
          <View style={[styles.totalRow, styles.totalBorder]}>
            <Text style={styles.totalLabel}>Tip</Text>
            <View style={styles.totalEditRow}>
              <Text style={styles.itemSym}>{sym}</Text>
              <TextInput
                style={styles.totalInput}
                value={tip}
                onChangeText={setTip}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
          </View>
          <View style={[styles.totalRow, styles.totalBorder, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: C.accent }]}>
              {sym}{grandTotal.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.totalRow, styles.totalBorder]}
            onPress={() => setCurrencyPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.totalLabel}>Currency</Text>
            <View style={styles.currencyPickerRow}>
              <Text style={styles.currencyPickerValue}>{detectedCurrency}</Text>
              <Ionicons name="chevron-down" size={15} color={C.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Split mode toggle */}
        <Text style={styles.sectionLabel}>Split</Text>
        <View style={[styles.card, S.shadowSm]}>
          <View style={styles.splitToggleRow}>
            <TouchableOpacity
              style={[styles.splitToggleBtn, splitMode === 'equal' && { backgroundColor: C.accent }]}
              onPress={() => setSplitMode('equal')}
              activeOpacity={0.85}
            >
              <Text style={[styles.splitToggleText, splitMode === 'equal' && { color: '#fff' }]}>
                Equal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.splitToggleBtn, splitMode === 'by_item' && { backgroundColor: C.accent }]}
              onPress={() => setSplitMode('by_item')}
              activeOpacity={0.85}
            >
              <Text style={[styles.splitToggleText, splitMode === 'by_item' && { color: '#fff' }]}>
                By Item
              </Text>
            </TouchableOpacity>
          </View>

          {splitMode === 'equal' ? (
            <View style={styles.splitEqualSection}>
              <Text style={styles.splitHint}>Select who shares this expense</Text>
              <View style={styles.memberChips}>
                {group.members.map(m => {
                  const active = selectedIds.includes(m.user.id);
                  return (
                    <TouchableOpacity
                      key={m.user.id}
                      style={[styles.memberChip, active && { borderColor: C.accent, backgroundColor: C.accentSoft }]}
                      onPress={() => toggleMember(m.user.id)}
                      activeOpacity={0.8}
                    >
                      <Avatar name={m.user.name} email={m.user.email} avatar={m.user.avatar} size={28} fontSize={11} />
                      <Text style={[styles.memberChipName, active && { color: C.accent }]}>
                        {m.user.id === user!.id ? 'You' : (m.user.name || m.user.email)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedIds.length > 0 && (
                <Text style={styles.equalShareHint}>
                  Each person pays {sym}{(grandTotal / selectedIds.length).toFixed(2)}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.byItemSection}>
              <Text style={styles.splitHint}>Tap members to assign each item</Text>
              {items.map((item, idx) => {
                const assignees = itemAssignees[item.id] ?? group.members.map(m => m.user.id);
                const priceNum = parseFloat(item.price) || 0;
                return (
                  <View key={item.id} style={[styles.byItemRow, idx > 0 && styles.itemBorder]}>
                    <View style={styles.byItemLeft}>
                      <Text style={styles.byItemName} numberOfLines={1}>{item.name || 'Item'}</Text>
                      <Text style={styles.byItemPrice}>{sym}{priceNum.toFixed(2)}</Text>
                    </View>
                    <View style={styles.byItemAvatars}>
                      {group.members.map(m => {
                        const assigned = assignees.includes(m.user.id);
                        return (
                          <TouchableOpacity
                            key={m.user.id}
                            onPress={() => toggleItemAssignee(item.id, m.user.id)}
                            style={[styles.byItemAvatar, !assigned && styles.byItemAvatarDim]}
                            activeOpacity={0.8}
                          >
                            <Avatar
                              name={m.user.name}
                              email={m.user.email}
                              avatar={m.user.avatar}
                              size={30}
                              fontSize={11}
                            />
                            {assigned && (
                              <View style={[styles.assignedDot, { backgroundColor: C.accent }]} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Per-person breakdown */}
        {(splitMode === 'by_item' || (splitMode === 'equal' && selectedIds.length > 1)) && (
          <>
            <Text style={styles.sectionLabel}>Breakdown</Text>
            <View style={[styles.card, S.shadowSm]}>
              {group.members
                .filter(m => (perPerson[m.user.id] ?? 0) > 0.005)
                .map((m, idx) => (
                  <View key={m.user.id} style={[styles.breakdownRow, idx > 0 && styles.itemBorder]}>
                    <Avatar name={m.user.name} email={m.user.email} avatar={m.user.avatar} size={32} fontSize={13} />
                    <Text style={styles.breakdownName}>
                      {m.user.id === user!.id ? 'You' : (m.user.name || m.user.email)}
                    </Text>
                    <Text style={[styles.breakdownAmount, { color: C.accent }]}>
                      {sym}{(perPerson[m.user.id] ?? 0).toFixed(2)}
                    </Text>
                  </View>
                ))}
            </View>
          </>
        )}

        {/* Paid by */}
        <Text style={styles.sectionLabel}>Paid by</Text>
        <View style={[styles.card, S.shadowSm]}>
          <TouchableOpacity
            style={styles.paidByRow}
            onPress={() => setPayerModalVisible(true)}
            activeOpacity={0.8}
          >
            <Avatar
              name={paidByUser?.name}
              email={paidByUser?.email}
              avatar={paidByUser?.avatar}
              size={36}
              fontSize={14}
            />
            <Text style={styles.paidByName}>
              {paidById === user!.id ? 'You' : (paidByUser?.name || paidByUser?.email)}
            </Text>
            <Ionicons name="chevron-down" size={18} color={C.textSecondary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* Add Expense button */}
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: C.accent }, submitting && { opacity: 0.6 }]}
          onPress={handleConfirm}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.confirmBtnText}>Add Expense  ·  {sym}{grandTotal.toFixed(2)}</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* Payer modal */}
      <BottomModal visible={payerModalVisible} onClose={() => setPayerModalVisible(false)}>
        <Text style={styles.modalTitle}>Who paid?</Text>
        {group.members.map((m, i) => (
          <TouchableOpacity
            key={m.user.id}
            style={[styles.payerRow, i > 0 && styles.payerBorder]}
            onPress={() => { setPaidById(m.user.id); setPayerModalVisible(false); }}
            activeOpacity={0.7}
          >
            <Avatar name={m.user.name} email={m.user.email} avatar={m.user.avatar} size={36} fontSize={14} />
            <Text style={styles.payerName}>
              {m.user.id === user!.id ? 'You' : (m.user.name || m.user.email)}
            </Text>
            {m.user.id === paidById && <Ionicons name="checkmark" size={18} color={C.accent} />}
          </TouchableOpacity>
        ))}
      </BottomModal>

      {/* Currency picker modal */}
      <BottomModal visible={currencyPickerVisible} onClose={() => setCurrencyPickerVisible(false)}>
        <Text style={styles.modalTitle}>Currency</Text>
        {CURRENCIES.map((c, i) => (
          <TouchableOpacity
            key={c}
            style={[styles.payerRow, i > 0 && styles.payerBorder]}
            onPress={() => { setDetectedCurrency(c); setCurrencyPickerVisible(false); }}
            activeOpacity={0.7}
          >
            <View style={[styles.currencyBadge, { backgroundColor: C.accentSoft }]}>
              <Text style={[styles.currencyBadgeText, { color: C.accent }]}>{symbolOf(c).trim()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payerName}>{c}</Text>
              <Text style={[styles.payerName, { fontSize: 13, color: C.textSecondary, fontWeight: '400' }]}>
                {CURRENCY_NAMES[c] ?? ''}
              </Text>
            </View>
            {c === detectedCurrency && <Ionicons name="checkmark" size={18} color={C.accent} />}
          </TouchableOpacity>
        ))}
      </BottomModal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    // ── Capture step ──
    closeBtnPos: {
      position: 'absolute',
      top: 60,
      right: 20,
      zIndex: 10,
    },
    captureCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    captureTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 10,
    },
    captureSub: {
      fontSize: 15,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
      backgroundColor: 'rgba(255,59,48,0.1)',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    errorText: { fontSize: 13, color: C.negative, flex: 1 },
    captureActions: {
      paddingHorizontal: 20,
      paddingBottom: 60,
      gap: 12,
    },
    captureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: 18,
      paddingVertical: 18,
    },
    captureBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

    // ── Scanning step ──
    scanningPreview: {
      width: '100%',
      height: '100%',
      position: 'absolute',
    },
    scanningOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanningCard: {
      backgroundColor: C.bgElevated,
      borderRadius: 24,
      paddingVertical: 36,
      paddingHorizontal: 40,
      alignItems: 'center',
      gap: 14,
    },
    scanningTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    scanningSub: { fontSize: 14, color: C.textSecondary, textAlign: 'center' },

    // ── Review step ──
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    reviewTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
    },
    reviewContent: { paddingHorizontal: 0, paddingBottom: 48 },

    thumb: {
      marginHorizontal: 16,
      height: 120,
      borderRadius: 16,
      marginBottom: 4,
    },
    thumbHint: {
      textAlign: 'center',
      fontSize: 12,
      color: C.textMuted,
      marginBottom: 12,
    },

    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 20,
      marginTop: 16,
    },
    card: {
      marginHorizontal: 16,
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      overflow: 'hidden',
    },

    // Items
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    itemBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.separator,
    },
    itemName: {
      flex: 1,
      fontSize: 15,
      color: C.text,
    },
    itemPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    itemSym: { fontSize: 14, color: C.textSecondary, marginRight: 1 },
    itemPrice: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
      minWidth: 60,
      textAlign: 'right',
    },
    itemRemove: { paddingLeft: 8 },
    addItemBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.separator,
    },
    addItemText: { fontSize: 14, color: C.accent, fontWeight: '600' },

    // Totals
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    totalBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.separator,
    },
    subtotalLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    autoResetBtn: {
      backgroundColor: C.accentSoft,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    autoResetText: {
      fontSize: 11,
      fontWeight: '600',
      color: C.accent,
    },
    totalLabel: { fontSize: 15, color: C.text },
    totalValue: { fontSize: 15, fontWeight: '600', color: C.text },
    totalEditRow: { flexDirection: 'row', alignItems: 'center' },
    totalInput: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
      minWidth: 60,
      textAlign: 'right',
    },
    grandTotalRow: { paddingVertical: 14 },
    grandTotalLabel: { fontSize: 17, fontWeight: '700', color: C.text },
    grandTotalValue: { fontSize: 17, fontWeight: '800' },

    // Split toggle
    splitToggleRow: {
      flexDirection: 'row',
      margin: 14,
      backgroundColor: C.inputFill,
      borderRadius: 14,
      padding: 3,
      gap: 3,
    },
    splitToggleBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 11,
      alignItems: 'center',
    },
    splitToggleText: { fontSize: 15, fontWeight: '600', color: C.textSecondary },
    splitHint: {
      fontSize: 13,
      color: C.textSecondary,
      marginHorizontal: 16,
      marginBottom: 12,
    },

    // Equal split
    splitEqualSection: { paddingBottom: 16 },
    memberChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    memberChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.separator,
      backgroundColor: C.inputFill,
    },
    memberChipName: { fontSize: 13, color: C.text, fontWeight: '500' },
    equalShareHint: {
      fontSize: 13,
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 4,
    },

    // By-item split
    byItemSection: { paddingBottom: 8 },
    byItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
    },
    byItemLeft: { flex: 1 },
    byItemName: { fontSize: 15, color: C.text, fontWeight: '500' },
    byItemPrice: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    byItemAvatars: { flexDirection: 'row', gap: 6 },
    byItemAvatar: { position: 'relative' },
    byItemAvatarDim: { opacity: 0.3 },
    assignedDot: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: C.bg,
    },

    // Breakdown
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    breakdownName: { flex: 1, fontSize: 15, color: C.text },
    breakdownAmount: { fontSize: 15, fontWeight: '700' },

    // Paid by
    paidByRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    paidByName: { fontSize: 16, color: C.text, fontWeight: '500' },

    // Confirm button
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 24,
      borderRadius: 18,
      paddingVertical: 18,
    },
    confirmBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

    // Description
    descInput: {
      fontSize: 16,
      color: C.text,
      paddingHorizontal: 16,
      paddingVertical: 15,
    },

    // Currency picker row (inside totals card)
    currencyPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    currencyPickerValue: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
    },

    // Currency badge in modal
    currencyBadge: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    currencyBadgeText: {
      fontSize: 14,
      fontWeight: '700',
    },

    // Payer modal
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    payerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
    },
    payerBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.separator,
    },
    payerName: { flex: 1, fontSize: 16, color: C.text },
  });
}
