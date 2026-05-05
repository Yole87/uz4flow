-- ============================================
-- FIX: Drop partial index and create simple unique index
-- This fixes the 500 error caused by incompatible partial index
-- ============================================

-- Drop the problematic partial index (it has WHERE clause that breaks upsert)
DROP INDEX IF EXISTS idx_conversations_contact_instance_unique;

-- Create a simple unique index (without WHERE clause)
-- This allows Supabase JS .upsert({ onConflict: "contact_id,instance_id" }) to work
CREATE UNIQUE INDEX idx_conversations_contact_instance_unique 
ON conversations (contact_id, instance_id);

-- Also create a unique index if conversations might have NULL instance_id
-- This handles cases where instance_id could be null
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_contact_null_instance 
ON conversations (contact_id) 
WHERE instance_id IS NULL;