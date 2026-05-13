import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { convert, fmt, fmtConverted } from '../utils/currency';

interface CurrencyContextType {
  rates: Record<string, number>;
  preferredCurrency: string;
  /** Convert amount from fromCurrency to preferredCurrency. */
  toPreferred: (amount: number, fromCurrency: string) => number;
  /** Format in original currency, e.g. "€50.00" */
  format: (amount: number, currency: string) => string;
  /** Secondary conversion string, e.g. "≈ $54.20", or "" if same currency. */
  converted: (amount: number, originalCurrency: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const preferredCurrency = user?.preferred_currency ?? 'USD';

  useEffect(() => {
    api.get('/expenses/rates/').then(r => {
      setRates(r.data.rates);
    }).catch(() => {});
  }, []);

  const value: CurrencyContextType = {
    rates,
    preferredCurrency,
    toPreferred: (amount, from) => convert(amount, from, preferredCurrency, rates),
    format: fmt,
    converted: (amount, originalCurrency) =>
      fmtConverted(amount, originalCurrency, preferredCurrency, rates),
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
