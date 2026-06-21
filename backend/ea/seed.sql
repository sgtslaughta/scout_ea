-- Config: INSERT OR IGNORE keeps seed idempotent across re-init.
INSERT OR IGNORE INTO config(key, value) VALUES
  ('tz',                'America/New_York'),
  ('work_hours',        '07:00-18:00'),
  ('work_days',         'Mon,Tue,Wed,Thu,Fri'),
  ('heartbeat_minutes', '30'),
  ('priority_scale',    '1=critical,2=high,3=normal,4=low,5=info'),
  ('global_max_suggest','25'),
  ('web_port',          '8765'),
  ('mcp_port',          '8766');

INSERT OR IGNORE INTO people(id, name, role, org, importance) VALUES
  (1, 'Dr. Vance', 'Regional VP', 'Acme', 1);

INSERT OR IGNORE INTO topics(id, name, description, priority) VALUES
  (1, 'AI agents', 'Autonomous agent frameworks and tooling', 2);
