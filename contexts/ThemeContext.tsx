import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors } from '@/constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'geology_qaqc_theme';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
        setThemeMode(stored as ThemeMode);
      }
      setIsLoaded(true);
    });
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const colors: ThemeColors = useMemo(() => {
    return isDark ? Colors.dark : Colors.light;
  }, [isDark]);

  return {
    themeMode,
    setTheme,
    isDark,
    colors,
    isLoaded,
  };
});
