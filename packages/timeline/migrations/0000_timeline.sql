CREATE TABLE timeline_ticks (
  tick_id TEXT PRIMARY KEY NOT NULL,
  agent_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  phase TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE UNIQUE INDEX timeline_sequence ON timeline_ticks(agent_id, sequence);
CREATE UNIQUE INDEX timeline_active ON timeline_ticks(agent_id)
  WHERE phase IN ('reserved', 'decided');
