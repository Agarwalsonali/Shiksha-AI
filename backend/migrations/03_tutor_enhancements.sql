-- =========================================================
-- Migration 03: Tutor Session Enhancements
-- Adds title, detected topic, and message limit tracking
-- =========================================================

-- Add new columns to tutor_sessions
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS detected_subject TEXT;
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS detected_chapter TEXT;
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0;

-- Create index for faster session listing
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_active 
ON tutor_sessions (user_id, last_active_at DESC);

-- Update existing answer_mode values to new modes
-- Map: '2-mark' -> 'quick', '5-mark' -> 'detailed', 'topper' -> 'exam'
UPDATE tutor_messages 
SET answer_mode = CASE 
    WHEN answer_mode = '2-mark' THEN 'quick'
    WHEN answer_mode = '5-mark' THEN 'detailed'
    WHEN answer_mode = 'topper' THEN 'exam'
    ELSE answer_mode
END
WHERE answer_mode IN ('2-mark', '5-mark', 'topper');

-- Function to update message count on insert
CREATE OR REPLACE FUNCTION update_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tutor_sessions 
    SET message_count = (
        SELECT COUNT(*) FROM tutor_messages WHERE session_id = NEW.session_id
    ),
    last_active_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update message count
DROP TRIGGER IF EXISTS trg_update_message_count ON tutor_messages;
CREATE TRIGGER trg_update_message_count
AFTER INSERT ON tutor_messages
FOR EACH ROW
EXECUTE FUNCTION update_session_message_count();

-- Backfill message_count for existing sessions
UPDATE tutor_sessions ts
SET message_count = (
    SELECT COUNT(*) FROM tutor_messages tm WHERE tm.session_id = ts.id
);

-- Add check constraint for max 30 messages per session (soft limit, enforced in app)
-- Note: We don't add a hard DB constraint as it would complicate inserts
-- The application will enforce the 30 message limit

COMMENT ON COLUMN tutor_sessions.title IS 'Auto-generated title based on first question';
COMMENT ON COLUMN tutor_sessions.detected_subject IS 'Primary subject detected from conversation';
COMMENT ON COLUMN tutor_sessions.detected_chapter IS 'Primary chapter detected from conversation';
COMMENT ON COLUMN tutor_sessions.message_count IS 'Number of messages in session (max 30)';
