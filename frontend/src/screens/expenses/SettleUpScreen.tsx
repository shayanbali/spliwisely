import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { createSettlement } from '../../services/expenses';
import Avatar from '../../components/common/Avatar';
import { fmt } from '../../utils/currency';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settle Up</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.userBox}>
          <Avatar name={transaction.from.name} email={transaction.from.email} avatar={transaction.from.avatar} size={56} />
          <Text style={styles.userName}>{transaction.from.name || transaction.from.email}</Text>
          <Text style={styles.userLabel}>pays</Text>
        </View>

        <Text style={styles.arrow}>→</Text>

        <View style={styles.userBox}>
          <Avatar name={transaction.to.name} email={transaction.to.email} avatar={transaction.to.avatar} size={56} />
          <Text style={styles.userName}>{transaction.to.name || transaction.to.email}</Text>
          <Text style={styles.userLabel}>receives</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Amount · {settleCurrency}</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Text style={styles.suggested}>
          Suggested: {fmt(parseFloat(transaction.amount), settleCurrency)}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSettle} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Record Payment</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: '#fff' },
  back: { fontSize: 16, color: '#e53935' },
  title: { fontSize: 18, fontWeight: '700' },
  card: { flexDirection: 'row', backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'space-around' },
  userBox: { alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '600' },
  userLabel: { fontSize: 12, color: '#999' },
  arrow: { fontSize: 28, color: '#1aa672' },
  section: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 16 },
  label: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 20, textAlign: 'center' },
  suggested: { textAlign: 'center', color: '#999', fontSize: 13, marginTop: 6 },
  button: { backgroundColor: '#1aa672', margin: 16, borderRadius: 12, padding: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
