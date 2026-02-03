import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { ElevenLabsConversation } from '../../lib/elevenLabsWebSocket';
import { handleClientToolCall } from '../../lib/elevenLabsClient';

interface VoiceModeButtonProps {
    colors: any;
    userId?: string;
    onSessionUpdate?: (isActive: boolean) => void;
}

export function VoiceModeButton({ colors, userId, onSessionUpdate }: VoiceModeButtonProps) {
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const conversationRef = useRef<ElevenLabsConversation | null>(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Animation for active state
    useEffect(() => {
        let animation: Animated.CompositeAnimation | null = null;

        if (isActive) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
        } else {
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }

        return () => animation?.stop();
    }, [isActive]);

    const toggleSession = async () => {
        if (isActive) {
            stopSession();
            return;
        }

        startSession();
    };

    const startSession = async () => {
        setIsConnecting(true);
        try {
            // 1. Request microphone permissions natively
            console.log('[VoiceMode] Requesting microphone permissions...');
            const { status } = await Audio.requestPermissionsAsync();

            if (status !== 'granted') {
                throw new Error('Microphone permission is required for voice mode');
            }

            console.log('[VoiceMode] Microphone permission granted');

            // 2. Get signed URL from edge function
            const SUPABASE_URL = 'https://wnucyciacxqrbuthymbu.supabase.co';
            const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudWN5Y2lhY3hxcmJ1dGh5bWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIzMzgsImV4cCI6MjA4NDQzODMzOH0.Xm5XfWgrQIGpvUzoCUqRntuO0pNXWfb4u465VxUe22Y';
            const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET_KEY || 'bxWLD2nOAFTjbFxlG60jNmNn+djE+DgNpcLlfckyKNw=';

            console.log('[VoiceMode] Requesting signed URL...');
            const response = await fetch(`${SUPABASE_URL}/functions/v1/get-agent-signed-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`,
                    'x-admin-secret': ADMIN_SECRET,
                },
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Edge Function Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            console.log('[VoiceMode] Got signed URL, connecting...');

            // 3. Create and start conversation
            const conversation = new ElevenLabsConversation({
                onConnect: () => {
                    console.log('[VoiceMode] Connected!');
                    setIsActive(true);
                    setIsConnecting(false);
                    onSessionUpdate?.(true);
                },
                onDisconnect: () => {
                    console.log('[VoiceMode] Disconnected');
                    setIsActive(false);
                    setIsConnecting(false);
                    onSessionUpdate?.(false);
                    conversationRef.current = null;
                },
                onError: (error) => {
                    console.error('[VoiceMode] Error:', error);
                    Alert.alert('Voice Mode Error', error);
                    stopSession();
                },
                onMessage: (message) => {
                    console.log('[VoiceMode] Message:', message.type);
                },
                onAudioResponse: (audioData) => {
                    console.log('[VoiceMode] Received audio chunk');
                },
                onToolCall: async (toolName, parameters, callId) => {
                    console.log('[VoiceMode] Tool call:', toolName, parameters);
                    try {
                        const result = await handleClientToolCall(
                            { name: toolName, parameters, call_id: callId },
                            userId
                        );
                        return result;
                    } catch (error: any) {
                        console.error('[VoiceMode] Tool call error:', error);
                        return { error: error.message };
                    }
                },
            });

            conversationRef.current = conversation;
            await conversation.startSession(data.signed_url);

        } catch (err: any) {
            console.error('[VoiceMode] Start error:', err);
            Alert.alert('Connection Failed', err.message);
            setIsConnecting(false);
        }
    };

    const stopSession = async () => {
        if (conversationRef.current) {
            await conversationRef.current.endSession();
            conversationRef.current = null;
        }
        setIsActive(false);
        setIsConnecting(false);
        onSessionUpdate?.(false);
    };

    return (
        <View>
            <TouchableOpacity
                onPress={toggleSession}
                activeOpacity={0.8}
                disabled={isConnecting}
            >
                <Animated.View style={[
                    styles.button,
                    {
                        backgroundColor: isActive ? '#FF4B4B' : colors.foreground,
                        transform: [{ scale: scaleAnim }]
                    }
                ]}>
                    {isConnecting ? (
                        <ActivityIndicator color={colors.card} size="small" />
                    ) : (
                        <MaterialIcons
                            name={isActive ? "stop" : "record-voice-over"}
                            size={24}
                            color={colors.card}
                        />
                    )}
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 35,
        height: 35,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
});
