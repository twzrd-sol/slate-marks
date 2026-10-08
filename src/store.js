import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSlate } from "./slate.js";

function openDb(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS slate (id INTEGER PRIMARY KEY, body TEXT NOT NULL)`);
  return db;
}

export function loadSlate(dbPath) {
  const db = openDb(dbPath);
  const row = db.prepare("SELECT body FROM slate WHERE id = 1").get();
  db.close();
  if (!row) return createSlate();
  return JSON.parse(row.body);
}

export function saveSlate(dbPath, slate) {
  const db = openDb(dbPath);
  db.prepare(
    `INSERT INTO slate (id, body) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET body = excluded.body`,
  ).run(JSON.stringify(slate));
  db.close();
}
