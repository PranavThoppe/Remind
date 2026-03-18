import * as React from 'react';
import { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Platform,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ProfileAvatar } from './ProfileAvatar';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MainHeaderProps {
    isSearching: boolean;
    searchQuery: string;
    onSearchChange: (text: string) => void;
    onToggleSearch: () => void;
    isSearchLoading: boolean;
    searchAnswer: string | null;
    searchExpandAnim: Animated.Value;
}

export const MainHeader: React.FC<MainHeaderProps> = ({
    isSearching,
    searchQuery,
    onSearchChange,
    onToggleSearch,
    isSearchLoading,
    searchAnswer,
    searchExpandAnim,
}) => {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);
    const router = useRouter();
    const searchInputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (isSearching) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isSearching]);

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const formatDate = () => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const now = new Date();
        return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
    };

    return (
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg, zIndex: 100 }]}>
            <View style={styles.headerTop}>
                <Animated.View style={{ flex: 1, opacity: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
                    <Text style={styles.dateText}>{formatDate()}</Text>
                    <Text style={styles.greeting}>{greeting()}</Text>
                </Animated.View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 40, height: 40 }} />
                    <ProfileAvatar onPress={() => router.push('/settings')} size={40} />
                </View>

                {/* Search Blur Overlay */}
                {isSearching && !searchQuery.trim() && (
                    <TouchableWithoutFeedback onPress={onToggleSearch}>
                        <Animated.View style={[{
                            position: 'absolute',
                            top: -(insets.top + spacing.lg),
                            left: -spacing.xl,
                            width: SCREEN_WIDTH,
                            height: Dimensions.get('window').height + 100,
                            zIndex: 90,
                            opacity: searchExpandAnim,
                        }]}>
                            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)' }]} />
                        </Animated.View>
                    </TouchableWithoutFeedback>
                )}

                {/* Animated Expanding Search Button / Input */}
                <Animated.View style={[{
                    position: 'absolute',
                    right: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [40 + spacing.sm, 0] }),
                    width: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [40, SCREEN_WIDTH - spacing.xl * 2] }),
                    height: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 44] }),
                    borderRadius: 22,
                    backgroundColor: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [`${colors.primary}15`, colors.card] }),
                    borderColor: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', colors.primary] }),
                    borderWidth: searchExpandAnim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] }),
                    overflow: 'hidden',
                    flexDirection: 'row',
                    alignItems: 'center',
                    zIndex: 100,
                }]}>
                    {isSearching ? (
                        <Animated.View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, opacity: searchExpandAnim }}>
                            <Ionicons name="search" size={20} color={colors.primary} style={styles.searchIcon} />
                            <TextInput
                                ref={searchInputRef}
                                style={styles.searchInput}
                                placeholder="Ask or search reminders..."
                                placeholderTextColor={colors.mutedForeground}
                                autoCorrect={false}
                                spellCheck={false}
                                value={searchQuery}
                                onChangeText={onSearchChange}
                                returnKeyType="search"
                            />
                            {isSearchLoading ? (
                                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: spacing.sm }} />
                            ) : (
                                <TouchableOpacity onPress={onToggleSearch} style={styles.closeSearchButton}>
                                    <Text style={styles.closeSearchText}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    ) : (
                        <TouchableOpacity onPress={onToggleSearch} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="search" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </View>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    header: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
        backgroundColor: colors.background,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
    },
    greeting: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        color: colors.foreground,
        marginTop: 2,
        fontWeight: '600' as any,
    },
    searchIcon: {
        marginRight: spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        color: colors.foreground,
        paddingVertical: Platform.OS === 'ios' ? 0 : 4,
    },
    closeSearchButton: {
        paddingHorizontal: spacing.sm,
    },
    closeSearchText: {
        fontFamily: typography.fontFamily.medium,
        color: colors.primary,
        fontSize: typography.fontSize.sm,
    },
});
