-- charts (부모 테이블)
CREATE TABLE IF NOT EXISTS charts (
  id UUID PRIMARY KEY,
  slug TEXT,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  family TEXT NOT NULL,
  renderer TEXT NOT NULL,
  description TEXT,
  dataset_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- chart_codes
CREATE TABLE IF NOT EXISTS chart_codes (
  id SERIAL PRIMARY KEY,
  chart_id UUID NOT NULL REFERENCES charts(id),
  title TEXT NOT NULL,
  html_code TEXT NOT NULL DEFAULT '',
  css_code TEXT NOT NULL DEFAULT '',
  js_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- chart_questions
CREATE TABLE IF NOT EXISTS chart_questions (
  id SERIAL PRIMARY KEY,
  chart_id UUID NOT NULL REFERENCES charts(id),
  question TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ai_runs
CREATE TABLE IF NOT EXISTS ai_runs (
  id SERIAL PRIMARY KEY,
  chart_id UUID NOT NULL REFERENCES charts(id),
  source TEXT NOT NULL,
  family TEXT NOT NULL,
  selected_question_index INTEGER,
  question_text TEXT,
  stop_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ai_run_steps
CREATE TABLE IF NOT EXISTS ai_run_steps (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES ai_runs(id),
  step_index INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS charts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  family TEXT NOT NULL,
  renderer TEXT NOT NULL,
  description TEXT,
  dataset_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chart_codes (
  id SERIAL PRIMARY KEY,
  chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  html_code TEXT NOT NULL DEFAULT '',
  css_code TEXT NOT NULL DEFAULT '',
  js_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chart_questions (
  id SERIAL PRIMARY KEY,
  chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE RESTRICT,
  question TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id SERIAL PRIMARY KEY,
  run_id UUID NOT NULL,
  chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE RESTRICT,
  source TEXT NOT NULL,
  family TEXT NOT NULL,
  selected_question_index INTEGER,
  question_text TEXT,
  stop_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_run_steps (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES ai_runs(id) ON DELETE RESTRICT,
  step_index INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);