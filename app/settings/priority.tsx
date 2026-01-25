import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { PRESET_COLORS, PriorityLevel } from '../../types/settings';
import { useSettings } from '../../contexts/SettingsContext';

export default function PriorityScreen() {
  const insets = useSafeAreaInsets();
  const { priorities, updatePriority } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priorityName, setPriorityName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].color);

  const handleUpdatePriority = async () => {
    if (!priorityName.trim()) {
      Alert.alert('Error', 'Priority name cannot be empty');
      return;
    }
    if (editingId) {
      await updatePriority(editingId, priorityName.trim(), selectedColor);
    }
    setEditingId(null);
    setPriorityName('');
  };

  const startEdit = (priority: PriorityLevel) => {
    setEditingId(priority.id);
    setPriorityName(priority.name);
    setSelectedColor(priority.color);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Priority Levels</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>
          Customize the names and colors for each priority level.
        </Text>

        {editingId && (
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit Level</Text>
            <TextInput
              style={styles.input}
              placeholder="Priority Name"
              value={priorityName}
              onChangeText={setPriorityName}
              autoFocus
            />
            <Text style={styles.label}>Select Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((item) => (
                <TouchableOpacity
                  key={item.color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: item.color },
                    selectedColor === item.color && styles.selectedColor,
                  ]}
                  onPress={() => setSelectedColor(item.color)}
                >
                  {selectedColor === item.color && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditingId(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdatePriority}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.prioritiesList}>
          {priorities.map((priority) => (
            <TouchableOpacity
              key={priority.id}
              style={[
                styles.priorityItem,
                editingId === priority.id && styles.activePriorityItem,
              ]}
              onPress={() => startEdit(priority)}
              activeOpacity={0.7}
            >
              <View style={styles.priorityInfo}>
                <View style={[styles.priorityColor, { backgroundColor: priority.color }]} />
                <Text style={styles.priorityName}>{priority.name}</Text>
              </View>
              <Ionicons name="pencil-outline" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    marginBottom: spacing.xl,
  },
  editCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  editTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: colors.foreground,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  saveButtonText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.base,
    color: colors.primaryForeground,
  },
  prioritiesList: {
    gap: spacing.md,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.soft,
  },
  activePriorityItem: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  priorityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  priorityColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  priorityName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
  },
});
