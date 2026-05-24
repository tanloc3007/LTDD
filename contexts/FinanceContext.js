import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../constants/api';
import { useAuth } from './AuthContext';

export const CATEGORIES = [
  { id: 'food', label: 'Ăn uống', icon: 'restaurant', color: '#E91E8C' },
  { id: 'transport', label: 'Di chuyển', icon: 'car', color: '#178BFF' },
  { id: 'shopping', label: 'Mua sắm', icon: 'bag-handle', color: '#FF9500' },
  { id: 'health', label: 'Sức khỏe', icon: 'heart', color: '#00C853' },
  { id: 'entertainment', label: 'Giải trí', icon: 'game-controller', color: '#18A35B' },
  { id: 'education', label: 'Giáo dục', icon: 'school', color: '#1976FF' },
  { id: 'home', label: 'Nhà cửa', icon: 'home', color: '#FF8A00' },
  { id: 'other', label: 'Khác', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Lương', icon: 'cash', color: '#008B47' },
  { id: 'bonus', label: 'Thưởng', icon: 'gift', color: '#FF9500' },
  { id: 'interest', label: 'Lãi tiết kiệm', icon: 'business', color: '#1976FF' },
  { id: 'gift', label: 'Quà tặng', icon: 'bag-handle', color: '#B0006D' },
  { id: 'income_other', label: 'Khác', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
];

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchTransactions = async () => {
    if (!token) {
      setTransactions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest('/transactions', { headers: authHeaders });
      setTransactions(data.transactions || []);
    } catch (error) {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  const addTransaction = async (transaction) => {
    if (!token) {
      throw new Error('Vui lòng đăng nhập để lưu dữ liệu.');
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
      throw new Error('Vui lòng đăng nhập để cập nhật dữ liệu.');
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
    if (!token) {
      throw new Error('Vui lòng đăng nhập để xóa dữ liệu.');
    }
    await apiRequest(`/transactions/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    setTransactions((current) => current.filter((item) => item.id !== id));
  };

  const value = useMemo(
    () => ({ transactions, loading, fetchTransactions, addTransaction, updateTransaction, deleteTransaction }),
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
  return `${Number(amount || 0).toLocaleString('vi-VN')}đ`;
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
