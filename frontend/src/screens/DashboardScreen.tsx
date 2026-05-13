import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function DashboardScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {user?.name || user?.email}!</Text>
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  welcome: { fontSize: 18, fontWeight: '600' },
  button: { backgroundColor: '#e53935', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
