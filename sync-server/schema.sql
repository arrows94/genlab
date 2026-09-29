-- Genlab sync: one encrypted save per sync code (id = SHA-256 derived from the code).
CREATE TABLE IF NOT EXISTS saves (
  id TEXT PRIMARY KEY,
  rev INTEGER NOT NULL,
  saved_at INTEGER NOT NULL,
  device TEXT NOT NULL,
  writer TEXT NOT NULL,
  -- JSON [{ rev, writer }] of the last revisions, so a device finds its own upload after a lost response.
  history TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- No index on updated_at on purpose: an index row would be written with every upload (D1 bills rows
-- written), while the daily cleanup scanning the table once only costs rows read.
