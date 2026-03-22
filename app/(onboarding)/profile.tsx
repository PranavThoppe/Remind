import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { OnboardingShell } from '../../components/OnboardingShell';
import { borderRadius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../hooks/useTheme';

export default function ProfileScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { draft, updateDraft, saveStep } = useOnboarding();
    const { updateProfile } = useAuth();

    const [name, setName] = useState(draft.fullName);
    const [avatar, setAvatar] = useState<string | null>(draft.avatarUrl);

    useEffect(() => {
        setName(draft.fullName);
        setAvatar(draft.avatarUrl);
    }, [draft.fullName, draft.avatarUrl]);

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && result.assets[0]) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleNext = async () => {
        updateDraft({ fullName: name, avatarUrl: avatar });
        const success = await updateProfile({ full_name: name });
        if (!success) {
            return; // Stay on screen if db save failed
        }
        await saveStep(2);
        router.push('/(onboarding)/notifications');
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(onboarding)');
        }
    };

    const handleSkip = () => {
        router.push('/(onboarding)/notifications');
    };

    return (
        <OnboardingShell
            currentStep={2}
            totalSteps={8}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={100}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.title}>What should we call you?</Text>
                    <Text style={styles.subtitle}>Add a photo and your name to personalize your experience.</Text>

                    <View style={styles.avatarContainer}>
                        <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                            <View style={styles.avatarWrapper}>
                                {avatar ? (
                                    <Image source={{ uri: avatar }} style={styles.avatarImage} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Ionicons name="person" size={48} color={colors.mutedForeground} />
                                    </View>
                                )}
                                <View style={styles.cameraIconContainer}>
                                    <Ionicons name="camera" size={20} color={colors.primaryForeground} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Jane Doe"
                            placeholderTextColor={colors.mutedForeground}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </OnboardingShell>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    content: {
        flexGrow: 1,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing['3xl'],
        alignItems: 'center',
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        color: colors.foreground,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginBottom: spacing['3xl'],
        paddingHorizontal: spacing.md,
    },
    avatarContainer: {
        marginBottom: spacing['3xl'],
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.muted,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border,
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.primary,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.background,
    },
    inputContainer: {
        width: '100%',
        maxWidth: 320,
    },
    inputLabel: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
        color: colors.foreground,
        marginBottom: spacing.xs,
        marginLeft: spacing.xs,
    },
    input: {
        height: 52,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.lg,
        color: colors.foreground,
    },
});
