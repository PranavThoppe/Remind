# Onboarding Flow Documentation

This document outlines the proposed onboarding sequence for the Reminder Mobile app, including the screens, user interactions, and the corresponding data updates.

## Onboarding Sequence

### 1. Welcome Screen
- **Content**: App logo, value proposition, and "Get Started" button.
- **Action**: Navigation to next screen.

### 2. Profile Screen
- **Content**: Input for "Full Name" and optional avatar selection.
- **Database Interaction**:
  - Table: `profiles`
  - Columns: `full_name`, `avatar_url`
  - Method: `supabase.from('profiles').upsert({ id: user.id, full_name, avatar_url })`

### 3. Notifications Permission
- **Content**: Explanation of why notifications are needed (reminders!) and a "Enable Notifications" button.
- **Action**: Request OS-level permission.
- **Storage Interaction**:
  - Key: `settings_notifications` (AsyncStorage)
  - Value: `true` / `false`

### 4. Appearance (Theme)
- **Content**: Visual cards for "Light", "Dark", and "System" modes.
- **Storage Interaction**:
  - Key: `settings_theme` (AsyncStorage)
  - Values: `'light'`, `'dark'`, `'system'`

### 5. Common Times
- **Content**: Time pickers for:
  - Morning (Default: 09:00)
  - Afternoon (Default: 14:00)
  - Evening (Default: 18:00)
  - Night (Default: 21:00)
- **Database Interaction**:
  - Table: `common_times`
  - Columns: `morning`, `afternoon`, `evening`, `night`
  - Method: `supabase.from('common_times').upsert({ user_id: user.id, morning, afternoon, evening, night })`

### 6. Personalized Tags
- **Content**: List of default tags (Personal, Work, Urgent). User can toggle them or add new ones.
- **Database Interaction**:
  - Table: `tags`
  - Method: `supabase.from('tags').insert([...])` for each selected/new tag.

### 7. Priorities
- **Content**: Define priority levels (e.g., Low, Medium, High).
- **Database Interaction**:
  - Table: `priorities`
  - Method: `supabase.from('priorities').insert([...])`

### 8. Completion Screen
- **Content**: "You're all set!" message and "Go to Home" button.
- **Action**: Mark onboarding as complete in `profiles` or local storage and navigate to `(tabs)/home`.

---

## Database Implementation Details

### User Preferences vs. Database
Most settings are synced to Supabase to ensure a consistent experience across devices, while some UI-specific preferences (like theme) can stay local or be synced to a `user_context` table.

| Setting | Storage Location | Supabase Table |
|---------|------------------|----------------|
| Name/Avatar | Database | `profiles` |
| Notifications | Local + DB | `profiles.notifications_enabled` |
| Theme | Local | N/A (or `user_context`) |
| Common Times | Database | `common_times` |
| Tags | Database | `tags` |
| Priorities | Database | `priorities` |

### Syncing Strategy
When the user completes a step, it's recommended to perform the `upsert` immediately. This ensures that even if they quit the onboarding halfway, their progress is partially saved.

---

## Reference Implementation Patterns

To ensure consistency with the main app, the onboarding screens should follow these established patterns:

### 1. Design System & Styling
- **Theme Constants**: [theme.ts](file:///c:/dev/Reminder_Mobile/constants/theme.ts) - Use these for spacing, colors, and typography.
- **Theme Hook**: [useTheme.ts](file:///c:/dev/Reminder_Mobile/hooks/useTheme.ts) - Access the current `colors` and `isDark` state.
- **Style Pattern**: See `createStyles` at the bottom of [settings.tsx](file:///c:/dev/Reminder_Mobile/app/settings.tsx). It uses a factory function to inject `colors`.

### 2. State & Data
- **Supabase Client**: [supabase.ts](file:///c:/dev/Reminder_Mobile/lib/supabase.ts) - Use this for all database interactions.
- **Settings Context**: [SettingsContext.tsx](file:///c:/dev/Reminder_Mobile/contexts/SettingsContext.tsx) - Reference this for the logic of updating tags, priorities, and common times.
- **Types**: [settings.ts](file:///c:/dev/Reminder_Mobile/types/settings.ts) - Use the `Tag`, `PriorityLevel`, and `CommonTimes` interfaces.

### 3. UI Components
- **Settings Items**: [settings.tsx](file:///c:/dev/Reminder_Mobile/app/settings.tsx) contains reusable UI patterns like `SettingItem` and `Section`. These should be mimicked for a cohesive look.

### 4. Navigation & Context
- **Root Layout**: [(tabs)/_layout.tsx](file:///c:/dev/Reminder_Mobile/app/(tabs)/_layout.tsx) shows how to wrap the app in necessary providers (`AuthProvider`, `SettingsProvider`, etc.).
