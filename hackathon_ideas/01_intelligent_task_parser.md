# Idea 1: Intelligent Task Parser

## Concept
Use **Amazon Nova Lite** (or Micro) to instantly parse natural language inputs into structured reminder data. This replaces rigid form inputs with a simple "Type what you need to do" box.

## Why Nova?
- **Speed**: Nova Lite/Micro are optimized for low latency, making the "typing -> structured data" feel instant.
- **Cost**: Extremely cheap for high-volume text processing.
- **Reasoning**: Better at understanding context than simple regex (e.g., "Remind me to call Mom when I get home" -> Location-based trigger, not just time).

## User Flow
1. User opens app.
2. User types: "Gym every tuesday and thursday at 6pm starting next week".
3. App sends text to Bedrock.
4. Nova Lite returns JSON:
   ```json
   {
     "title": "Gym",
     "recurrence": {
       "type": "weekly",
       "days": ["Tue", "Thu"],
       "time": "18:00",
       "startDate": "2026-02-20"
     }
   }
   ```
5. App pre-fills the "Add Reminder" screen with these details for one-tap confirmation.

## Implementation Difficulty: Low
- Requires 1 Edge Function.
- Prompt Engineering: "You are a scheduler assistant. Convert this text to JSON..."
