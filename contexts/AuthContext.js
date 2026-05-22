import React, { createContext, useContext, useMemo, useState } from 'react';
import { apiRequest } from '../constants/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = async ({ email, password }) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    setToken(data.token);
    return data.user;
  };

  const register = async ({ name, email, phone, password }) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password }),
    });
    setUser(data.user);
    setToken(data.token);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, setUser, login, register, logout }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
