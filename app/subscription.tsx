import { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';

export default function SubscriptionScreen() {
    const { colors } = useTheme();
    const { user, profile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>('Loading...');
    const isPro = profile?.pro === true;

    useEffect(() => {
        loadOfferings();
    }, []);

    async function loadOfferings() {
        try {
            const offerings = await Purchases.getOfferings();

            // === DEBUG: Show in UI since no Mac for console ===
            const debugLines: string[] = [];
            debugLines.push(`Current: ${offerings.current ? 'EXISTS' : 'NULL'}`);
            debugLines.push(`All keys: [${Object.keys(offerings.all).join(', ')}]`);
            if (offerings.current) {
                debugLines.push(`Offering ID: ${offerings.current.identifier}`);
                debugLines.push(`Packages: ${offerings.current.availablePackages.length}`);
                offerings.current.availablePackages.forEach((pkg, i) => {
                    debugLines.push(`  Pkg ${i}: ${pkg.identifier} - ${pkg.product.title} - ${pkg.product.priceString}`);
                });
            } else {
                Object.entries(offerings.all).forEach(([key, offering]) => {
                    debugLines.push(`  "${key}": ${offering.availablePackages.length} packages`);
                });
            }
            setDebugInfo(debugLines.join('\n'));
            // === END DEBUG ===

            if (offerings.current?.availablePackages) {
                setPackages(offerings.current.availablePackages);
            }
        } catch (e: any) {
            setDebugInfo(`ERROR: ${e.message || String(e)}`);
            console.error('❌ Error fetching offerings:', e);
        } finally {
            setLoading(false);
        }
    }

    async function handlePurchase(pkg: PurchasesPackage) {
        if (!user) {
            Alert.alert('Error', 'Please sign in to subscribe.');
            return;
        }

        setPurchasing(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);

            // Check if the "pro" entitlement is now active
            if (customerInfo.entitlements.active['pro']) {
                // Update Supabase profile
                const { error } = await supabase
                    .from('profiles')
                    .update({ pro: true })
                    .eq('id', user.id);

                if (error) {
                    console.error('Error updating pro status:', error);
                    Alert.alert('Purchase successful!', 'But we had trouble activating your account. Please restart the app.');
                } else {
                    await refreshProfile();
                    Alert.alert('Welcome to Pro! 🎉', 'All AI features are now unlocked.', [
                        { text: 'Let\'s go!', onPress: () => router.back() },
                    ]);
                }
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('Purchase error:', e);
                Alert.alert('Purchase Failed', e.message || 'Something went wrong. Please try again.');
            }
        } finally {
            setPurchasing(false);
        }
    }

    async function handleRestore() {
        setPurchasing(true);
        try {
            const customerInfo = await Purchases.restorePurchases();
            if (customerInfo.entitlements.active['pro']) {
                if (user) {
                    await supabase.from('profiles').update({ pro: true }).eq('id', user.id);
                    await refreshProfile();
                }
                Alert.alert('Restored!', 'Your Pro subscription has been restored.', [
                    { text: 'Great!', onPress: () => router.back() },
                ]);
            } else {
                Alert.alert('No Subscription Found', 'We couldn\'t find an active subscription to restore.');
            }
        } catch (e: any) {
            console.error('Restore error:', e);
            Alert.alert('Restore Failed', e.message || 'Something went wrong.');
        } finally {
            setPurchasing(false);
        }
    }

    const features = [
        { icon: 'chatbubble-ellipses' as const, label: 'AI-Powered Reminder Creation' },
        { icon: 'search' as const, label: 'Natural Language Search' },
        { icon: 'mic' as const, label: 'Voice Mode (Coming Soon)' },
        { icon: 'image' as const, label: 'Image-to-Reminder Extraction' },
    ];

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Back Button */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.proIconContainer, { backgroundColor: isPro ? colors.primaryLight : colors.goldLight }]}>
                            <Ionicons name="diamond" size={36} color={isPro ? colors.primary : colors.gold} />
                        </View>
                        <Text style={[styles.title, { color: isPro ? colors.primary : colors.gold }]}>
                            {isPro ? 'You\'re Pro!' : 'Unlock Mind'}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                            {isPro
                                ? 'You have full access to all AI features.'
                                : 'Get the most out of Remind with AI-powered features.'}
                        </Text>
                    </View>

                    {/* Features List */}
                    <View style={[styles.featuresCard, { backgroundColor: colors.card }]}>
                        {features.map((feature, index) => (
                            <View
                                key={feature.label}
                                style={[
                                    styles.featureRow,
                                    index < features.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                ]}
                            >
                                <View style={[styles.featureIcon, { backgroundColor: isPro ? colors.primaryLight : colors.goldLight }]}>
                                    <Ionicons name={feature.icon} size={18} color={isPro ? colors.primary : colors.gold} />
                                </View>
                                <Text style={[styles.featureLabel, { color: colors.foreground }]}>{feature.label}</Text>
                                <Ionicons name="checkmark-circle" size={20} color={isPro ? colors.primary : colors.gold} />
                            </View>
                        ))}
                    </View>

                    {/* Packages / Purchase */}
                    {!isPro && (
                        <View style={styles.packagesSection}>
                            {loading ? (
                                <ActivityIndicator size="large" color={colors.gold} />
                            ) : packages.length > 0 ? (
                                packages.map((pkg) => (
                                    <TouchableOpacity
                                        key={pkg.identifier}
                                        style={[styles.packageButton, { backgroundColor: colors.gold }]}
                                        onPress={() => handlePurchase(pkg)}
                                        disabled={purchasing}
                                        activeOpacity={0.8}
                                    >
                                        {purchasing ? (
                                            <ActivityIndicator size="small" color={colors.goldForeground} />
                                        ) : (
                                            <>
                                                <Text style={[styles.packageTitle, { color: colors.goldForeground }]}>
                                                    {pkg.product.title || 'Pro'}
                                                </Text>
                                                <Text style={[styles.packagePrice, { color: colors.goldForeground }]}>
                                                    {pkg.product.priceString}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={[styles.noPackages, { color: colors.mutedForeground }]}>
                                    No subscription packages available yet.
                                </Text>
                            )}

                            {/* Restore */}
                            <TouchableOpacity
                                style={styles.restoreButton}
                                onPress={handleRestore}
                                disabled={purchasing}
                            >
                                <Text style={[styles.restoreText, { color: colors.mutedForeground }]}>
                                    Restore Purchases
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Debug Panel - REMOVE after debugging */}
                    <View style={{ marginTop: 24, padding: 12, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: '#EF4444' }}>
                        <Text style={{ color: '#EF4444', fontWeight: 'bold', marginBottom: 4, fontSize: 12 }}>🔧 DEBUG (remove later)</Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'monospace' }}>{debugInfo}</Text>
                    </View>
                </ScrollView>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.xl,
    },
    backButton: {
        marginBottom: spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    proIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontFamily: typography.fontFamily.title,
        fontSize: typography.fontSize['3xl'],
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 280,
    },
    featuresCard: {
        borderRadius: borderRadius.xl,
        ...shadows.card,
        marginBottom: spacing['2xl'],
        overflow: 'hidden',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
    },
    featureIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    featureLabel: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.base,
        flex: 1,
    },
    packagesSection: {
        gap: spacing.md,
    },
    packageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.lg,
        minHeight: 56,
    },
    packageTitle: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.lg,
    },
    packagePrice: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.xl,
    },
    noPackages: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        paddingVertical: spacing.xl,
    },
    restoreButton: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    restoreText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.fontSize.sm,
        textDecorationLine: 'underline',
    },
});
