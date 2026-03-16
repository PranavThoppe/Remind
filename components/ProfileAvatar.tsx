import { View, StyleSheet, Image, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadows } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

interface ProfileAvatarProps extends TouchableOpacityProps {
    size?: number;
}

export function ProfileAvatar({ size = 36, ...props }: ProfileAvatarProps) {
    const { colors } = useTheme();
    const { user, profile } = useAuth();
    const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

    return (
        <TouchableOpacity
            style={createAvatarContainerStyle(colors, size)}
            activeOpacity={0.7}
            {...props}
        >
            {avatarUrl ? (
                <Image
                    source={{ uri: avatarUrl }}
                    style={createAvatarImageStyle(colors, size)}
                />
            ) : (
                <Ionicons
                    name="person"
                    size={size / 2}
                    color={colors.primaryForeground}
                />
            )}
        </TouchableOpacity>
    );
}

const createAvatarContainerStyle = (colors: any, size: number) => ({
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.primary,
    overflow: 'hidden' as const,
    ...shadows.soft,
});

const createAvatarImageStyle = (colors: any, size: number) => ({
    width: size * 0.9,
    height: size * 0.9,
    borderRadius: (size * 0.9) / 2,
    borderWidth: .5,
    borderColor: colors.primary,
});
