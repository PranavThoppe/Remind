/**
 * ElevenLabs Conversational AI WebSocket Client
 * 
 * This implements the ElevenLabs Conversational AI protocol directly
 * using WebSockets and native audio APIs, bypassing the need for their web SDK.
 * 
 * NOTE: This is a simplified implementation. Audio input streaming is limited
 * because expo-av doesn't provide real-time audio chunk access. For production,
 * consider using react-native-audio-recorder-player or a custom native module.
 */

import { Audio } from 'expo-av';

export interface ElevenLabsMessage {
    type: string;
    [key: string]: any;
}

export interface ConversationCallbacks {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;
    onMessage?: (message: any) => void;
    onAudioResponse?: (audioData: string) => void;
    onToolCall?: (toolName: string, parameters: any, callId: string) => Promise<any>;
}

export class ElevenLabsConversation {
    private ws: WebSocket | null = null;
    private recording: Audio.Recording | null = null;
    private sound: Audio.Sound | null = null;
    private callbacks: ConversationCallbacks;
    private isRecording = false;
    private audioQueue: string[] = [];
    private isPlayingAudio = false;

    constructor(callbacks: ConversationCallbacks) {
        this.callbacks = callbacks;
    }

    /**
     * Start a conversation session with ElevenLabs
     */
    async startSession(signedUrl: string): Promise<void> {
        try {
            console.log('[ElevenLabs] Starting session with URL:', signedUrl);

            // Set up audio mode for recording and playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                interruptionModeIOS: 2, // Do not mix
                interruptionModeAndroid: 1, // Do not mix
            });

            // Connect to WebSocket
            this.ws = new WebSocket(signedUrl);

            this.ws.onopen = () => {
                console.log('[ElevenLabs] WebSocket connected');
                this.callbacks.onConnect?.();
                // Start recording audio after connection
                this.startAudioRecording();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('[ElevenLabs] WebSocket error:', error);
                this.callbacks.onError?.('WebSocket connection error');
            };

            this.ws.onclose = (event) => {
                console.log('[ElevenLabs] WebSocket closed:', event.code, event.reason);
                this.cleanup();
                this.callbacks.onDisconnect?.();
            };
        } catch (error: any) {
            console.error('[ElevenLabs] Start session error:', error);
            this.callbacks.onError?.(error.message);
            throw error;
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    private async handleMessage(data: string): Promise<void> {
        try {
            const message: ElevenLabsMessage = JSON.parse(data);
            console.log('[ElevenLabs] Received message type:', message.type);

            this.callbacks.onMessage?.(message);

            switch (message.type) {
                case 'audio':
                    // Queue audio for playback
                    if (message.audio_event?.audio_base_64) {
                        this.queueAudio(message.audio_event.audio_base_64);
                    }
                    break;

                case 'interruption':
                    // User interrupted, stop current playback
                    console.log('[ElevenLabs] Interruption detected');
                    await this.stopAudioPlayback();
                    this.audioQueue = [];
                    break;

                case 'ping':
                    // Respond to ping with pong (must match exact format)
                    this.send({
                        type: 'pong',
                        event_id: message.ping_event?.event_id
                    });
                    break;

                case 'client_tool_call':
                    // Handle tool calls
                    await this.handleToolCall(message);
                    break;

                case 'conversation_initiation_metadata':
                    console.log('[ElevenLabs] Conversation initiated:', message);
                    // Send a test message to trigger the agent (for testing audio playback)
                    setTimeout(() => {
                        console.log('[ElevenLabs] Sending test message...');
                        this.send({
                            type: 'user_transcript',
                            user_transcript: 'Hello, can you hear me?',
                        });
                    }, 500);
                    break;

                case 'agent_response':
                case 'user_transcript':
                    // These are informational
                    console.log(`[ElevenLabs] ${message.type}:`, message);
                    break;

                default:
                    console.log('[ElevenLabs] Unknown message type:', message.type, message);
            }
        } catch (error) {
            console.error('[ElevenLabs] Error handling message:', error);
        }
    }

    /**
     * Handle tool calls from the agent
     */
    private async handleToolCall(message: ElevenLabsMessage): Promise<void> {
        try {
            const { tool_name, parameters, tool_call_id } = message;

            console.log('[ElevenLabs] Tool call:', tool_name, parameters);

            if (!this.callbacks.onToolCall) {
                console.warn('[ElevenLabs] No tool call handler registered');
                return;
            }

            // Execute the tool
            const result = await this.callbacks.onToolCall(tool_name, parameters, tool_call_id);

            // Send result back to ElevenLabs
            this.send({
                type: 'tool_response',
                tool_call_id: tool_call_id,
                output: JSON.stringify(result),
            });

            console.log('[ElevenLabs] Tool response sent:', tool_call_id);
        } catch (error: any) {
            console.error('[ElevenLabs] Tool call error:', error);
            // Send error back to agent
            this.send({
                type: 'tool_response',
                tool_call_id: message.tool_call_id,
                output: JSON.stringify({ error: error.message }),
            });
        }
    }

    /**
     * Start recording audio from microphone
     * NOTE: This starts recording but doesn't stream audio to ElevenLabs yet
     * because expo-av doesn't provide real-time audio chunk access
     */
    private async startAudioRecording(): Promise<void> {
        try {
            console.log('[ElevenLabs] Starting audio recording...');

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            this.recording = recording;
            this.isRecording = true;

            console.log('[ElevenLabs] Audio recording started (note: audio input not yet streaming to agent)');

        } catch (error) {
            console.error('[ElevenLabs] Failed to start recording:', error);
            this.callbacks.onError?.('Failed to start audio recording');
        }
    }

    /**
     * Queue audio for playback
     */
    private queueAudio(audioBase64: string): void {
        this.audioQueue.push(audioBase64);
        this.callbacks.onAudioResponse?.(audioBase64);

        // Start playing if not already playing
        if (!this.isPlayingAudio) {
            this.playNextAudio();
        }
    }

    /**
     * Convert PCM base64 to WAV format
     * ElevenLabs sends raw PCM16 data, we need to add WAV headers
     */
    private pcmToWav(base64PCM: string, sampleRate: number = 16000): string {
        try {
            // Decode base64 to binary
            const binaryString = atob(base64PCM);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // WAV file parameters
            const numChannels = 1;
            const bitsPerSample = 16;
            const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
            const blockAlign = numChannels * (bitsPerSample / 8);
            const dataSize = bytes.length;

            // Create WAV header (44 bytes)
            const header = new ArrayBuffer(44);
            const view = new DataView(header);

            // "RIFF" chunk descriptor
            view.setUint32(0, 0x52494646, false); // "RIFF"
            view.setUint32(4, 36 + dataSize, true); // File size - 8
            view.setUint32(8, 0x57415645, false); // "WAVE"

            // "fmt " sub-chunk
            view.setUint32(12, 0x666d7420, false); // "fmt "
            view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
            view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
            view.setUint16(22, numChannels, true); // NumChannels
            view.setUint32(24, sampleRate, true); // SampleRate
            view.setUint32(28, byteRate, true); // ByteRate
            view.setUint16(32, blockAlign, true); // BlockAlign
            view.setUint16(34, bitsPerSample, true); // BitsPerSample

            // "data" sub-chunk
            view.setUint32(36, 0x64617461, false); // "data"
            view.setUint32(40, dataSize, true); // Subchunk2Size

            // Combine header and PCM data
            const wavBytes = new Uint8Array(44 + dataSize);
            wavBytes.set(new Uint8Array(header), 0);
            wavBytes.set(bytes, 44);

            // Convert back to base64
            let binary = '';
            for (let i = 0; i < wavBytes.length; i++) {
                binary += String.fromCharCode(wavBytes[i]);
            }
            return btoa(binary);
        } catch (error) {
            console.error('[ElevenLabs] Error converting PCM to WAV:', error);
            return base64PCM; // Return original if conversion fails
        }
    }

    /**
     * Play the next audio chunk in the queue
     */
    private async playNextAudio(): Promise<void> {
        if (this.audioQueue.length === 0) {
            this.isPlayingAudio = false;
            return;
        }

        this.isPlayingAudio = true;
        const audioBase64 = this.audioQueue.shift()!;

        try {
            // Stop current sound if playing
            if (this.sound) {
                await this.sound.unloadAsync();
                this.sound = null;
            }

            // Convert PCM to WAV format
            const wavBase64 = this.pcmToWav(audioBase64);

            // Create and play sound from WAV data
            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/wav;base64,${wavBase64}` },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        // Play next chunk
                        this.playNextAudio();
                    }
                }
            );

            this.sound = sound;
        } catch (error) {
            console.error('[ElevenLabs] Audio playback error:', error);
            // Continue with next audio chunk
            this.playNextAudio();
        }
    }

    /**
     * Stop audio playback
     */
    private async stopAudioPlayback(): Promise<void> {
        if (this.sound) {
            try {
                await this.sound.stopAsync();
                await this.sound.unloadAsync();
                this.sound = null;
            } catch (error) {
                console.error('[ElevenLabs] Error stopping audio:', error);
            }
        }
        this.isPlayingAudio = false;
    }

    /**
     * Send a message to the WebSocket
     */
    private send(message: any): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            console.log('[ElevenLabs] Sent message:', message.type);
        } else {
            console.warn('[ElevenLabs] Cannot send message, WebSocket not open');
        }
    }

    /**
     * End the conversation session
     */
    async endSession(): Promise<void> {
        console.log('[ElevenLabs] Ending session...');

        // Stop recording
        if (this.recording && this.isRecording) {
            try {
                await this.recording.stopAndUnloadAsync();
            } catch (error) {
                console.error('[ElevenLabs] Error stopping recording:', error);
            }
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        await this.cleanup();
    }

    /**
     * Clean up resources
     */
    private async cleanup(): Promise<void> {
        this.isRecording = false;
        this.recording = null;

        await this.stopAudioPlayback();
        this.audioQueue = [];

        // Reset audio mode
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });
        } catch (error) {
            console.error('[ElevenLabs] Error resetting audio mode:', error);
        }
    }
}
