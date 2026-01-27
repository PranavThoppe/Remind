import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { PRESET_COLORS, PriorityLevel } from '../../types/settings';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';
import { ColorPicker } from '../../components/ColorPicker';

export default function PriorityScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  
  const { priorities, addPriority, updatePriority, deletePriority } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [priorityName, setPriorityName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#EF4444'); // Default to red
  const [isSaving, setIsSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleSavePriority = async () => {
    if (!priorityName.trim()) {
      Alert.alert('Error', 'Priority name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      if (isAdding) {
        const nextRank = priorities.length > 0 
          ? Math.max(...priorities.map(p => p.rank)) + 1 
          : 1;
        await addPriority(priorityName.trim(), selectedColor, nextRank);
        setIsAdding(false);
      } else if (editingId) {
        await updatePriority(editingId, priorityName.trim(), selectedColor);
        setEditingId(null);
      }
      
      setPriorityName('');
      setSelectedColor('#EF4444');
    } catch (error: any) {
      console.error('Failed to save priority:', error);
      Alert.alert('Error', 'Failed to save priority. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePriority = (id: string) => {
    Alert.alert(
      'Delete Priority',
      'Are you sure you want to delete this priority level? Reminders using this priority will no longer show it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              await deletePriority(id);
              setEditingId(null);
              setPriorityName('');
            } catch (error: any) {
              console.error('Failed to delete priority:', error);
              Alert.alert('Error', 'Failed to delete priority. Please try again.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  const startEdit = (priority: PriorityLevel) => {
    if (isSaving) return;
    setIsAdding(false);
    setEditingId(priority.id);
    setPriorityName(priority.name);
    setSelectedColor(priority.color);
  };

  const startAdd = () => {
    if (isSaving) return;
    setEditingId(null);
    setIsAdding(true);
    setPriorityName('');
    setSelectedColor('#EF4444'); // Default red for new ones
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Priority Levels</Text>
        <TouchableOpacity onPress={startAdd} style={styles.addButton} disabled={isSaving}>
          <Ionicons name="add" size={24} color={isSaving ? colors.mutedForeground : colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>
          Define priority levels (1, 2, 3...) for your reminders. New levels default to red.
        </Text>

        {(editingId || isAdding) && (
          <View style={styles.editCard}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>{isAdding ? 'Add Priority' : 'Edit Priority'}</Text>
              {!isAdding && editingId && (
                <TouchableOpacity onPress={() => handleDeletePriority(editingId)} disabled={isSaving}>
                  <Ionicons name="trash-outline" size={20} color={isSaving ? colors.mutedForeground : colors.destructive} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Priority Name (e.g. High, P1, Urgent)"
              placeholderTextColor={colors.mutedForeground}
              value={priorityName}
              onChangeText={setPriorityName}
              autoFocus
              editable={!isSaving}
            />
            <Text style={styles.label}>Color</Text>
            <TouchableOpacity 
              style={[styles.colorPreview, { backgroundColor: selectedColor }]}
              onPress={() => setShowPicker(true)}
              disabled={isSaving}
            >
              <Ionicons name="color-palette" size={20} color="white" style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }} />
              <Text style={styles.colorPreviewText}>Change Color</Text>
            </TouchableOpacity>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditingId(null);
                  setIsAdding(false);
                }}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, isSaving && { opacity: 0.7 }]} 
                onPress={handleSavePriority}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>{isAdding ? 'Add' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.prioritiesList}>
          {priorities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No priorities defined yet.</Text>
              <TouchableOpacity onPress={startAdd} disabled={isSaving}>
                <Text style={styles.emptyStateLink}>Add your first priority level</Text>
              </TouchableOpacity>
            </View>
          ) : (
            priorities.map((priority) => (
              <TouchableOpacity
                key={priority.id}
                style={[
                  styles.priorityItem,
                  editingId === priority.id && styles.activePriorityItem,
                ]}
                onPress={() => startEdit(priority)}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                <View style={styles.priorityInfo}>
                  <Text style={styles.priorityRank}>{priority.rank}.</Text>
                  <View style={[styles.priorityColor, { backgroundColor: priority.color }]} />
                  <Text style={styles.priorityName}>{priority.name}</Text>
                </View>
                <Ionicons name="pencil-outline" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <ColorPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        selectedColor={selectedColor}
        onSelect={setSelectedColor}
        colors={colors}
      />
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
  addButton: {
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
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  editTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  colorPreview: {
    height: 48,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    ...shadows.soft,
  },
  colorPreviewText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.base,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    minWidth: 80,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  priorityRank: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.primary,
    width: 24,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  emptyStateLink: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.base,
    color: colors.primary,
  },
});
