# Idea 2: Voice Agent (Nova Sonic)

## Concept
A hands-free "conversation mode" for the app. Instead of just setting reminders, the user can talk to the app to organize their day.

"Hey, what do I have today? Move the meeting to 4pm and add a workout after that."

## Why Nova?
- **Amazon Nova Sonic**: This model is specifically built for Speech-to-Speech (or Speech-to-Text-to-Speech). It handles audio directly, reducing the latency of stitching together (Whisper + LLM + TTS).

## User Flow
1. User taps a microphone icon.
2. App records audio.
3. Audio is sent to Supabase -> Bedrock (Nova Sonic).
4. Nova Sonic processes the intent and audio.
5. Returns:
   - **Audio**: Response to play back ("Okay, moved the meeting. Anything else?")
   - **Action Data**: structured JSON to update the database.

## Implementation Difficulty: High
- Handling audio recording/streaming in React Native (`expo-av` or `react-native-audio-recorder-player`).
- Sending binary audio data to Edge Function.
- Nova Sonic API usage is newer and might have specific input formats (PCM raw audio etc).

**Alternate (Easier) Path:**
Use `expo-av` to record -> Transcribe with simple model (or built-in iOS dictation) -> Send Text to Nova Lite -> Text-to-Speech response. Less "cutting edge" but safer for a hackathon MVP.
