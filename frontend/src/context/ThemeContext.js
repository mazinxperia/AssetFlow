import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI, filesAPI, usersAPI } from '../services/api';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

// Helper to convert hex to RGB values
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : null;
};

export function ThemeProvider({ children }) {
  const { user, loading: authLoading, updateUser } = useAuth();
  const userId = user?.id;
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('assetflow-theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [glassMode, setGlassMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('assetflow-glass-mode');
      return saved === 'true';
    }
    return false;
  });

  const [accentColor, setAccentColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('assetflow-accent-color') || '#4F46E5';
    }
    return '#4F46E5';
  });

  const [wallpaperUrl, setWallpaperUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('assetflow-wallpaper-url') || '';
    }
    return '';
  });

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const loadSettingsFromDB = useCallback(async () => {
    if (authLoading) return;
    if (!userId) {
      setSettingsLoaded(true);
      return;
    }

    try {
      setSettingsLoaded(false);
      const [settingsResponse, preferencesResponse] = await Promise.all([
        settingsAPI.getAppSettings(),
        usersAPI.getPreferences(),
      ]);

      const appSettings = settingsResponse.data || {};
      const preferences = preferencesResponse.data || {};

      if (preferences.theme) {
        setTheme(preferences.theme);
      }
      if (typeof preferences.glassMode === 'boolean') {
        setGlassMode(preferences.glassMode);
      } else if (typeof appSettings.glassMode === 'boolean') {
        setGlassMode(appSettings.glassMode);
      }
      if (preferences.accentColor) {
        setAccentColor(preferences.accentColor);
      } else if (appSettings.accentColor) {
        setAccentColor(appSettings.accentColor);
      }

      if (appSettings.wallpaperFileId) {
        const url = filesAPI.getUrl(appSettings.wallpaperFileId);
        setWallpaperUrl(url);
        localStorage.setItem('assetflow-wallpaper-url', url);
      } else {
        setWallpaperUrl('');
        localStorage.removeItem('assetflow-wallpaper-url');
      }
      updateUser?.({ preferences });
    } catch (error) {
      console.log('Failed to load theme settings from DB');
    } finally {
      setSettingsLoaded(true);
    }
  }, [authLoading, updateUser, userId]);

  useEffect(() => {
    loadSettingsFromDB();
  }, [loadSettingsFromDB]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('assetflow-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (glassMode) {
      root.classList.add('glass-mode');
    } else {
      root.classList.remove('glass-mode');
    }
    localStorage.setItem('assetflow-glass-mode', glassMode);
  }, [glassMode]);

  // Apply accent color as CSS variable
  useEffect(() => {
    const root = window.document.documentElement;
    const rgbValue = hexToRgb(accentColor);
    if (rgbValue) {
      root.style.setProperty('--primary', rgbValue);
      root.style.setProperty('--ring', rgbValue);
    }
    localStorage.setItem('assetflow-accent-color', accentColor);
  }, [accentColor]);

  // Store wallpaper URL in localStorage
  useEffect(() => {
    localStorage.setItem('assetflow-wallpaper-url', wallpaperUrl);
  }, [wallpaperUrl]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleGlassMode = () => {
    setGlassMode(prev => !prev);
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    glassMode,
    setGlassMode,
    toggleGlassMode,
    accentColor,
    setAccentColor,
    wallpaperUrl,
    setWallpaperUrl,
    settingsLoaded,
    reloadSettings: loadSettingsFromDB,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
