-- =========================================================
-- Migration 02: Full Schema Extension
-- Shiksha-AI: Chapter Progress, Gamification, Leaderboard & Intelligence Tracking
-- =========================================================

-- =========================
-- CHAPTER PROGRESS TRACKING
-- =========================

-- Predefined system tags enum
CREATE TYPE chapter_tag_enum AS ENUM (
  'need_revision',
  'important', 
  'difficult',
  'easy',
  'exam_important',
  'completed'
);

-- User chapter progress table
CREATE TABLE user_chapter_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Chapter identification (matches curriculum JSON)
  class INT NOT NULL CHECK (class BETWEEN 9 AND 12),
  subject TEXT NOT NULL,
  chapter_id TEXT NOT NULL,           -- e.g., "phy-11-ch01"
  chapter_name TEXT NOT NULL,
  
  -- Progress tracking
  progress_percent INT DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  
  -- Tags (system + custom)
  system_tags chapter_tag_enum[] DEFAULT '{}',
  custom_tags TEXT[] DEFAULT '{}',
  
  -- User notes
  notes TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_studied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, chapter_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_chapter_progress_user ON user_chapter_progress(user_id);
CREATE INDEX idx_chapter_progress_subject ON user_chapter_progress(user_id, subject);
CREATE INDEX idx_chapter_progress_class ON user_chapter_progress(user_id, class);
CREATE INDEX idx_chapter_progress_status ON user_chapter_progress(user_id, status);
CREATE INDEX idx_chapter_progress_tags ON user_chapter_progress USING GIN (system_tags);

-- =========================
-- ENHANCED STUDY PLANS
-- =========================

-- Add deadline and chapter-level planning to study_plans
ALTER TABLE study_plans 
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS deadline DATE,
  ADD COLUMN IF NOT EXISTS target_chapters TEXT[] DEFAULT '{}';

-- Add chapter reference to plan_tasks
ALTER TABLE plan_tasks
  ADD COLUMN IF NOT EXISTS chapter_id TEXT,
  ADD COLUMN IF NOT EXISTS deadline DATE;

-- =========================
-- GAMIFICATION: BADGES
-- =========================

-- Badge tier enum
CREATE TYPE badge_tier_enum AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- Badge category enum  
CREATE TYPE badge_category_enum AS ENUM ('progress', 'quiz', 'streak', 'activity', 'social', 'special');

-- Badge definitions table (master list)
CREATE TABLE badge_definitions (
  id TEXT PRIMARY KEY,                  -- e.g., 'first_chapter', 'quiz_ace'
  name TEXT NOT NULL,                   -- e.g., 'First Steps'
  description TEXT NOT NULL,            -- e.g., 'Complete your first chapter'
  icon TEXT NOT NULL,                   -- Emoji or icon name
  category badge_category_enum NOT NULL,
  tier badge_tier_enum DEFAULT 'bronze',
  xp_reward INT DEFAULT 0,
  criteria JSONB NOT NULL,              -- {"type": "chapters_completed", "value": 1}
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User badges table (earned badges)
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  notified BOOLEAN DEFAULT false,       -- Track if user was notified
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

-- =========================
-- GAMIFICATION: XP SYSTEM
-- =========================

-- User XP table
CREATE TABLE user_xp (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp INT DEFAULT 0,
  level INT DEFAULT 1,
  xp_to_next_level INT DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- XP transactions history
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  source TEXT NOT NULL,                 -- 'chapter_complete', 'quiz', 'streak', 'badge', 'login'
  source_id TEXT,                       -- Reference ID (chapter_id, quiz_id, badge_id, etc.)
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX idx_xp_transactions_source ON xp_transactions(source);
CREATE INDEX idx_xp_transactions_date ON xp_transactions(created_at);

-- =========================
-- LEADERBOARD SUPPORT
-- =========================

-- User class stats for leaderboard (aggregated data)
CREATE TABLE user_class_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class INT NOT NULL CHECK (class BETWEEN 9 AND 12),
  
  -- Progress metrics
  total_chapters INT DEFAULT 0,
  completed_chapters INT DEFAULT 0,
  in_progress_chapters INT DEFAULT 0,
  overall_progress_percent INT DEFAULT 0,
  
  -- Quiz metrics
  total_quizzes_taken INT DEFAULT 0,
  average_quiz_score NUMERIC(5,2) DEFAULT 0,
  perfect_quizzes INT DEFAULT 0,
  
  -- Activity metrics
  total_study_minutes INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  
  -- XP and badges
  total_xp INT DEFAULT 0,
  total_badges INT DEFAULT 0,
  
  -- Ranking (computed periodically)
  rank_in_class INT,
  rank_updated_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, class)
);

CREATE INDEX idx_class_stats_rank ON user_class_stats(class, rank_in_class);
CREATE INDEX idx_class_stats_progress ON user_class_stats(class, overall_progress_percent DESC);
CREATE INDEX idx_class_stats_xp ON user_class_stats(class, total_xp DESC);

-- Leaderboard snapshots (weekly/monthly archives)
CREATE TABLE leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class INT NOT NULL CHECK (class BETWEEN 9 AND 12),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rankings JSONB NOT NULL,              -- Array of {user_id, rank, score, display_name, ...}
  total_participants INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leaderboard_snapshots_class ON leaderboard_snapshots(class, period_type, period_start);

-- =========================
-- USER PROFILE UPDATES
-- =========================

-- Add leaderboard privacy settings to user_profile
ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- =========================
-- INTELLIGENCE TRACKING: IQ & KNOWLEDGE LEVEL
-- =========================

-- Bloom's taxonomy level enum
CREATE TYPE bloom_level_enum AS ENUM (
  'remember',     -- Basic recall of facts
  'understand',   -- Comprehension, explaining ideas
  'apply',        -- Using knowledge in new situations
  'analyze',      -- Breaking down information, finding patterns
  'evaluate',     -- Making judgments, defending opinions
  'create'        -- Producing new or original work
);

-- Overall IQ/Cognitive Level (internal use only)
CREATE TABLE user_iq_level (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Overall IQ score (normalized 50-150 scale, 100 = average)
  iq_score NUMERIC(5,2) DEFAULT 100.0 CHECK (iq_score BETWEEN 50 AND 150),
  
  -- Cognitive dimensions (each 0-100)
  logical_reasoning NUMERIC(5,2) DEFAULT 50.0 CHECK (logical_reasoning BETWEEN 0 AND 100),
  problem_solving NUMERIC(5,2) DEFAULT 50.0 CHECK (problem_solving BETWEEN 0 AND 100),
  conceptual_understanding NUMERIC(5,2) DEFAULT 50.0 CHECK (conceptual_understanding BETWEEN 0 AND 100),
  analytical_thinking NUMERIC(5,2) DEFAULT 50.0 CHECK (analytical_thinking BETWEEN 0 AND 100),
  memory_retention NUMERIC(5,2) DEFAULT 50.0 CHECK (memory_retention BETWEEN 0 AND 100),
  
  -- Confidence in the score (based on data points)
  confidence NUMERIC(3,2) DEFAULT 0.0 CHECK (confidence BETWEEN 0 AND 1),
  evaluation_count INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subject-wise Knowledge Level
CREATE TABLE user_knowledge_level (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Subject identification
  class INT NOT NULL CHECK (class BETWEEN 9 AND 12),
  subject TEXT NOT NULL,
  
  -- Overall knowledge score (0-100)
  knowledge_score NUMERIC(5,2) DEFAULT 0.0 CHECK (knowledge_score BETWEEN 0 AND 100),
  
  -- Bloom's taxonomy levels (each 0-100)
  remember_level NUMERIC(5,2) DEFAULT 0.0 CHECK (remember_level BETWEEN 0 AND 100),
  understand_level NUMERIC(5,2) DEFAULT 0.0 CHECK (understand_level BETWEEN 0 AND 100),
  apply_level NUMERIC(5,2) DEFAULT 0.0 CHECK (apply_level BETWEEN 0 AND 100),
  analyze_level NUMERIC(5,2) DEFAULT 0.0 CHECK (analyze_level BETWEEN 0 AND 100),
  evaluate_level NUMERIC(5,2) DEFAULT 0.0 CHECK (evaluate_level BETWEEN 0 AND 100),
  create_level NUMERIC(5,2) DEFAULT 0.0 CHECK (create_level BETWEEN 0 AND 100),
  
  -- Data points for confidence calculation
  quiz_data_points INT DEFAULT 0,
  tutor_data_points INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, class, subject)
);

CREATE INDEX idx_knowledge_level_user ON user_knowledge_level(user_id);
CREATE INDEX idx_knowledge_level_subject ON user_knowledge_level(user_id, class, subject);

-- IQ/Knowledge evaluation history (audit trail)
CREATE TABLE iq_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Source of evaluation
  source TEXT NOT NULL CHECK (source IN ('quiz', 'tutor', 'manual')),
  source_id TEXT,  -- quiz_attempt_id or tutor_session_id
  
  -- Evaluation details
  subject TEXT,
  chapter TEXT,
  topic TEXT,
  evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('iq_update', 'knowledge_update', 'both')),
  
  -- Before/After IQ scores
  previous_iq NUMERIC(5,2),
  new_iq NUMERIC(5,2),
  iq_delta NUMERIC(5,2),
  
  -- Before/After knowledge scores
  previous_knowledge NUMERIC(5,2),
  new_knowledge NUMERIC(5,2),
  knowledge_delta NUMERIC(5,2),
  
  -- Bloom's level detected (for tutor interactions)
  bloom_level bloom_level_enum,
  question_complexity INT CHECK (question_complexity BETWEEN 1 AND 10),
  demonstrates_understanding BOOLEAN,
  reasoning_quality INT CHECK (reasoning_quality BETWEEN 1 AND 10),
  
  -- AI reasoning for the evaluation
  reasoning TEXT,
  
  -- Raw evaluation data
  evaluation_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_iq_evaluations_user ON iq_evaluations(user_id);
CREATE INDEX idx_iq_evaluations_source ON iq_evaluations(source, source_id);
CREATE INDEX idx_iq_evaluations_date ON iq_evaluations(created_at);

-- =========================
-- SEED BADGE DEFINITIONS
-- =========================

INSERT INTO badge_definitions (id, name, description, icon, category, tier, xp_reward, criteria, display_order) VALUES
-- Progress Badges
('first_chapter', 'First Steps', 'Complete your first chapter', '🎯', 'progress', 'bronze', 50, '{"type": "chapters_completed", "value": 1}', 1),
('chapter_5', 'Getting Started', 'Complete 5 chapters', '📚', 'progress', 'bronze', 100, '{"type": "chapters_completed", "value": 5}', 2),
('chapter_10', 'Bookworm', 'Complete 10 chapters', '📖', 'progress', 'silver', 150, '{"type": "chapters_completed", "value": 10}', 3),
('chapter_25', 'Quarter Way', 'Complete 25 chapters', '🏃', 'progress', 'silver', 250, '{"type": "chapters_completed", "value": 25}', 4),
('chapter_50', 'Half Century', 'Complete 50 chapters', '🎖️', 'progress', 'gold', 500, '{"type": "chapters_completed", "value": 50}', 5),
('chapter_100', 'Centurion', 'Complete 100 chapters', '🏆', 'progress', 'platinum', 1000, '{"type": "chapters_completed", "value": 100}', 6),
('subject_master', 'Subject Master', 'Complete all chapters in a subject', '👑', 'progress', 'gold', 500, '{"type": "subject_completed", "value": 1}', 7),
('all_subjects', 'Scholar', 'Complete all subjects for your class', '🎓', 'progress', 'platinum', 2000, '{"type": "all_subjects_completed", "value": 1}', 8),

-- Quiz Badges
('first_quiz', 'Quiz Taker', 'Complete your first quiz', '❓', 'quiz', 'bronze', 30, '{"type": "quizzes_taken", "value": 1}', 10),
('quiz_10', 'Quiz Enthusiast', 'Complete 10 quizzes', '📝', 'quiz', 'bronze', 100, '{"type": "quizzes_taken", "value": 10}', 11),
('quiz_50', 'Quiz Master', 'Complete 50 quizzes', '🧠', 'quiz', 'silver', 250, '{"type": "quizzes_taken", "value": 50}', 12),
('quiz_ace', 'Quiz Ace', 'Score 100% on any quiz', '💯', 'quiz', 'silver', 100, '{"type": "perfect_quiz", "value": 1}', 13),
('quiz_streak_5', 'On Fire', 'Score 80%+ on 5 quizzes in a row', '🔥', 'quiz', 'silver', 200, '{"type": "quiz_streak_80", "value": 5}', 14),
('perfectionist', 'Perfectionist', 'Score 100% on 10 quizzes', '⭐', 'quiz', 'gold', 500, '{"type": "perfect_quizzes", "value": 10}', 15),

-- Streak Badges
('streak_3', 'Consistent', 'Maintain a 3-day study streak', '🌱', 'streak', 'bronze', 30, '{"type": "streak_days", "value": 3}', 20),
('streak_7', 'Week Warrior', 'Maintain a 7-day study streak', '🔥', 'streak', 'bronze', 75, '{"type": "streak_days", "value": 7}', 21),
('streak_14', 'Two Week Champion', 'Maintain a 14-day study streak', '💪', 'streak', 'silver', 150, '{"type": "streak_days", "value": 14}', 22),
('streak_30', 'Month Master', 'Maintain a 30-day study streak', '🌟', 'streak', 'gold', 300, '{"type": "streak_days", "value": 30}', 23),
('streak_60', 'Dedicated', 'Maintain a 60-day study streak', '🏅', 'streak', 'gold', 600, '{"type": "streak_days", "value": 60}', 24),
('streak_100', 'Century Club', 'Maintain a 100-day study streak', '🏆', 'streak', 'platinum', 1000, '{"type": "streak_days", "value": 100}', 25),
('streak_365', 'Year Long Learner', 'Maintain a 365-day study streak', '👑', 'streak', 'platinum', 5000, '{"type": "streak_days", "value": 365}', 26),

-- Activity Badges
('early_bird', 'Early Bird', 'Study before 7 AM', '🌅', 'activity', 'bronze', 25, '{"type": "study_time", "condition": "before_7am"}', 30),
('night_owl', 'Night Owl', 'Study after 10 PM', '🦉', 'activity', 'bronze', 25, '{"type": "study_time", "condition": "after_10pm"}', 31),
('weekend_warrior', 'Weekend Warrior', 'Study on both Saturday and Sunday', '📅', 'activity', 'bronze', 50, '{"type": "weekend_study", "value": 1}', 32),
('study_hour_10', 'Dedicated Learner', 'Complete 10 hours of study', '⏰', 'activity', 'bronze', 100, '{"type": "study_hours", "value": 10}', 33),
('study_hour_50', 'Time Investor', 'Complete 50 hours of study', '⌛', 'activity', 'silver', 250, '{"type": "study_hours", "value": 50}', 34),
('study_hour_100', 'Century Hours', 'Complete 100 hours of study', '🕐', 'activity', 'gold', 500, '{"type": "study_hours", "value": 100}', 35),

-- Special Badges
('revision_king', 'Revision King', 'Mark 10 chapters for revision', '🔄', 'special', 'silver', 100, '{"type": "revision_tags", "value": 10}', 40),
('note_taker', 'Note Taker', 'Add notes to 10 chapters', '📒', 'special', 'bronze', 50, '{"type": "chapters_with_notes", "value": 10}', 41),
('planner', 'Strategic Planner', 'Create 5 study plans', '📋', 'special', 'bronze', 75, '{"type": "plans_created", "value": 5}', 42),
('plan_completer', 'Plan Executor', 'Complete a study plan before deadline', '✅', 'special', 'silver', 150, '{"type": "plans_completed_on_time", "value": 1}', 43),

-- Level-up Badges
('level_5', 'Rising Star', 'Reach Level 5', '⬆️', 'special', 'bronze', 0, '{"type": "level_reached", "value": 5}', 50),
('level_10', 'Double Digits', 'Reach Level 10', '🔟', 'special', 'silver', 0, '{"type": "level_reached", "value": 10}', 51),
('level_25', 'Elite Learner', 'Reach Level 25', '🌟', 'special', 'gold', 0, '{"type": "level_reached", "value": 25}', 52),
('level_50', 'Master Scholar', 'Reach Level 50', '👑', 'special', 'platinum', 0, '{"type": "level_reached", "value": 50}', 53)

ON CONFLICT (id) DO NOTHING;

-- =========================
-- HELPER FUNCTIONS
-- =========================

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(p_total_xp INT)
RETURNS TABLE(level INT, xp_to_next_level INT) AS $$
DECLARE
  v_level INT := 1;
  v_xp_needed INT := 100;
  v_remaining_xp INT := p_total_xp;
BEGIN
  -- Level up formula: Each level requires 100 * level XP
  WHILE v_remaining_xp >= v_xp_needed LOOP
    v_remaining_xp := v_remaining_xp - v_xp_needed;
    v_level := v_level + 1;
    v_xp_needed := 100 * v_level;
  END LOOP;
  
  RETURN QUERY SELECT v_level, v_xp_needed - v_remaining_xp;
END;
$$ LANGUAGE plpgsql;

-- Function to award XP and update level
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount INT,
  p_source TEXT,
  p_source_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS TABLE(new_total_xp INT, new_level INT, level_up BOOLEAN) AS $$
DECLARE
  v_old_level INT;
  v_new_total_xp INT;
  v_new_level INT;
  v_xp_to_next INT;
BEGIN
  -- Get current level
  SELECT COALESCE(level, 1) INTO v_old_level FROM user_xp WHERE user_id = p_user_id;
  IF v_old_level IS NULL THEN v_old_level := 1; END IF;
  
  -- Insert XP transaction
  INSERT INTO xp_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);
  
  -- Update or insert user_xp
  INSERT INTO user_xp (user_id, total_xp, level, xp_to_next_level, updated_at)
  VALUES (p_user_id, p_amount, 1, 100, now())
  ON CONFLICT (user_id) DO UPDATE
  SET total_xp = user_xp.total_xp + p_amount,
      updated_at = now();
  
  -- Calculate new level
  SELECT ux.total_xp INTO v_new_total_xp FROM user_xp ux WHERE ux.user_id = p_user_id;
  SELECT cl.level, cl.xp_to_next_level INTO v_new_level, v_xp_to_next FROM calculate_level(v_new_total_xp) cl;
  
  -- Update level if changed
  UPDATE user_xp 
  SET level = v_new_level, xp_to_next_level = v_xp_to_next
  WHERE user_id = p_user_id;
  
  RETURN QUERY SELECT v_new_total_xp, v_new_level, (v_new_level > v_old_level);
END;
$$ LANGUAGE plpgsql;

-- Function to update user class stats
CREATE OR REPLACE FUNCTION update_user_class_stats(p_user_id UUID, p_class INT)
RETURNS VOID AS $$
DECLARE
  v_total_chapters INT;
  v_completed_chapters INT;
  v_in_progress_chapters INT;
  v_progress_percent INT;
  v_total_quizzes INT;
  v_avg_score NUMERIC;
  v_perfect_quizzes INT;
  v_total_xp INT;
  v_total_badges INT;
  v_current_streak INT;
  v_longest_streak INT;
BEGIN
  -- Calculate chapter progress
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COALESCE(AVG(progress_percent), 0)::INT
  INTO v_total_chapters, v_completed_chapters, v_in_progress_chapters, v_progress_percent
  FROM user_chapter_progress
  WHERE user_id = p_user_id AND class = p_class;
  
  -- Calculate quiz stats
  SELECT 
    COUNT(*),
    COALESCE(AVG(score_percent), 0),
    COUNT(*) FILTER (WHERE score_percent = 100)
  INTO v_total_quizzes, v_avg_score, v_perfect_quizzes
  FROM quiz_attempts
  WHERE user_id = p_user_id;
  
  -- Get XP
  SELECT COALESCE(total_xp, 0) INTO v_total_xp FROM user_xp WHERE user_id = p_user_id;
  
  -- Get badges count
  SELECT COUNT(*) INTO v_total_badges FROM user_badges WHERE user_id = p_user_id;
  
  -- Get streak
  SELECT COALESCE(current_streak_days, 0), COALESCE(longest_streak_days, 0)
  INTO v_current_streak, v_longest_streak
  FROM user_streaks WHERE user_id = p_user_id;
  
  -- Upsert stats
  INSERT INTO user_class_stats (
    user_id, class, total_chapters, completed_chapters, in_progress_chapters,
    overall_progress_percent, total_quizzes_taken, average_quiz_score, perfect_quizzes,
    total_xp, total_badges, current_streak, longest_streak, updated_at
  ) VALUES (
    p_user_id, p_class, v_total_chapters, v_completed_chapters, v_in_progress_chapters,
    v_progress_percent, v_total_quizzes, v_avg_score, v_perfect_quizzes,
    v_total_xp, v_total_badges, v_current_streak, v_longest_streak, now()
  )
  ON CONFLICT (user_id, class) DO UPDATE SET
    total_chapters = EXCLUDED.total_chapters,
    completed_chapters = EXCLUDED.completed_chapters,
    in_progress_chapters = EXCLUDED.in_progress_chapters,
    overall_progress_percent = EXCLUDED.overall_progress_percent,
    total_quizzes_taken = EXCLUDED.total_quizzes_taken,
    average_quiz_score = EXCLUDED.average_quiz_score,
    perfect_quizzes = EXCLUDED.perfect_quizzes,
    total_xp = EXCLUDED.total_xp,
    total_badges = EXCLUDED.total_badges,
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to update class rankings
CREATE OR REPLACE FUNCTION update_class_rankings(p_class INT)
RETURNS VOID AS $$
BEGIN
  -- Calculate combined score and rank
  WITH ranked AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          (overall_progress_percent * 0.35 + 
           average_quiz_score * 0.30 + 
           LEAST(current_streak, 100) * 0.20 +
           LEAST(total_xp / 100.0, 100) * 0.15) DESC,
          total_quizzes_taken DESC,
          updated_at ASC
      ) as new_rank
    FROM user_class_stats ucs
    JOIN user_profile up ON up.user_id = ucs.user_id
    WHERE ucs.class = p_class
      AND up.show_on_leaderboard = true
  )
  UPDATE user_class_stats ucs
  SET rank_in_class = r.new_rank,
      rank_updated_at = now()
  FROM ranked r
  WHERE ucs.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- IQ/KNOWLEDGE FUNCTIONS
-- =========================

-- Function to initialize or get user IQ level
CREATE OR REPLACE FUNCTION get_or_create_user_iq(p_user_id UUID)
RETURNS user_iq_level AS $$
DECLARE
  v_result user_iq_level;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_result FROM user_iq_level WHERE user_id = p_user_id;
  
  -- If not exists, create with defaults
  IF NOT FOUND THEN
    INSERT INTO user_iq_level (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_result;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to update IQ score with exponential moving average
CREATE OR REPLACE FUNCTION update_user_iq(
  p_user_id UUID,
  p_evaluation_score NUMERIC,  -- The score from this evaluation (50-150 scale)
  p_source TEXT,
  p_source_id TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_bloom_level TEXT DEFAULT NULL,
  p_question_complexity INT DEFAULT NULL,
  p_demonstrates_understanding BOOLEAN DEFAULT NULL,
  p_reasoning_quality INT DEFAULT NULL,
  p_reasoning TEXT DEFAULT NULL
) RETURNS TABLE(new_iq NUMERIC, iq_delta NUMERIC, new_confidence NUMERIC) AS $$
DECLARE
  v_old_iq NUMERIC;
  v_old_confidence NUMERIC;
  v_old_count INT;
  v_new_iq NUMERIC;
  v_new_confidence NUMERIC;
  v_alpha NUMERIC := 0.3;  -- EMA smoothing factor (higher = more weight to recent)
BEGIN
  -- Get current IQ data
  SELECT iq_score, confidence, evaluation_count 
  INTO v_old_iq, v_old_confidence, v_old_count
  FROM user_iq_level 
  WHERE user_id = p_user_id;
  
  -- Initialize if not exists
  IF NOT FOUND THEN
    INSERT INTO user_iq_level (user_id) VALUES (p_user_id);
    v_old_iq := 100.0;
    v_old_confidence := 0.0;
    v_old_count := 0;
  END IF;
  
  -- Calculate new IQ using exponential moving average
  -- For first few evaluations, use simple average
  IF v_old_count < 5 THEN
    v_new_iq := (v_old_iq * v_old_count + p_evaluation_score) / (v_old_count + 1);
  ELSE
    v_new_iq := v_alpha * p_evaluation_score + (1 - v_alpha) * v_old_iq;
  END IF;
  
  -- Clamp to valid range
  v_new_iq := GREATEST(50, LEAST(150, v_new_iq));
  
  -- Update confidence (increases with more data points, max 0.95)
  v_new_confidence := LEAST(0.95, (v_old_count + 1) / ((v_old_count + 1) + 10.0));
  
  -- Update user_iq_level
  UPDATE user_iq_level
  SET iq_score = v_new_iq,
      confidence = v_new_confidence,
      evaluation_count = v_old_count + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log evaluation
  INSERT INTO iq_evaluations (
    user_id, source, source_id, subject, evaluation_type,
    previous_iq, new_iq, iq_delta,
    bloom_level, question_complexity, demonstrates_understanding, reasoning_quality,
    reasoning
  ) VALUES (
    p_user_id, p_source, p_source_id, p_subject, 'iq_update',
    v_old_iq, v_new_iq, v_new_iq - v_old_iq,
    p_bloom_level::bloom_level_enum, p_question_complexity, p_demonstrates_understanding, p_reasoning_quality,
    p_reasoning
  );
  
  RETURN QUERY SELECT v_new_iq, (v_new_iq - v_old_iq), v_new_confidence;
END;
$$ LANGUAGE plpgsql;

-- Function to update knowledge level for a subject
CREATE OR REPLACE FUNCTION update_user_knowledge(
  p_user_id UUID,
  p_class INT,
  p_subject TEXT,
  p_bloom_level TEXT,
  p_score NUMERIC,  -- 0-100 score for this evaluation
  p_source TEXT,
  p_source_id TEXT DEFAULT NULL
) RETURNS TABLE(new_knowledge NUMERIC, knowledge_delta NUMERIC) AS $$
DECLARE
  v_old_knowledge NUMERIC;
  v_old_bloom_level NUMERIC;
  v_new_knowledge NUMERIC;
  v_new_bloom_level NUMERIC;
  v_alpha NUMERIC := 0.25;
  v_bloom_column TEXT;
  v_data_points INT;
BEGIN
  -- Get or create knowledge record
  INSERT INTO user_knowledge_level (user_id, class, subject)
  VALUES (p_user_id, p_class, p_subject)
  ON CONFLICT (user_id, class, subject) DO NOTHING;
  
  -- Get current values
  SELECT knowledge_score, quiz_data_points + tutor_data_points
  INTO v_old_knowledge, v_data_points
  FROM user_knowledge_level
  WHERE user_id = p_user_id AND class = p_class AND subject = p_subject;
  
  -- Determine bloom level column
  v_bloom_column := p_bloom_level || '_level';
  
  -- Get current bloom level value
  EXECUTE format('SELECT %I FROM user_knowledge_level WHERE user_id = $1 AND class = $2 AND subject = $3', v_bloom_column)
  INTO v_old_bloom_level
  USING p_user_id, p_class, p_subject;
  
  -- Calculate new bloom level (EMA)
  IF v_data_points < 5 THEN
    v_new_bloom_level := (v_old_bloom_level * v_data_points + p_score) / (v_data_points + 1);
  ELSE
    v_new_bloom_level := v_alpha * p_score + (1 - v_alpha) * v_old_bloom_level;
  END IF;
  v_new_bloom_level := GREATEST(0, LEAST(100, v_new_bloom_level));
  
  -- Update specific bloom level
  EXECUTE format('UPDATE user_knowledge_level SET %I = $1, updated_at = now() WHERE user_id = $2 AND class = $3 AND subject = $4', v_bloom_column)
  USING v_new_bloom_level, p_user_id, p_class, p_subject;
  
  -- Recalculate overall knowledge score (weighted average of bloom levels)
  -- Weights: remember=0.1, understand=0.15, apply=0.2, analyze=0.2, evaluate=0.2, create=0.15
  UPDATE user_knowledge_level
  SET knowledge_score = (
    remember_level * 0.10 +
    understand_level * 0.15 +
    apply_level * 0.20 +
    analyze_level * 0.20 +
    evaluate_level * 0.20 +
    create_level * 0.15
  ),
  updated_at = now()
  WHERE user_id = p_user_id AND class = p_class AND subject = p_subject
  RETURNING knowledge_score INTO v_new_knowledge;
  
  -- Update data point counter based on source
  IF p_source = 'quiz' THEN
    UPDATE user_knowledge_level SET quiz_data_points = quiz_data_points + 1
    WHERE user_id = p_user_id AND class = p_class AND subject = p_subject;
  ELSE
    UPDATE user_knowledge_level SET tutor_data_points = tutor_data_points + 1
    WHERE user_id = p_user_id AND class = p_class AND subject = p_subject;
  END IF;
  
  RETURN QUERY SELECT v_new_knowledge, (v_new_knowledge - v_old_knowledge);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on chapter progress
CREATE OR REPLACE FUNCTION update_chapter_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chapter_progress_updated_at ON user_chapter_progress;
CREATE TRIGGER chapter_progress_updated_at
  BEFORE UPDATE ON user_chapter_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_chapter_progress_timestamp();

-- =========================
-- COMMENTS
-- =========================
COMMENT ON TABLE user_chapter_progress IS 'Tracks user progress through curriculum chapters';
COMMENT ON TABLE badge_definitions IS 'Master list of all available badges';
COMMENT ON TABLE user_badges IS 'Badges earned by users';
COMMENT ON TABLE user_xp IS 'User experience points and level';
COMMENT ON TABLE xp_transactions IS 'History of XP gains';
COMMENT ON TABLE user_class_stats IS 'Aggregated user statistics for leaderboard';
COMMENT ON TABLE leaderboard_snapshots IS 'Archived weekly/monthly leaderboard rankings';
COMMENT ON TABLE user_iq_level IS 'User cognitive/IQ level tracking (internal use)';
COMMENT ON TABLE user_knowledge_level IS 'Per-subject knowledge level with Bloom taxonomy breakdown';
COMMENT ON TABLE iq_evaluations IS 'Audit trail of all IQ/knowledge evaluations';
