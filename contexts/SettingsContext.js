import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accentOptions, buildThemeColors } from '../constants/theme';

const SettingsContext = createContext(null);
const SETTINGS_STORAGE_KEY = 'financial-management/settings';

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [currency, setCurrency] = useState('VND'); // 'VND' or 'USD'
  const [accent, setAccent] = useState('pink');

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((saved) => {
        if (!mounted || !saved) return;
        const settings = JSON.parse(saved);
        if (settings.theme === 'light' || settings.theme === 'dark') {
          setTheme(settings.theme);
        }
        if (settings.currency === 'VND' || settings.currency === 'USD') {
          setCurrency(settings.currency);
        }
        if (accentOptions.some((option) => option.key === settings.accent)) {
          setAccent(settings.accent);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ theme, currency, accent })
    ).catch(() => {});
  }, [theme, currency, accent]);

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
