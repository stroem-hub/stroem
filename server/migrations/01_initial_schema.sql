CREATE TABLE IF NOT EXISTS job (
  job_id TEXT PRIMARY KEY,
  task_name TEXT,
  action_name TEXT,
  input JSONB,
  revision TEXT,
  worker_id TEXT,
  queued TIMESTAMP WITH TIME ZONE NOT NULL,
  picked TIMESTAMP WITH TIME ZONE,
  start_datetime TIMESTAMP WITH TIME ZONE,
  end_datetime TIMESTAMP WITH TIME ZONE,
  output JSONB,
  success BOOLEAN,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  source_type TEXT NOT NULL CHECK (source_type IN ('trigger', 'user', 'webhook')),
  source_id TEXT
);

CREATE TABLE IF NOT EXISTS job_step (
  job_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  input JSONB,
  output JSONB,
  success BOOLEAN,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (job_id, step_name),
  FOREIGN KEY (job_id) REFERENCES job (job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_status ON job (status);
CREATE INDEX IF NOT EXISTS idx_job_worker_id ON job (worker_id);
CREATE INDEX IF NOT EXISTS idx_job_queued ON job (queued);
CREATE INDEX IF NOT EXISTS idx_job_steps_job_id ON job_step (job_id);