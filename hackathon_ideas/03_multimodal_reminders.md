# Idea 3: Multimodal Reminders (Vision)

## Concept
"Don't type it, snap it."
User takes a photo of:
- A generic physical mail/letter.
- A billboard/flyer for an event.
- A messy handwritten to-do note.
- A fridge with low groceries.

The app analyzes the image and creates the relevant reminders.

## Why Nova?
- **Multimodal capabilities**: All Nova models (Lite, Pro) typically support image input out of the box. They can "see" the image and extract text and context.

## User Flow
1. User taps "Camera" icon.
2. User takes a photo of a "Save the Date" wedding card.
3. App uploads image to Supabase Storage (or sends base64 to Edge Function).
4. Prompt sent to Nova: "Extract the event title, date, location, and time from this image. Return JSON."
5. Nova returns:
   ```json
   {
     "title": "Sarah & Mike's Wedding",
     "date": "2026-06-15",
     "time": "14:00",
     "location": "The Grand Hotel"
   }
   ```
6. App creates the reminder.

## Implementation Difficulty: Medium
- Camera integration (`expo-image-picker`).
- Handling image uploads/base64 strings.
- Very high "wow" factor for a hackathon demo.
