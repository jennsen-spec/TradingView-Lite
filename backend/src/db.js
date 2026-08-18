import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

// IMPORTANT: la base doit vivre HORS du dossier Documents (souvent synchronisé iCloud),
// sinon SQLite se bloque à l'ouverture (verrous de fichier + conflits de sync).
const dbDir = `${homedir()}/.tvlike`;
const dbPath = `${dbDir}/tvlike.db`;
mkdirSync(dbDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
// Pas de WAL: mono-utilisateur/mono-process, et le WAL (mmap shared-memory) se bloque
// sur certains systèmes de fichiers (dossier synchronisé / sandbox).

// Cache des séries OHLCV: une ligne par (symbol, interval), payload JSON + timestamp.
db.exec(`
  CREATE TABLE IF NOT EXISTS ohlcv_cache (
    symbol   TEXT NOT NULL,
    interval TEXT NOT NULL,
    payload  TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (symbol, interval)
  );

  -- Stockage applicatif clé/valeur (listes, layout, dessins). Un seul utilisateur.
  CREATE TABLE IF NOT EXISTS kv_store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);
