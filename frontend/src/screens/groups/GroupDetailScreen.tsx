import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, Image, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, RefreshControl, Switch, Modal,
  ScrollView, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import BackButton from '../../components/common/BackButton';
import { useFocusEffect } from '@react-navigation/native';
import { getGroup, addMember, updateGroupImage, updateGroupSettings, getPotTransactions, getPotBalance, createPotTransaction } from '../../services/groups';
import { useAuth } from '../../context/AuthContext';
import { getExpenses, getSimplifiedBalances, deleteExpense, getRecurringExpenses, updateRecurringExpense, deleteRecurringExpense, generateRecurringExpenses, getSettlements } from '../../services/expenses';
import { RecurringExpense, PotTransaction } from '../../types';
import { Group, Expense, Settlement } from '../../types';
import BottomModal from '../../components/common/BottomModal';
import Avatar from '../../components/common/Avatar';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { fmt } from '../../utils/currency';
import { getExpenseCategory } from '../../utils/expenseCategory';
import { S, TAB_PAD, ThemeColors } from '../../theme';

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

export default function GroupDetailScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const { group: initialGroup } = route.params;
  const [group, setGroup] = useState<Group>(initialGroup);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [simplified, setSimplified] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [renameModal, setRenameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [receiptViewItem, setReceiptViewItem] = useState<Expense | null>(null);
  const [potTransactions, setPotTransactions] = useState<PotTransaction[]>([]);
  const [potBalance, setPotBalance] = useState<string>('0');
  const [buyInModal, setBuyInModal] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState('');
  const [buyInNote, setBuyInNote] = useState('');
  const [buyInLoading, setBuyInLoading] = useState(false);

  const { converted } = useCurrency();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function load() {
    setError(false);
    try {
      await generateRecurringExpenses(initialGroup.id).catch(() => {});
      const [g, e, s, r, st] = await Promise.all([
        getGroup(initialGroup.id),
        getExpenses(initialGroup.id),
        getSimplifiedBalances(initialGroup.id),
        getRecurringExpenses(initialGroup.id),
        getSettlements(initialGroup.id),
      ]);
      setGroup(g);
      setExpenses(e);
      setSimplified(s);
      setRecurring(r);
      setSettlements(st);
      if (g.group_type === 'gaming') {
        const [potTxns, potBal] = await Promise.all([
          getPotTransactions(initialGroup.id),
          getPotBalance(initialGroup.id),
        ]);
        setPotTransactions(potTxns);
        setPotBalance(potBal.balance);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleBuyIn() {
    const parsed = parseFloat(buyInAmount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    if (!user) return;
    setBuyInLoading(true);
    try {
      await createPotTransaction(group.id, {
        user_id: user.id,
        transaction_type: 'contribution',
        amount: parsed,
        currency: group.currency,
        note: buyInNote.trim(),
      });
      setBuyInModal(false);
      setBuyInAmount('');
      setBuyInNote('');
      load();
    } catch {
      Alert.alert('Error', 'Could not record buy in.');
    } finally {
      setBuyInLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleRenameGroup() {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === group.name) { setRenameModal(false); return; }
    setRenaming(true);
    try {
      const updated = await updateGroupSettings(group.id, { name: trimmed });
      setGroup(g => ({ ...g, name: updated.name }));
      setRenameModal(false);
    } catch {
      Alert.alert('Error', 'Could not rename group.');
    } finally {
      setRenaming(false);
    }
  }

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

  async function handlePickGroupImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a group picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingImage(true);
    try {
      const updated = await updateGroupImage(group.id, uri);
      setGroup(updated);
    } catch {
      Alert.alert('Error', 'Could not update group picture.');
    } finally {
      setUploadingImage(false);
    }
  }

  function handleExpenseActions(item: any) {
    const buttons: any[] = [];
    if (item.receipt_data) {
      buttons.push({
        text: 'Edit Receipt Items',
        onPress: () => navigation.navigate('ReceiptScan', { group, editExpense: item, onDone: load }),
      });
    }
    buttons.push({
      text: 'Edit Details',
      onPress: () => navigation.navigate('EditExpense', { group, expense: item, onDone: load }),
    });
    buttons.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => confirmDelete(item.id, item.description),
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(item.description, 'What would you like to do?', buttons);
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
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{initialGroup.name}</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.centerBox}>
          <Ionicons name="warning-outline" size={48} color={C.warning} style={{ marginBottom: 12 }} />
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
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerCenter}>
          <TouchableOpacity onPress={handlePickGroupImage} activeOpacity={0.85} style={styles.headerAvatarWrap}>
            {group.image ? (
              <Image source={{ uri: group.image }} style={styles.headerAvatar} />
            ) : (
              <LinearGradient colors={[C.accent, C.accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerAvatar}>
                <Text style={styles.headerAvatarLetter}>{group.name[0].toUpperCase()}</Text>
              </LinearGradient>
            )}
            {uploadingImage ? (
              <View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <View style={styles.headerCameraBadge}>
                <Ionicons name="camera" size={9} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <TouchableOpacity
              onPress={() => { setNewName(group.name); setRenameModal(true); }}
              activeOpacity={0.7}
              style={styles.nameTapRow}
            >
              <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
              <Ionicons name="pencil" size={13} color={C.textMuted} style={{ marginLeft: 5 }} />
            </TouchableOpacity>
            <View style={styles.curBadge}>
              <Text style={styles.curBadgeText}>{group.currency}</Text>
            </View>
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
            {group.group_type === 'gaming' && (
              <View style={styles.section}>
                {/* Pot balance card */}
                <LinearGradient
                  colors={['#BF5AF2', '#7B2FBE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.potCard, S.shadowSm]}
                >
                  <View style={styles.potCardTop}>
                    <View style={styles.potIconCircle}>
                      <Text style={styles.potIconEmoji}>🎮</Text>
                    </View>
                    <View style={styles.potCardInfo}>
                      <Text style={styles.potCardLabel}>Gaming Pot</Text>
                      <Text style={styles.potCardBalance}>{fmt(parseFloat(potBalance), group.currency)}</Text>
                      <Text style={styles.potCardCurrency}>{group.currency} in the pot</Text>
                    </View>
                  </View>
                  <View style={styles.potBtnRow}>
                    <TouchableOpacity
                      style={styles.potBtn}
                      onPress={() => { setBuyInAmount(''); setBuyInNote(''); setBuyInModal(true); }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle-outline" size={16} color="#fff" />
                      <Text style={styles.potBtnText}>Buy In +</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.potBtn, styles.potBtnOutline]}
                      onPress={() => navigation.navigate('PotPayOut', {
                        group,
                        potBalance,
                        currency: group.currency,
                        onDone: load,
                      })}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="arrow-forward-circle-outline" size={16} color="#fff" />
                      <Text style={styles.potBtnText}>Pay Out →</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>

                {/* Recent pot transactions */}
                {potTransactions.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Recent Pot Activity</Text>
                    <View style={[styles.card, S.shadowSm]}>
                      {potTransactions.slice(0, 5).map((t, i) => (
                        <View
                          key={t.id}
                          style={[
                            styles.potTxnRow,
                            i < Math.min(potTransactions.length, 5) - 1 && styles.potTxnBorder,
                          ]}
                        >
                          <Avatar
                            name={t.user.name}
                            email={t.user.email}
                            avatar={t.user.avatar}
                            size={34}
                            style={{ marginRight: 10 }}
                          />
                          <View style={styles.potTxnInfo}>
                            <Text style={styles.potTxnName}>{t.user.name || t.user.email}</Text>
                            {t.note ? <Text style={styles.potTxnNote} numberOfLines={1}>{t.note}</Text> : null}
                            <Text style={styles.potTxnDate}>{formatDate(t.created_at)}</Text>
                          </View>
                          <View style={styles.potTxnRight}>
                            <View style={[
                              styles.potTxnBadge,
                              t.transaction_type === 'contribution' ? styles.potTxnBadgeContrib : styles.potTxnBadgePayout,
                            ]}>
                              <Text style={[
                                styles.potTxnBadgeText,
                                { color: t.transaction_type === 'contribution' ? '#30D158' : '#FF9F0A' },
                              ]}>
                                {t.transaction_type === 'contribution' ? '↑ Buy In' : '↓ Payout'}
                              </Text>
                            </View>
                            <Text style={styles.potTxnAmount}>
                              {t.transaction_type === 'contribution' ? '+' : '-'}{fmt(parseFloat(t.amount), t.currency)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {simplified.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>Suggested Settlements</Text>
                  <View style={styles.simplifyToggle}>
                    <Text style={styles.simplifyLabel}>
                      {group.simplify_debts ? 'Simplified' : 'Direct'}
                    </Text>
                    <Switch
                      value={group.simplify_debts}
                      onValueChange={async (val) => {
                        setGroup(g => ({ ...g, simplify_debts: val }));
                        try {
                          await updateGroupSettings(group.id, { simplify_debts: val });
                          load();
                        } catch {
                          setGroup(g => ({ ...g, simplify_debts: !val }));
                        }
                      }}
                      trackColor={{ true: C.accent, false: C.inputFill }}
                      thumbColor="#fff"
                      ios_backgroundColor={C.inputFill}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                </View>
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
                        <Ionicons name="arrow-forward" size={14} color={C.textSecondary} />
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

            {recurring.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Recurring</Text>
                <View style={[styles.card, S.shadowSm]}>
                  {recurring.map((r, i) => (
                    <View
                      key={r.id}
                      style={[
                        styles.recurringRow,
                        i < recurring.length - 1 && styles.recurringBorder,
                      ]}
                    >
                      <View style={[styles.recurringIcon, { backgroundColor: r.is_active ? C.accentSoft : C.inputFill }]}>
                        <Ionicons name="repeat" size={16} color={r.is_active ? C.accent : C.textMuted} />
                      </View>
                      <View style={styles.recurringInfo}>
                        <Text style={styles.recurringDesc} numberOfLines={1}>{r.description}</Text>
                        <Text style={styles.recurringSub}>
                          {r.currency} {parseFloat(r.amount).toFixed(2)} · {r.interval}
                          {r.is_active ? ` · next ${r.next_due}` : ' · paused'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        hitSlop={10}
                        onPress={() => {
                          Alert.alert(r.description, 'Manage recurring expense', [
                            {
                              text: r.is_active ? 'Pause' : 'Resume',
                              onPress: async () => {
                                await updateRecurringExpense(r.id, { is_active: !r.is_active });
                                load();
                              },
                            },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => Alert.alert('Delete recurring?', 'This stops future auto-generation. Existing expenses are kept.', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRecurringExpense(r.id); load(); } },
                              ]),
                            },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        }}
                      >
                        <Ionicons name="ellipsis-vertical" size={16} color={C.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.expensesHeader}>
              <Text style={styles.sectionLabel}>Expenses</Text>
              <View style={styles.expensesHeaderActions}>
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={() => navigation.navigate('ReceiptScan', { group, onDone: load })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="scan-outline" size={15} color={C.accent} />
                  <Text style={styles.scanBtnText}>Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addExpenseBtn}
                  onPress={() => navigation.navigate('AddExpense', { group, onDone: load })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addExpenseBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        data={(() => {
          const expItems = expenses.map(e => ({ ...e, _type: 'expense' as const }));
          const setItems = settlements.map(s => ({ ...s, _type: 'settlement' as const }));
          return [...expItems, ...setItems].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        })()}
        keyExtractor={item => `${item._type}-${item.id}`}
        contentContainerStyle={{ paddingBottom: TAB_PAD }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="receipt-outline" size={32} color={C.accent} />
            </View>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptySub}>Tap "+ Add" to record your first expense.</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item._type === 'settlement') {
            const s = item as Settlement & { _type: 'settlement' };
            const currency: string = s.currency ?? 'USD';
            const amount = parseFloat(s.amount);
            const payerName = s.payer.id === user?.id ? 'You' : (s.payer.name || s.payer.email);
            const receiverName = s.receiver.id === user?.id ? 'you' : (s.receiver.name || s.receiver.email);
            return (
              <View style={[styles.expenseRow, S.shadowSm]}>
                <View style={styles.expenseIconWrap}>
                  <View style={[styles.expenseIcon, styles.settlementIcon]}>
                    <Ionicons name="checkmark" size={20} color={C.positive} />
                  </View>
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDesc}>Settled up</Text>
                  <Text style={styles.expenseSub}>
                    {payerName} paid {receiverName} · {fmt(amount, currency)}
                  </Text>
                  {s.note ? (
                    <Text style={styles.expenseNotes} numberOfLines={1}>"{s.note}"</Text>
                  ) : null}
                  <Text style={styles.expenseDate}>{formatDate(s.created_at)}</Text>
                </View>
                <View style={[styles.settlementBadgePill]}>
                  <Text style={[styles.settlementBadgeText, { color: C.positive }]}>Settled</Text>
                </View>
              </View>
            );
          }

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
          const cat = getExpenseCategory(item.description);

          return (
            <View style={[styles.expenseRow, S.shadowSm]}>
              <TouchableOpacity
                onPress={item.image ? () => setReceiptViewItem(item) : undefined}
                activeOpacity={item.image ? 0.7 : 1}
                style={styles.expenseIconWrap}
              >
                <View style={[styles.expenseIcon, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>
                {item.image && (
                  <View style={[styles.receiptBadge, { backgroundColor: C.accent }]}>
                    <Ionicons name="receipt" size={8} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.expenseInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.expenseDesc}>{item.description}</Text>
                  {item.recurring && (
                    <Ionicons name="repeat" size={13} color={C.accent} />
                  )}
                </View>
                <Text style={styles.expenseSub}>
                  Paid by {paidByName} · {fmt(total, expCurrency)}{convStr ? ` (${convStr})` : ''}
                </Text>
                {shareLabel ? (
                  <Text style={[styles.expenseShare, { color: shareColor }]}>{shareLabel}</Text>
                ) : null}
                {item.notes ? (
                  <Text style={styles.expenseNotes} numberOfLines={2}>{item.notes}</Text>
                ) : null}
                <Text style={styles.expenseDate}>{formatDate(item.created_at)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleExpenseActions(item)}
                hitSlop={12}
                style={styles.menuBtn}
                activeOpacity={0.6}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Receipt viewer modal */}
      <Modal
        visible={!!receiptViewItem}
        animationType="fade"
        transparent
        onRequestClose={() => setReceiptViewItem(null)}
      >
        <View style={styles.receiptModalOverlay}>
          <SafeAreaView style={styles.receiptModalInner}>
            {/* Header */}
            <View style={styles.receiptModalHeader}>
              <Text style={styles.receiptModalTitle} numberOfLines={1}>
                {receiptViewItem?.description}
              </Text>
              <TouchableOpacity
                onPress={() => setReceiptViewItem(null)}
                style={styles.receiptModalClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={C.text} />
              </TouchableOpacity>
            </View>

            {/* Receipt photo */}
            {receiptViewItem?.image && (
              <Image
                source={{ uri: receiptViewItem.image }}
                style={styles.receiptModalImage}
                resizeMode="contain"
              />
            )}

            {/* Expense summary */}
            <ScrollView style={styles.receiptModalDetails} showsVerticalScrollIndicator={false}>
              {(() => {
                const e = receiptViewItem;
                if (!e) return null;
                const expCurrency = e.currency ?? group.currency ?? 'USD';
                const total = parseFloat(e.amount);
                const paidByName = e.paid_by.id === user?.id ? 'You' : (e.paid_by.name || e.paid_by.email);
                return (
                  <>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Paid by</Text>
                      <Text style={styles.receiptDetailValue}>{paidByName} · {fmt(total, expCurrency)}</Text>
                    </View>
                    {e.splits?.map((split: any) => {
                      const name = split.user.id === user?.id ? 'You' : (split.user.name || split.user.email);
                      return (
                        <View key={split.id} style={[styles.receiptDetailRow, styles.receiptDetailBorder]}>
                          <View style={styles.receiptSplitLeft}>
                            <Avatar name={split.user.name} email={split.user.email} avatar={split.user.avatar} size={26} fontSize={10} />
                            <Text style={styles.receiptDetailLabel}>{name}</Text>
                          </View>
                          <Text style={styles.receiptDetailValue}>{fmt(parseFloat(split.amount), expCurrency)}</Text>
                        </View>
                      );
                    })}
                  </>
                );
              })()}

              <View style={styles.receiptEditActions}>
                {receiptViewItem?.receipt_data && (
                  <TouchableOpacity
                    style={[styles.receiptEditBtn, { backgroundColor: C.accent, flex: 1 }]}
                    onPress={() => {
                      setReceiptViewItem(null);
                      navigation.navigate('ReceiptScan', { group, editExpense: receiptViewItem, onDone: load });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="receipt-outline" size={17} color="#fff" />
                    <Text style={styles.receiptEditBtnText}>Edit Items</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.receiptEditBtn, { backgroundColor: C.inputFillStrong, flex: 1 }]}
                  onPress={() => {
                    setReceiptViewItem(null);
                    navigation.navigate('EditExpense', { group, expense: receiptViewItem, onDone: load });
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={17} color={C.text} />
                  <Text style={[styles.receiptEditBtnText, { color: C.text }]}>Edit Details</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <BottomModal visible={buyInModal} onClose={() => setBuyInModal(false)}>
        <Text style={styles.modalTitle}>Buy In to Pot 🎮</Text>
        <View style={[styles.amountRow, S.shadowSm]}>
          <Text style={styles.amountCurrencySymbol}>{group.currency}</Text>
          <TextInput
            style={styles.amountInput}
            value={buyInAmount}
            onChangeText={setBuyInAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.placeholder}
            autoFocus
          />
        </View>
        <TextInput
          style={styles.input}
          value={buyInNote}
          onChangeText={setBuyInNote}
          placeholder="Note (optional)"
          placeholderTextColor={C.placeholder}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.modalBtn, { backgroundColor: '#BF5AF2' }, (!buyInAmount || buyInLoading) && { opacity: 0.6 }]}
          onPress={handleBuyIn}
          disabled={!buyInAmount || buyInLoading}
          activeOpacity={0.85}
        >
          {buyInLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.modalBtnText}>Contribute to Pot</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setBuyInModal(false)} style={styles.cancelWrap}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </BottomModal>

      <BottomModal visible={renameModal} onClose={() => setRenameModal(false)}>
        <Text style={styles.modalTitle}>Rename Group</Text>
        <TextInput
          style={styles.input}
          placeholder="Group name"
          placeholderTextColor={C.placeholder}
          value={newName}
          onChangeText={setNewName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleRenameGroup}
        />
        <TouchableOpacity
          style={[styles.modalBtn, (!newName.trim() || newName.trim() === group.name) && { opacity: 0.5 }]}
          onPress={handleRenameGroup}
          disabled={renaming || !newName.trim() || newName.trim() === group.name}
          activeOpacity={0.85}
        >
          {renaming
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.modalBtnText}>Save</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRenameModal(false)} style={styles.cancelWrap}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </BottomModal>

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

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 14,
    },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 8 },
    headerAvatarWrap: { width: 44, height: 44, borderRadius: 14 },
    headerAvatar: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    headerAvatarLetter: { fontSize: 18, fontWeight: '800', color: '#fff' },
    headerTitleGroup: { alignItems: 'flex-start', gap: 3, flexShrink: 1 },
    headerCameraBadge: {
      position: 'absolute',
      bottom: -3,
      right: -3,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: C.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },
    nameTapRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
    curBadge: {
      backgroundColor: C.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    curBadgeText: { fontSize: 11, color: C.accent, fontWeight: '700', letterSpacing: 0.2 },
    addMemberBtn: { fontSize: 14, color: C.accent, fontWeight: '600', width: 80, textAlign: 'right' },

    section: { paddingHorizontal: 16, marginTop: 24 },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      marginLeft: 4,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
      marginLeft: 4,
    },
    simplifyToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    simplifyLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    card: {
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
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
    settlementNames: { flex: 1, marginLeft: 4 },
    settlementText: { fontSize: 13, fontWeight: '600', color: C.text },
    settlementTextMuted: { fontWeight: '400', color: C.textSecondary },
    settlementAmount: { fontSize: 14, fontWeight: '700', color: C.accent },

    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
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
      marginTop: 28,
      marginBottom: 10,
    },
    expensesHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1.5,
      borderColor: C.accent,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    scanBtnText: { color: C.accent, fontWeight: '700', fontSize: 13 },
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
      marginBottom: 9,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    expenseIconWrap: {
      position: 'relative',
      marginRight: 13,
    },
    expenseIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
    },
    receiptBadge: {
      position: 'absolute',
      bottom: -3,
      right: -3,
      width: 16,
      height: 16,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: C.bg,
    },
    recurringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    recurringBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator },
    recurringIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    recurringInfo: { flex: 1 },
    recurringDesc: { fontSize: 14, fontWeight: '700', color: C.text },
    recurringSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },

    expenseThumb: {
      width: 40,
      height: 40,
      borderRadius: 12,
      marginRight: 12,
      resizeMode: 'cover',
    },
    expenseInfo: { flex: 1 },
    menuBtn: {
      paddingLeft: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    expenseDesc: { fontSize: 15, fontWeight: '700', color: C.text },
    expenseSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    expenseShare: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    expenseNotes: { fontSize: 12, color: C.textMuted, marginTop: 3, fontStyle: 'italic' },
    expenseDate: { fontSize: 11, color: C.textMuted, marginTop: 4 },
    settlementIcon: { backgroundColor: 'rgba(48,209,88,0.15)' },
    settlementBadgePill: {
      backgroundColor: 'rgba(48,209,88,0.12)',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    settlementBadgeText: { fontSize: 11, fontWeight: '700' },
    emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
    emptySub: { fontSize: 13, color: C.textSecondary, textAlign: 'center', lineHeight: 18 },


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

    // Gaming pot styles
    potCard: {
      borderRadius: 20,
      padding: 18,
      marginBottom: 4,
    },
    potCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    potIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    potIconEmoji: { fontSize: 24 },
    potCardInfo: { flex: 1 },
    potCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 2 },
    potCardBalance: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    potCardCurrency: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    potBtnRow: { flexDirection: 'row', gap: 10 },
    potBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: 14,
      paddingVertical: 11,
    },
    potBtnOutline: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    potBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    potTxnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    potTxnBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator },
    potTxnInfo: { flex: 1 },
    potTxnName: { fontSize: 14, fontWeight: '600', color: C.text },
    potTxnNote: { fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 1 },
    potTxnDate: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    potTxnRight: { alignItems: 'flex-end', gap: 4 },
    potTxnBadge: {
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    potTxnBadgeContrib: { backgroundColor: 'rgba(48,209,88,0.12)' },
    potTxnBadgePayout: { backgroundColor: 'rgba(255,159,10,0.12)' },
    potTxnBadgeText: { fontSize: 11, fontWeight: '700' },
    potTxnAmount: { fontSize: 13, fontWeight: '700', color: C.text },

    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.inputFill,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 4,
      marginBottom: 12,
    },
    amountCurrencySymbol: { fontSize: 18, fontWeight: '700', color: C.textSecondary, marginRight: 8 },
    amountInput: {
      flex: 1,
      fontSize: 26,
      fontWeight: '700',
      color: C.text,
      paddingVertical: 10,
    },

    // Receipt viewer modal
    receiptModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.88)',
    },
    receiptModalInner: {
      flex: 1,
    },
    receiptModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    receiptModalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: '#fff',
      flex: 1,
      marginRight: 12,
    },
    receiptModalClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    receiptModalImage: {
      width: '100%',
      flex: 1,
      minHeight: 200,
    },
    receiptModalDetails: {
      backgroundColor: C.bgElevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
      maxHeight: 320,
    },
    receiptDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    receiptDetailBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.separator,
    },
    receiptSplitLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    receiptDetailLabel: { fontSize: 14, color: C.text },
    receiptDetailValue: { fontSize: 14, fontWeight: '600', color: C.text },
    receiptEditActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      marginBottom: 8,
    },
    receiptEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
      paddingVertical: 15,
    },
    receiptEditBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
