import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { callNovaTranscribe } from '../lib/nova-client';

export function useVoiceDictation(onTranscriptReceived: (text: string) => void) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const recordingRef = useRef<Audio.Recording | null>(null);

    // Ensure audio recording is cleaned up if unmounted
    useEffect(() => {
        return () => {
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => { });
                Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: false,
                    staysActiveInBackground: false,
                    interruptionModeIOS: 0, // InterruptionModeIOS.MixWithOthers
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false,
                    interruptionModeAndroid: 1, // InterruptionModeAndroid.DoNotMix
                }).catch(() => { });
            }
        };
    }, []);

    const toggleDictation = async () => {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    };

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Microphone Access', 'Please grant microphone access to use voice dictation.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recordingRef.current = recording;
            setIsRecording(true);

        } catch (err: any) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Failed to start recording: ' + err.message);
            setIsRecording(false);
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        setIsRecording(false);
        setIsTranscribing(true);

        try {
            await recordingRef.current.stopAndUnloadAsync();

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: false,
                staysActiveInBackground: false,
                interruptionModeIOS: 0, // InterruptionModeIOS.MixWithOthers
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
                interruptionModeAndroid: 1, // InterruptionModeAndroid.DoNotMix
            });

            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            if (uri) {
                const text = await callNovaTranscribe(uri);
                if (text && text.trim().length > 0) {
                    onTranscriptReceived(text);
                }
            }
        } catch (err: any) {
            console.error('Failed to stop/transcribe recording', err);
            Alert.alert('Transcription Failed', 'Could not process audio.');
        } finally {
            setIsTranscribing(false);
        }
    };

    return {
        isRecording,
        isTranscribing,
        toggleDictation,
        startRecording,
        stopRecording
    };
}
