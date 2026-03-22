import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// Define the types based on architecture.md
export type ThemeType = 'light' | 'dark' | 'system';

export interface CommonTimes {
    morning: Date;
    afternoon: Date;
    evening: Date;
    night: Date;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    description?: string;
}

export interface PriorityLevel {
    id: string;
    name: string;
    color: string;
    rank: number;
}

export interface OnboardingDraft {
    fullName: string;
    avatarUrl: string | null;
    notificationsEnabled: boolean;
    theme: ThemeType;
    commonTimes: CommonTimes;
    tags: Tag[];
    priorities: PriorityLevel[];
}

interface OnboardingState {
    currentStep: number;
    totalSteps: number;
    draft: OnboardingDraft;
    savedSteps: Set<number>;
    updateDraft: (updates: Partial<OnboardingDraft>) => void;
    saveStep: (step: number) => Promise<void>;
}

const ONBOARDING_STORAGE_KEY = '@re_mind_onboarding_state';

// Initial defaults
const defaultDraft: OnboardingDraft = {
    fullName: '',
    avatarUrl: null,
    notificationsEnabled: false,
    theme: 'system',
    commonTimes: {
        morning: new Date(new Date().setHours(9, 0, 0, 0)),
        afternoon: new Date(new Date().setHours(14, 0, 0, 0)),
        evening: new Date(new Date().setHours(18, 0, 0, 0)),
        night: new Date(new Date().setHours(21, 0, 0, 0)),
    },
    tags: [],
    priorities: [],
};

export const OnboardingContext = createContext<OnboardingState | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const [draft, setDraft] = useState<OnboardingDraft>(defaultDraft);
    const [savedSteps, setSavedSteps] = useState<Set<number>>(new Set());
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadState = async () => {
            try {
                const stored = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.draft) {
                        const parsedDraft = parsed.draft;
                        // Rehydrate dates
                        if (parsedDraft.commonTimes) {
                            parsedDraft.commonTimes = {
                                morning: parsedDraft.commonTimes.morning ? new Date(parsedDraft.commonTimes.morning) : defaultDraft.commonTimes.morning,
                                afternoon: parsedDraft.commonTimes.afternoon ? new Date(parsedDraft.commonTimes.afternoon) : defaultDraft.commonTimes.afternoon,
                                evening: parsedDraft.commonTimes.evening ? new Date(parsedDraft.commonTimes.evening) : defaultDraft.commonTimes.evening,
                                night: parsedDraft.commonTimes.night ? new Date(parsedDraft.commonTimes.night) : defaultDraft.commonTimes.night,
                            };
                        }
                        setDraft(parsedDraft);
                    }
                    if (parsed.savedSteps) {
                        setSavedSteps(new Set(parsed.savedSteps));
                    }
                }
            } catch (e) {
                console.error("Failed to load onboarding state from local storage", e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadState();
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        const saveState = async () => {
            try {
                await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
                    draft,
                    savedSteps: Array.from(savedSteps)
                }));
            } catch (e) {
                console.error("Failed to save onboarding state to local storage", e);
            }
        };
        saveState();
    }, [draft, savedSteps, isLoaded]);

    // Total steps = 8 as per architecture.md
    const totalSteps = 8;
    // We don't track currentStep here natively since Expo Router handles navigation,
    // but we can expose it if needed. The screens themselves know which step they are.
    const currentStep = 1; // Default/dummy

    const updateDraft = (updates: Partial<OnboardingDraft>) => {
        setDraft(prev => ({ ...prev, ...updates }));
    };

    const saveStep = async (step: number) => {
        // In the sandbox, mock saving the draft for the step
        console.log(`[OnboardingContext] Saving step ${step} mock. Draft:`, draft);
        setSavedSteps(prev => new Set(prev).add(step));
    };

    if (!isLoaded) return null;

    return (
        <OnboardingContext.Provider
            value={{
                currentStep,
                totalSteps,
                draft,
                savedSteps,
                updateDraft,
                saveStep,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (context === undefined) {
        throw new Error('useOnboarding must be used within an OnboardingProvider');
    }
    return context;
}
