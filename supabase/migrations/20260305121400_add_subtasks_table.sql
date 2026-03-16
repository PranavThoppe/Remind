-- Create the subtasks table
CREATE TABLE public.subtasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only manage their own subtasks
CREATE POLICY "Users can manage their own subtasks" 
    ON public.subtasks 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Optional: Create an index for faster lookups by reminder
CREATE INDEX idx_subtasks_reminder_id ON public.subtasks(reminder_id);
