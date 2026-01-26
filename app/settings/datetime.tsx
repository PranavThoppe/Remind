import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';

export default function DateTimeScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  
  const {
    timeFormat,
    setTimeFormat,
    weekStart,
    setWeekStart,
    showRelativeDates,
    setShowRelativeDates,
  } = useSettings();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Date & Time</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Time Display</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setTimeFormat('12h')}
          >
            <Text style={styles.rowLabel}>12-hour (AM/PM)</Text>
            {timeFormat === '12h' && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.borderTop]}
            onPress={() => setTimeFormat('24h')}
          >
            <Text style={styles.rowLabel}>24-hour</Text>
            {timeFormat === '24h' && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Calendar</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Week Starts On</Text>
            <View style={styles.picker}>
              <TouchableOpacity
                onPress={() => setWeekStart('Sunday')}
                style={[
                  styles.pickerOption,
                  weekStart === 'Sunday' && styles.pickerOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerText,
                    weekStart === 'Sunday' && styles.pickerTextActive,
                  ]}
                >
                  Sun
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setWeekStart('Monday')}
                style={[
                  styles.pickerOption,
                  weekStart === 'Monday' && styles.pickerOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerText,
                    weekStart === 'Monday' && styles.pickerTextActive,
                  ]}
                >
                  Mon
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.row, styles.borderTop]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Show Relative Dates</Text>
              <Text style={styles.rowSublabel}>
                Use "Today", "Tomorrow" instead of full dates
              </Text>
            </View>
            <Switch
              value={showRelativeDates}
              onValueChange={setShowRelativeDates}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : colors.card}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
  },
  rowSublabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  picker: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 4,
  },
  pickerOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
  },
  pickerOptionActive: {
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  pickerText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
  },
  pickerTextActive: {
    color: colors.primary,
  },
});
