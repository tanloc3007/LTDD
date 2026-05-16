import React, { createContext, useContext, useMemo, useState } from 'react';
import { accentOptions, buildThemeColors } from '../constants/theme';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [currency, setCurrency] = useState('VND'); // 'VND' or 'USD'
  const [accent, setAccent] = useState('pink');

  const colors = buildThemeColors(theme, accent);

  const formatCurrency = (amount) => {
    const val = Number(amount || 0);
    if (currency === 'USD') {
      return `$${(val / 25000).toFixed(2)}`;
    }
    return `${val.toLocaleString('vi-VN')} đ`;
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      currency,
      setCurrency,
      accent,
      setAccent,
      accentOptions,
      colors,
      formatCurrency,
    }),
    [theme, currency, accent, colors]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return context;
}
