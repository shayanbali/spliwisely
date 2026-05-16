import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { createSettlement } from '../../services/expenses';
import { transferCredits } from '../../services/credits';
import BackButton from '../../components/common/BackButton';
import Avatar from '../../components/common/Avatar';
import { fmt } from '../../utils/currency';
import { S, ThemeColors } from '../../theme';

export default function SettleUpScreen({ route, navigation }: any) {
  const { transaction, groupId, onDone } = route.params;
  const { user } = useAuth();
  const { preferredCurrency } = useCurrency();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [useCredits, setUseCredits] = useState(false);
  const [loading, setLoading] = useState(false);

  const settleCurrency = transaction.currency ?? preferredCurrency;
  const iAmPayer = user?.id === transaction.from.id;
  const creditBalance = parseFloat(user?.credits_balance ?? '0');
  const parsedAmount = parseFloat(amount) || 0;
  const hasEnoughCredits = creditBalance >= parsedAmount;
  const effectiveUseCredits = iAmPayer && useCredits;

  async function handleSettle() {
    setLoading(true);
    try {
      if (effectiveUseCredits) {
        if (!hasEnoughCredits) {
          Alert.alert('Insufficient Credits', `You need ${fmt(parsedAmount, settleCurrency)} in credits but only have ${creditBalance.toFixed(2)} SC.`);
          return;
        }
        await transferCredits({
          to_user_id: transaction.to.id,
          amount: parsedAmount,
          currency: settleCurrency,
          create_settlement: true,
          group_id: groupId ?? null,
        });
      } else {
        await createSettlement({
          payer_id: transaction.from.id,
          receiver_id: transaction.to.id,
          amount: parsedAmount,
          currency: settleCurrency,
          group: groupId,
        });
      }
      onDone?.();
      navigation.goBack();
      Alert.alert('Done!', effectiveUseCredits ? 'Settled with Splitwise Credits.' : 'Settlement recorded.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Could not record settlement.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Settle Up</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, S.shadowSm]}>
          <View style={styles.userBox}>
            <Avatar
              name={transaction.from.name}
              email={transaction.from.email}
              avatar={transaction.from.avatar}
              size={56}
            />
            <Text style={styles.userName}>
              {transaction.from.name || transaction.from.email}
            </Text>
            <Text style={styles.userLabel}>pays</Text>
          </View>

          <View style={styles.arrowWrap}>
            <Ionicons name="arrow-forward" size={22} color={C.textSecondary} />
          </View>

          <View style={styles.userBox}>
            <Avatar
              name={transaction.to.name}
              email={transaction.to.email}
              avatar={transaction.to.avatar}
              size={56}
            />
            <Text style={styles.userName}>
              {transaction.to.name || transaction.to.email}
            </Text>
            <Text style={styles.userLabel}>receives</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Amount · {settleCurrency}</Text>
        <View style={[styles.section, S.shadowSm]}>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholderTextColor={C.placeholder}
          />
          <Text style={styles.suggested}>
            Suggested: {fmt(parseFloat(transaction.amount), settleCurrency)}
          </Text>
        </View>

        {/* Pay with Credits toggle — only shown when current user is the payer */}
        {iAmPayer && <Text style={styles.sectionLabel}>Payment Method</Text>}
        {iAmPayer && <View style={[styles.section, S.shadowSm, { padding: 0, overflow: 'hidden' }]}>
          <TouchableOpacity
            style={[styles.payMethodRow, !useCredits && styles.payMethodActive]}
            onPress={() => setUseCredits(false)}
            activeOpacity={0.7}
          >
            <View style={[styles.payMethodIcon, { backgroundColor: 'rgba(48,209,88,0.15)' }]}>
              <Ionicons name="cash-outline" size={18} color={C.positive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payMethodLabel}>Mark as Paid</Text>
              <Text style={styles.payMethodSub}>Record an outside payment</Text>
            </View>
            {!useCredits && <Ionicons name="checkmark-circle" size={20} color={C.accent} />}
          </TouchableOpacity>

          <View style={styles.methodSep} />

          <TouchableOpacity
            style={[styles.payMethodRow, useCredits && styles.payMethodActive]}
            onPress={() => setUseCredits(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.payMethodIcon, { backgroundColor: 'rgba(94,92,230,0.15)' }]}>
              <Ionicons name="wallet-outline" size={18} color="#5E5CE6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payMethodLabel}>Pay with Credits</Text>
              <Text style={[
                styles.payMethodSub,
                !hasEnoughCredits && useCredits && { color: C.negative },
              ]}>
                Balance: {creditBalance.toFixed(2)} SC
                {useCredits && !hasEnoughCredits ? ' — insufficient' : ''}
              </Text>
            </View>
            {useCredits && <Ionicons name="checkmark-circle" size={20} color="#5E5CE6" />}
          </TouchableOpacity>
        </View>}

        <TouchableOpacity
          style={[
            styles.button,
            effectiveUseCredits && { backgroundColor: '#5E5CE6', shadowColor: '#5E5CE6' },
            (loading || (effectiveUseCredits && !hasEnoughCredits)) && { opacity: 0.6 },
          ]}
          onPress={handleSettle}
          disabled={loading || (effectiveUseCredits && !hasEnoughCredits)}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <Ionicons
                  name={effectiveUseCredits ? 'wallet' : 'checkmark-circle'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.buttonText}>
                  {effectiveUseCredits ? 'Pay with Credits' : 'Record Payment'}
                </Text>
              </>
            )
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 12,
    },
    title: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 },

    card: {
      flexDirection: 'row',
      backgroundColor: C.bgElevated,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    userBox: { alignItems: 'center', gap: 6, flex: 1 },
    userName: { fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'center' },
    userLabel: { fontSize: 12, color: C.textSecondary },
    arrowWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.accentSoft,
      alignItems: 'center', justifyContent: 'center',
      marginHorizontal: 8,
    },

    sectionLabel: {
      fontSize: 13, fontWeight: '600', color: C.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginLeft: 20, marginTop: 24, marginBottom: 8,
    },
    section: {
      backgroundColor: C.bgElevated,
      marginHorizontal: 16,
      borderRadius: 20,
      padding: 16,
    },
    input: {
      backgroundColor: C.inputFill,
      borderWidth: 0,
      borderRadius: 14,
      padding: 16,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      color: C.text,
    },
    suggested: { textAlign: 'center', color: C.textSecondary, fontSize: 13, marginTop: 10 },

    payMethodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    payMethodActive: { backgroundColor: C.accentSoft },
    payMethodIcon: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center',
    },
    payMethodLabel: { fontSize: 15, fontWeight: '600', color: C.text },
    payMethodSub: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
    methodSep: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 62 },

    button: {
      backgroundColor: C.accent,
      marginHorizontal: 16,
      marginTop: 24,
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    buttonText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  });
}
