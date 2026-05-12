import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../constants/api';
import { useAuth } from './AuthContext';

export const CATEGORIES = [
  { id: 'food', label: 'An uong', icon: 'restaurant', color: '#E91E8C' },
  { id: 'transport', label: 'Di chuyen', icon: 'car', color: '#178BFF' },
  { id: 'shopping', label: 'Mua sam', icon: 'bag-handle', color: '#FF9500' },
  { id: 'health', label: 'Suc khoe', icon: 'heart', color: '#00C853' },
  { id: 'entertainment', label: 'Giai tri', icon: 'game-controller', color: '#18A35B' },
  { id: 'education', label: 'Giao duc', icon: 'school', color: '#1976FF' },
  { id: 'home', label: 'Nha cua', icon: 'home', color: '#FF8A00' },
  { id: 'other', label: 'Khac', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Luong', icon: 'cash', color: '#008B47' },
  { id: 'bonus', label: 'Thuong', icon: 'gift', color: '#FF9500' },
  { id: 'interest', label: 'Lai tiet kiem', icon: 'business', color: '#1976FF' },
  { id: 'gift', label: 'Qua tang', icon: 'bag-handle', color: '#B0006D' },
  { id: 'income_other', label: 'Khac', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
];

const initialTransactions = [
  { id: 'tx-1', amount: 1500000, type: 'expense', category: 'food', note: 'An uong cuoi tuan', date: '26/04/2026' },
  { id: 'tx-2', amount: 1350000, type: 'expense', category: 'transport', note: 'Di chuyen', date: '25/04/2026' },
  { id: 'tx-3', amount: 900000, type: 'expense', category: 'home', note: 'Hoa don', date: '20/04/2026' },
  { id: 'tx-4', amount: 675000, type: 'expense', category: 'other', note: 'Chi phi khac', date: '18/04/2026' },
  { id: 'tx-5', amount: 8000000, type: 'income', category: 'salary', note: 'Luong thang', date: '15/04/2026' },
];

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [loading, setLoading] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) {
      setTransactions(initialTransactions);
      return;
    }

    let mounted = true;
    setLoading(true);
    apiRequest('/transactions', { headers: authHeaders })
      .then((data) => {
        if (mounted) {
          setTransactions(data.transactions || []);
        }
      })
      .catch(() => {
        if (mounted) {
          setTransactions([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const addTransaction = async (transaction) => {
    if (!token) {
      const localTransaction = { ...transaction, id: `tx-${Date.now()}` };
      setTransactions((current) => [localTransaction, ...current]);
      return localTransaction;
    }

    const data = await apiRequest('/transactions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(transaction),
    });
    setTransactions((current) => [data.transaction, ...current]);
    return data.transaction;
  };

  const updateTransaction = async (id, nextTransaction) => {
    if (!token) {
      setTransactions((current) =>
        current.map((item) => (item.id === id ? { ...item, ...nextTransaction, id } : item))
      );
      return;
    }

    const data = await apiRequest(`/transactions/${id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(nextTransaction),
    });
    setTransactions((current) =>
      current.map((item) => (item.id === id ? data.transaction : item))
    );
  };

  const deleteTransaction = async (id) => {
    if (token) {
      await apiRequest(`/transactions/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
    }
    setTransactions((current) => current.filter((item) => item.id !== id));
  };

  const value = useMemo(
    () => ({ transactions, loading, addTransaction, updateTransaction, deleteTransaction }),
    [transactions, loading, token]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used inside FinanceProvider');
  }
  return context;
}

export function getCategory(categoryId) {
  return (
    CATEGORIES.find((category) => category.id === categoryId) ||
    INCOME_CATEGORIES.find((category) => category.id === categoryId) ||
    CATEGORIES[CATEGORIES.length - 1]
  );
}

export function formatVnd(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')}d`;
}

export function parseTransactionDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const match = dateString.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
