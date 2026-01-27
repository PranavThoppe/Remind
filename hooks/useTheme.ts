import { useColorScheme } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';
import { getThemeColors } from '../constants/theme';

export const useTheme = () => {
  const { theme } = useSettings();
  const systemColorScheme = useColorScheme();
  
  const isDark = theme === 'system' 
    ? systemColorScheme === 'dark' 
    : theme === 'dark';
    
  const colors = getThemeColors(isDark);
  
  return {
    colors,
    isDark,
    themePreference: theme,
  };
};
