import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { ThemeProvider } from './src/context/ThemeContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
          <Navigation />
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
