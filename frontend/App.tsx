import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <StatusBar style="auto" />
        <Navigation />
      </CurrencyProvider>
    </AuthProvider>
  );
}
