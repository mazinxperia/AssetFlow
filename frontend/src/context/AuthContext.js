import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import api, { usersAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    // Check both cookie and localStorage
    const token = Cookies.get('auth_token') || localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Ensure token is in both places
    if (!Cookies.get('auth_token') && token) {
      Cookies.set('auth_token', token, { expires: 7, sameSite: 'lax' });
    }
    if (!localStorage.getItem('auth_token') && token) {
      localStorage.setItem('auth_token', token);
    }

    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data.user);
    } catch (err) {
      Cookies.remove('auth_token');
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/api/auth/login', { email, password });
      const { token, user: userData } = response.data;
      
      // Store token in both cookie and localStorage for reliability
      Cookies.set('auth_token', token, { expires: 7, sameSite: 'lax' });
      localStorage.setItem('auth_token', token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = useCallback(() => {
    Cookies.remove('auth_token');
    localStorage.removeItem('auth_token');
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  }, []);

  const updateUserPreferences = useCallback(async (preferences) => {
    const response = await usersAPI.updatePreferences(preferences);
    setUser(prev => prev ? ({
      ...prev,
      preferences: {
        ...(prev.preferences || {}),
        ...(response.data || {}),
      }
    }) : prev);
    return response.data;
  }, []);

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    updateUser,
    updateUserPreferences,
    isAuthenticated: !!user,
    // 3-role system: SUPER_ADMIN, ADMIN, USER
    isAdmin: user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    isReadOnly: user?.role === 'USER', // USER is view-only
    canWrite: user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN', // Can add/edit/delete
    canAccessSettings: user?.role === 'SUPER_ADMIN', // Only Super Admin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
