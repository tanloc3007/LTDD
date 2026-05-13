import React, { createContext, useContext, useState, useMemo } from 'react';
import { lightColors, darkColors } from '../constants/theme';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [currency, setCurrency] = useState('VND'); // 'VND' or 'USD'

  const colors = theme === 'dark' ? darkColors : lightColors;

  const formatCurrency = (amount) => {
    const val = Number(amount || 0);
    if (currency === 'USD') {
      return `$${(val / 25000).toFixed(2)}`; // Giả lập tỷ giá 25000 VND = 1 USD
    }
    return `${val.toLocaleString('vi-VN')} đ`;
  };

  const value = useMemo(() => ({
    theme, setTheme,
    currency, setCurrency,
    colors,
    formatCurrency
  }), [theme, currency, colors]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return context;
}
