import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ColorPicker } from '../../components/ColorPicker';
import { OnboardingShell } from '../../components/OnboardingShell';
import { DEFAULT_TAGS, PRESET_COLORS } from '../../constants/settings';
import { borderRadius, shadows, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { Tag, useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';

export default function TagsScreen() {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const { draft, updateDraft, saveStep, totalSteps } = useOnboarding();
    const { user } = useAuth();
    const tags = draft.tags;

    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tagName, setTagName] = useState('');
    const [tagDescription, setTagDescription] = useState('');
    const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].color);
    const [showPicker, setShowPicker] = useState(false);

    useEffect(() => {
        if (tags.length === 0) {
            updateDraft({ tags: DEFAULT_TAGS });
        }
    }, []);

    const handleAddTag = () => {
        if (!tagName.trim()) {
            Alert.alert('Error', 'Tag name cannot be empty');
            return;
        }
        const newTag: Tag = {
            id: Math.random().toString(36).substring(7),
            name: tagName.trim(),
            color: selectedColor,
            description: tagDescription.trim() || undefined,
        };
        updateDraft({ tags: [...tags, newTag] });
        resetForm();
    };

    const handleUpdateTag = () => {
        if (!tagName.trim()) {
            Alert.alert('Error', 'Tag name cannot be empty');
            return;
        }
        if (editingId) {
            const updated = tags.map(t =>
                t.id === editingId
                    ? { ...t, name: tagName.trim(), color: selectedColor, description: tagDescription.trim() || undefined }
                    : t
            );
            updateDraft({ tags: updated });
        }
        resetForm();
    };

    const handleDeleteTag = (id: string) => {
        Alert.alert('Delete Tag', 'Are you sure you want to delete this tag?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    updateDraft({ tags: tags.filter((t) => t.id !== id) });
                },
            },
        ]);
    };

    const startEdit = (tag: Tag) => {
        setEditingId(tag.id);
        setTagName(tag.name);
        setTagDescription(tag.description || '');
        setSelectedColor(tag.color);
        setIsAdding(true);
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingId(null);
        setTagName('');
        setTagDescription('');
        setSelectedColor(PRESET_COLORS[0].color);
    };

    const saveTagsToDatabase = async () => {
        if (!user) {
            console.warn('[Tags] No active user found!');
            Alert.alert('Not Logged In', 'Could not save tags because no active user session was found.');
            return false;
        }

        try {
            console.log(`[Tags] Saving tags for user ${user.id}`);

            // First, delete existing tags for this user to ensure sync
            const { error: deleteError } = await supabase
                .from('tags')
                .delete()
                .eq('user_id', user.id);

            if (deleteError) {
                console.error('[Tags] Error deleting old tags:', deleteError);
                Alert.alert('Database Error', 'Failed to clear old tags: ' + deleteError.message);
                return false;
            }

            // Then, insert the new tags
            if (tags.length > 0) {
                const tagsToInsert = tags.map(tag => ({
                    user_id: user.id,
                    name: tag.name,
                    color: tag.color,
                    description: tag.description,
                }));

                const { error: insertError } = await supabase
                    .from('tags')
                    .insert(tagsToInsert);

                if (insertError) {
                    console.error('[Tags] Error inserting new tags:', insertError);
                    Alert.alert('Database Error', 'Failed to save tags: ' + insertError.message);
                    return false;
                }
            }

            return true;
        } catch (error: any) {
            console.error('[Tags] Unexpected error:', error);
            Alert.alert('Unexpected Error', 'An error occurred while saving: ' + error.message);
            return false;
        }
    };

    const handleNext = async () => {
        const success = await saveTagsToDatabase();
        if (success) {
            await saveStep(6);
            router.push('/(onboarding)/priorities');
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(onboarding)/common-times');
        }
    };

    const handleSkip = async () => {
        await saveStep(6);
        router.push('/(onboarding)/priorities');
    };

    return (
        <OnboardingShell
            currentStep={6}
            totalSteps={totalSteps}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
            nextLabel="Next"
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
                    <View style={styles.headerContainer}>
                        <Text style={styles.title}>What kind of reminders do you need?</Text>
                        <Text style={styles.subtitle}>
                            Tags help AI understand context. We've added some defaults, but feel free to customize them.
                        </Text>
                    </View>

                    {!isAdding && (
                        <TouchableOpacity
                            onPress={() => setIsAdding(true)}
                            style={styles.addButton}
                        >
                            <Ionicons name="add" size={20} color={colors.primary} />
                            <Text style={styles.addButtonText}>Create Custom Tag</Text>
                        </TouchableOpacity>
                    )}

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
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="Description (Optional, gives AI context)"
                                placeholderTextColor={colors.mutedForeground}
                                value={tagDescription}
                                onChangeText={setTagDescription}
                                multiline
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
                                    <View style={styles.tagTextContainer}>
                                        <Text style={styles.tagName}>{tag.name}</Text>
                                        {tag.description ? (
                                            <Text style={styles.tagDescription} numberOfLines={1}>
                                                {tag.description}
                                            </Text>
                                        ) : null}
                                    </View>
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
                </Pressable>
            </ScrollView>

            <ColorPicker
                visible={showPicker}
                onClose={() => setShowPicker(false)}
                selectedColor={selectedColor}
                onSelect={setSelectedColor}
                colors={colors}
            />
        </OnboardingShell>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 40,
    },
    headerContainer: {
        marginBottom: spacing.xl,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'] || 30,
        color: colors.foreground,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
        lineHeight: 24,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        marginBottom: spacing.xl,
        gap: spacing.sm,
    },
    addButtonText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        color: colors.primary,
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
        flex: 1,
    },
    tagColor: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    tagTextContainer: {
        flex: 1,
    },
    tagName: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.lg,
        color: colors.foreground,
    },
    tagDescription: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.sm,
        color: colors.mutedForeground,
        marginTop: 2,
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
