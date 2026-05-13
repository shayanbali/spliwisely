import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { createSettlement } from '../../services/expenses';
import Avatar from '../../components/common/Avatar';
import { fmt } from '../../utils/currency';
import { C, S } from '../../theme';

export default function SettleUpScreen({ route, navigation }: any) {
  const { transaction, groupId, onDone } = route.params;
  const { user } = useAuth();
  const { preferredCurrency } = useCurrency();
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [loading, setLoading] = useState(false);

  const settleCurrency = transaction.currency ?? preferredCurrency;

  async function handleSettle() {
    setLoading(true);
    try {
      await createSettlement({
        payer_id: transaction.from.id,
        receiver_id: transaction.to.id,
        amount: parseFloat(amount),
        currency: settleCurrency,
        group: groupId,
      });
      onDone?.();
      navigation.goBack();
      Alert.alert('Done!', 'Settlement recorded.');
    } catch {
      Alert.alert('Error', 'Could not record settlement.');
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
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>Cancel</Text>
        </TouchableOpacity>
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

        <TouchableOpacity
          style={styles.button}
          onPress={handleSettle}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Record Payment</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 40 },

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
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  userLabel: { fontSize: 12, color: C.textSecondary },
  arrowWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(48,209,88,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  arrow: {
    fontSize: 20,
    color: C.accent,
    fontWeight: '800',
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 20,
    marginTop: 24,
    marginBottom: 8,
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
  suggested: {
    textAlign: 'center',
    color: C.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  button: {
    backgroundColor: C.accent,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
});
