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

-- Data Feed demo content
INSERT OR IGNORE INTO news_items(id, title, url, synopsis, external_ref, topic_id, source, event_at, relevance, status) VALUES
  (1, 'New agent framework hits 1.0', 'https://example.com/agents-1-0', 'A widely used agent framework shipped its 1.0 with tool-calling improvements.', 'https://example.com/agents-1-0', 1, 'news', '2026-07-10T13:00:00', 1, 'new'),
  (2, 'Internal: Platform team weekly digest', 'https://intranet/acme/digest', 'Roundup of platform chatter across Teams channels this week.', 'https://intranet/acme/digest', 1, 'teams', '2026-07-09T17:00:00', 2, 'new');

INSERT OR IGNORE INTO learning(id, kind, source, title, synopsis, url, external_ref, provider, event_at, topic_id, relevance, status) VALUES
  (1, 'course', 'email', 'Kubernetes for Operators', 'Hands-on operator patterns and CRDs.', 'https://learn.example.com/k8s-ops', 'learn:k8s-ops', 'ExampleLearn', '2026-07-20T15:00:00', 1, 1, 'suggested');

-- origin + subject tags via the universal system
INSERT OR IGNORE INTO tags(id, name, color) VALUES (1, 'external', 'blue'), (2, 'internal', 'violet');
INSERT OR IGNORE INTO content_tags(tag_id, ref_type, ref_id) VALUES (1, 'news', 1), (2, 'news', 2);
INSERT OR IGNORE INTO content_links(ref_type, ref_id, target_type, target_id) VALUES
  ('news', 1, 'topic', 1), ('news', 1, 'person', 1), ('learning', 1, 'topic', 1);
