import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { apiRequest } from '../constants/api';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'financial-management/auth-session';

async function persistSession(user, token) {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(AUTH_STORAGE_KEY)
      .then((saved) => {
        if (!mounted || !saved) return;
        const session = JSON.parse(saved);
        if (session?.user && session?.token) {
          setUser(session.user);
          setToken(session.token);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const saveAuthSession = async (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    await persistSession(nextUser, nextToken);
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    if (token) {
      persistSession(nextUser, token).catch(() => {});
    }
  };

  const login = async ({ email, password }) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await saveAuthSession(data.user, data.token);
    return data.user;
  };

  const register = async ({ name, email, phone, password }) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password }),
    });
    await saveAuthSession(data.user, data.token);
    return data.user;
  };

  const socialLogin = async (provider, idToken, userInfo = {}) => {
    const data = await apiRequest('/auth/social-login', {
      method: 'POST',
      body: JSON.stringify({ provider, token: idToken, ...userInfo }),
    });
    await saveAuthSession(data.user, data.token);
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
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ user, token, authLoading, setUser: updateUser, login, register, socialLogin, logout }),
    [user, token, authLoading]
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
