import React, { createContext, useContext, useMemo, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
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

  const socialLogin = async (provider, idToken, userInfo = {}) => {
    const data = await apiRequest('/auth/social-login', {
      method: 'POST',
      body: JSON.stringify({ provider, token: idToken, ...userInfo }),
    });
    setUser(data.user);
    setToken(data.token);
    return data.user;
  };

  const logout = async () => {
    try {
      const hasPreviousSignIn = GoogleSignin.hasPreviousSignIn();
      if (hasPreviousSignIn) {
        await GoogleSignin.signOut();
      }
    } catch (error) {
      // Keep local logout working even if the Google session cannot be cleared.
    }

    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, setUser, login, register, socialLogin, logout }),
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
