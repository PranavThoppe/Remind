-- Add pro column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pro BOOLEAN DEFAULT FALSE NOT NULL;

-- Set specific user as pro
UPDATE profiles 
SET pro = TRUE 
WHERE id = '430f7602-bf2d-4e41-9e5e-0fc07ca52b46';

-- Create index for faster pro status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_pro ON profiles(pro) WHERE pro = TRUE;
