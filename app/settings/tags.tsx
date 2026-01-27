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
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { PRESET_COLORS, Tag } from '../../types/settings';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../hooks/useTheme';
import { ColorPicker } from '../../components/ColorPicker';

export default function TagsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  
  const { tags, addTag, updateTag, deleteTag } = useSettings();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].color);
  const [showPicker, setShowPicker] = useState(false);

  const handleAddTag = async () => {
    if (!tagName.trim()) {
      Alert.alert('Error', 'Tag name cannot be empty');
      return;
    }
    await addTag(tagName.trim(), selectedColor);
    resetForm();
  };

  const handleUpdateTag = async () => {
    if (!tagName.trim()) {
      Alert.alert('Error', 'Tag name cannot be empty');
      return;
    }
    if (editingId) {
      await updateTag(editingId, tagName.trim(), selectedColor);
    }
    resetForm();
  };

  const handleDeleteTag = (id: string) => {
    Alert.alert('Delete Tag', 'Are you sure you want to delete this tag?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTag(id),
      },
    ]);
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setTagName(tag.name);
    setSelectedColor(tag.color);
    setIsAdding(true);
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setTagName('');
    setSelectedColor(PRESET_COLORS[0].color);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Tags</Text>
        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          style={styles.addButton}
          disabled={isAdding}
        >
          <Ionicons
            name="add"
            size={24}
            color={isAdding ? colors.mutedForeground : colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isAdding && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? 'Edit Tag' : 'New Tag'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Tag Name"
              placeholderTextColor={colors.mutedForeground}
              value={tagName}
              onChangeText={setTagName}
              autoFocus
            />
            <Text style={styles.label}>Color</Text>
            <TouchableOpacity 
              style={[styles.colorPreview, { backgroundColor: selectedColor }]}
              onPress={() => setShowPicker(true)}
            >
              <Ionicons name="color-palette" size={20} color="white" style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }} />
              <Text style={styles.colorPreviewText}>Change Color</Text>
            </TouchableOpacity>

            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={editingId ? handleUpdateTag : handleAddTag}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.tagsList}>
          {tags.map((tag) => (
            <View key={tag.id} style={styles.tagItem}>
              <View style={styles.tagInfo}>
                <View style={[styles.tagColor, { backgroundColor: tag.color }]} />
                <Text style={styles.tagName}>{tag.name}</Text>
              </View>
              <View style={styles.tagActions}>
                <TouchableOpacity
                  onPress={() => startEdit(tag)}
                  style={styles.actionButton}
                >
                  <Ionicons name="pencil-outline" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteTag(tag.id)}
                  style={styles.actionButton}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {tags.length === 0 && !isAdding && (
            <Text style={styles.emptyText}>No tags yet. Add one to get started!</Text>
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
  formCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  formTitle: {
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
  },
  saveButtonText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.base,
    color: colors.primaryForeground,
  },
  tagsList: {
    gap: spacing.md,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.soft,
  },
  tagInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tagColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  tagName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.lg,
    color: colors.foreground,
  },
  tagActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 40,
  },
});
