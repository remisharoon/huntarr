-- Add desired job fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_location TEXT;

-- Add sources column to search_preferences table
ALTER TABLE search_preferences ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '["remoteok","weworkremotely","brave_search"]'::jsonb;

-- Update existing profiles with defaults from experience/location
UPDATE profiles
SET desired_job_title = (
  SELECT jsonb_array_elements(experience)->>'title'
  FROM profiles
  WHERE profiles.id = profiles.id
  AND jsonb_array_length(experience) > 0
  ORDER BY (experience->0->>'start') DESC
  LIMIT 1
)
WHERE desired_job_title IS NULL
AND jsonb_array_length(experience) > 0;

UPDATE profiles
SET desired_location = location
WHERE desired_location IS NULL
AND location IS NOT NULL;
