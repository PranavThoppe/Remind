import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    LayoutAnimation,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { ColorPicker } from '../../components/ColorPicker';
import { OnboardingShell } from '../../components/OnboardingShell';
import { DEFAULT_PRIORITIES } from '../../constants/settings';
import { borderRadius, shadows, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { PriorityLevel, useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PrioritiesScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const { draft, updateDraft, saveStep, totalSteps } = useOnboarding();
    const { user } = useAuth();
    const priorities = draft.priorities;

    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [priorityName, setPriorityName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#EF4444');
    const [showPicker, setShowPicker] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    useEffect(() => {
        if (priorities.length === 0) {
            updateDraft({ priorities: DEFAULT_PRIORITIES });
        }
    }, []);

    const handleSavePriority = () => {
        if (!priorityName.trim()) {
            Alert.alert('Error', 'Priority name cannot be empty');
            return;
        }

        if (isAdding) {
            const nextRank = priorities.length > 0
                ? Math.max(...priorities.map(p => p.rank)) + 1
                : 1;
            const newPriority: PriorityLevel = {
                id: Math.random().toString(36).substring(7),
                name: priorityName.trim(),
                color: selectedColor,
                rank: nextRank,
            };
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            updateDraft({ priorities: [...priorities, newPriority] });
            resetForm();
        } else if (editingId) {
            const updated = priorities.map(p =>
                p.id === editingId
                    ? { ...p, name: priorityName.trim(), color: selectedColor }
                    : p
            );
            updateDraft({ priorities: updated });
            resetForm();
        }
    };

    const handleDeletePriority = (id: string) => {
        Alert.alert('Delete Priority', 'Are you sure you want to delete this priority level?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    const filtered = priorities.filter((p) => p.id !== id);
                    const updated = filtered.map((p, index) => ({ ...p, rank: index + 1 }));
                    updateDraft({ priorities: updated });
                    if (editingId === id) resetForm();
                },
            },
        ]);
    };

    const startEdit = (priority: PriorityLevel) => {
        setIsAdding(false);
        setEditingId(priority.id);
        setPriorityName(priority.name);
        setSelectedColor(priority.color);
    };

    const startAdd = () => {
        setEditingId(null);
        setIsAdding(true);
        setPriorityName('');
        setSelectedColor('#EF4444');
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingId(null);
        setPriorityName('');
        setSelectedColor('#EF4444');
    };

    // Move item up or down
    const moveItem = (id: string, direction: 'up' | 'down') => {
        const sorted = [...priorities].sort((a, b) => a.rank - b.rank);
        const idx = sorted.findIndex(p => p.id === id);
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === sorted.length - 1) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const newArr = [...sorted];
        [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        updateDraft({ priorities: newArr.map((p, i) => ({ ...p, rank: i + 1 })) });
    };

    const savePrioritiesToDatabase = async () => {
        if (!user) {
            console.warn('[Priorities] No active user found!');
            Alert.alert('Not Logged In', 'Could not save priorities because no active user session was found.');
            return false;
        }

        try {
            console.log(`[Priorities] Saving priorities for user ${user.id}`);

            // First, delete existing priorities for this user to ensure sync
            const { error: deleteError } = await supabase
                .from('priorities')
                .delete()
                .eq('user_id', user.id);

            if (deleteError) {
                console.error('[Priorities] Error deleting old priorities:', deleteError);
                Alert.alert('Database Error', 'Failed to clear old priorities: ' + deleteError.message);
                return false;
            }

            // Then, insert the new priorities
            if (priorities.length > 0) {
                const prioritiesToInsert = priorities.map(priority => ({
                    user_id: user.id,
                    name: priority.name,
                    color: priority.color,
                    rank: priority.rank,
                }));

                const { error: insertError } = await supabase
                    .from('priorities')
                    .insert(prioritiesToInsert);

                if (insertError) {
                    console.error('[Priorities] Error inserting new priorities:', insertError);
                    Alert.alert('Database Error', 'Failed to save priorities: ' + insertError.message);
                    return false;
                }
            }

            return true;
        } catch (error: any) {
            console.error('[Priorities] Unexpected error:', error);
            Alert.alert('Unexpected Error', 'An error occurred while saving: ' + error.message);
            return false;
        }
    };

    const handleNext = async () => {
        const success = await savePrioritiesToDatabase();
        if (success) {
            await saveStep(7);
            router.push('/(onboarding)/complete');
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(onboarding)/tags');
        }
    };

    const handleSkip = async () => {
        await saveStep(7);
        router.push('/(onboarding)/complete');
    };

    const sorted = [...priorities].sort((a, b) => a.rank - b.rank);

    return (
        <OnboardingShell
            currentStep={7}
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
                        <Text style={styles.title}>Priority Levels</Text>
                        <Text style={styles.subtitle}>
                            Define priority levels for your reminders. Use the arrows to reorder them.
                        </Text>
                    </View>

                    {!isAdding && !editingId && (
                        <TouchableOpacity onPress={startAdd} style={styles.addButton}>
                            <Ionicons name="add" size={20} color={colors.primary} />
                            <Text style={styles.addButtonText}>Add Priority</Text>
                        </TouchableOpacity>
                    )}

                    {(isAdding || editingId) && (
                        <View style={styles.formCard}>
                            <Text style={styles.formTitle}>
                                {isAdding ? 'New Priority' : 'Edit Priority'}
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Priority Name (e.g. High, P1, Urgent)"
                                placeholderTextColor={colors.mutedForeground}
                                value={priorityName}
                                onChangeText={setPriorityName}
                                autoFocus
                            />
                            <Text style={styles.label}>Color</Text>
                            <TouchableOpacity
                                style={[styles.colorPreview, { backgroundColor: selectedColor }]}
                                onPress={() => setShowPicker(true)}
                            >
                                <Ionicons
                                    name="color-palette"
                                    size={20}
                                    color="white"
                                    style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
                                />
                                <Text style={styles.colorPreviewText}>Change Color</Text>
                            </TouchableOpacity>

                            <View style={styles.formButtons}>
                                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveButton} onPress={handleSavePriority}>
                                    <Text style={styles.saveButtonText}>{isAdding ? 'Add' : 'Save'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={styles.prioritiesList}>
                        {sorted.length === 0 && !isAdding ? (
                            <Text style={styles.emptyText}>No priorities defined yet. Add one to get started!</Text>
                        ) : (
                            sorted.map((priority, idx) => {
                                const isEditing = editingId === priority.id;
                                return (
                                    <View
                                        key={priority.id}
                                        style={[
                                            styles.priorityItem,
                                            isEditing && styles.activePriorityItem,
                                        ]}
                                    >
                                        {/* Reorder arrows */}
                                        <View style={styles.arrowContainer}>
                                            <TouchableOpacity
                                                onPress={() => moveItem(priority.id, 'up')}
                                                style={[styles.arrowButton, idx === 0 && styles.arrowDisabled]}
                                                disabled={idx === 0}
                                            >
                                                <Ionicons
                                                    name="chevron-up"
                                                    size={18}
                                                    color={idx === 0 ? colors.border : colors.mutedForeground}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => moveItem(priority.id, 'down')}
                                                style={[styles.arrowButton, idx === sorted.length - 1 && styles.arrowDisabled]}
                                                disabled={idx === sorted.length - 1}
                                            >
                                                <Ionicons
                                                    name="chevron-down"
                                                    size={18}
                                                    color={idx === sorted.length - 1 ? colors.border : colors.mutedForeground}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Priority info */}
                                        <View style={styles.priorityInfo}>
                                            <Text style={styles.priorityRank}>{priority.rank}.</Text>
                                            <View style={[styles.priorityColor, { backgroundColor: priority.color }]} />
                                            <Text style={styles.priorityName}>{priority.name}</Text>
                                        </View>

                                        {/* Edit / Delete */}
                                        <View style={styles.tagActions}>
                                            <TouchableOpacity
                                                onPress={() => startEdit(priority)}
                                                style={styles.actionButton}
                                            >
                                                <Ionicons name="pencil-outline" size={20} color={colors.mutedForeground} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeletePriority(priority.id)}
                                                style={styles.actionButton}
                                            >
                                                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
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
    prioritiesList: {
        gap: spacing.md,
    },
    priorityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        ...shadows.soft,
        gap: spacing.sm,
    },
    activePriorityItem: {
        borderColor: colors.primary,
        borderWidth: 1,
    },
    arrowContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
    },
    arrowButton: {
        padding: 2,
    },
    arrowDisabled: {
        opacity: 0.3,
    },
    priorityInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
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
        flex: 1,
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
