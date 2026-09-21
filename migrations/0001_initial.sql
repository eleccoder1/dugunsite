CREATE TABLE settings (
  k TEXT PRIMARY KEY NOT NULL,
  v TEXT NOT NULL
);

CREATE TABLE rsvp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  status TEXT NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  image TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  private INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX memories_public_idx ON memories(approved, private, id DESC);

CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  thumb_key TEXT,
  original_name TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploader TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  private INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX media_public_idx ON media(approved, private, id DESC);

CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE upload_parts (
  session_id TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY(session_id, part_number)
);

CREATE TABLE quiz_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX quiz_score_idx ON quiz_scores(score DESC, id ASC);

CREATE TABLE quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  soru TEXT NOT NULL,
  siklar TEXT NOT NULL,
  dogru INTEGER NOT NULL DEFAULT 0,
  sira INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX quiz_order_idx ON quiz_questions(sira, id);

CREATE TABLE rate_limits (
  k TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX rate_limit_idx ON rate_limits(k, ts);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

INSERT INTO settings(k, v) VALUES
  ('rsvp_open', '1'),
  ('memories_open', '0'),
  ('uploads_open', '0'),
  ('oyun_open', '0'),
  ('auto_wedding_day', '1'),
  ('auto_approve', '0');

INSERT INTO quiz_questions(soru, siklar, dogru, sira, created_at) VALUES
  ('İlk tanıştıkları yer neresi?', '["Okul","Kafe","Yıldız ailesi aracılığıyla :)","İş yeri"]', 2, 0, datetime('now')),
  ('"Nereye gidelim?" sorusuna 47 seçenek sunan kim?', '["Elif","Yusuf Çağrı","İkisi de"]', 1, 1, datetime('now')),
  ('Acıkınca karakteri değişen kim?', '["Elif","Yusuf Çağrı","İkisi de"]', 0, 2, datetime('now')),
  ('"Sadece bakacağız" deyip en çok alışveriş yapan kim?', '["Elif","Yusuf Çağrı","İkisi de"]', 2, 3, datetime('now')),
  ('Yusuf''un Elif''e en sık söylediği cümle hangisi?', '["Ne kadar sürer?","Nereye gidiyoruz?","Sen bilirsin","Ben hallederim"]', 3, 4, datetime('now'));
