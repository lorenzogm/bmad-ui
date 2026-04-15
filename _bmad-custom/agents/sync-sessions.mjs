#!/usr/bin/env node
/**
 * sync-sessions.mjs
 *
 * Watches GitHub Copilot debug logs and auto-syncs session data into
 * _bmad-custom/agents/agent-sessions.json. Runs as a background daemon.
 *
 * Auto-derived fields (from main.jsonl):
 *   session_id, turns, start_date, status
 *   end_date: set when session is inactive > INACTIVE_THRESHOLD_MS
 *
 * Preserved fields (not overwritten if already set):
 *   tool, model, premium, premium_requests, premium_multiplier,
 *   premium_cost_units, tokens, agent, notes
 *
 * Usage:
 *   node _bmad-custom/agents/sync-sessions.mjs         # watch + sync
 *   node _bmad-custom/agents/sync-sessions.mjs --once  # sync once and exit
 */

import { readFileSync, writeFileSync, watchFile, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const DEBUG_LOGS_BASE = join(
  homedir(),
  'Library/Application Support/Code - Insiders/User/workspaceStorage/e33633a4b59213a9cbfe28a0c746f7af/GitHub.copilot-chat/debug-logs'
);

const OUTPUT_FILE = resolve(__dirname, 'agent-sessions.json');

/** Sessions not updated for this long are marked completed */
const INACTIVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/** Poll interval for watching each jsonl file (ms) */
const WATCH_INTERVAL_MS = 5000;

/** Minimum turns to include a session (ignore single-turn noise) */
const MIN_TURNS = 2;

// ─── Parse a session's debug log ─────────────────────────────────────────────

function parseDebugLog(sessionId) {
  const path = join(DEBUG_LOGS_BASE, sessionId, 'main.jsonl');
  if (!existsSync(path)) return null;

  try {
    const lines = readFileSync(path, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return null;

    const events = lines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    const turns = events.length;
    const firstTs = events[0].ts;
    const lastTs = events[events.length - 1].ts;
    const now = Date.now();
    const isInactive = now - lastTs > INACTIVE_THRESHOLD_MS;

    return {
      session_id: sessionId,
      turns,
      start_date: new Date(firstTs).toISOString(),
      last_ts: lastTs,
      end_date: isInactive ? new Date(lastTs).toISOString() : null,
      status: isInactive ? 'completed' : 'running',
    };
  } catch (err) {
    console.error(`[sync] Error parsing ${sessionId}:`, err.message);
    return null;
  }
}

// ─── Read / write agent-sessions.json ────────────────────────────────────────

function readSessions() {
  try {
    const data = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
    // Normalize: if sessions is an array, convert to dict keyed by session_id/sessionId
    if (Array.isArray(data.sessions)) {
      const dict = {};
      for (const s of data.sessions) {
        const key = s.session_id || s.sessionId || '';
        if (key) dict[key] = s;
      }
      data.sessions = dict;
    }
    return data;
  } catch {
    return { sessions: {} };
  }
}

function writeSessions(data) {
  writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ─── Upsert a parsed session into the JSON file ───────────────────────────────

function upsertSession(parsed) {
  const data = readSessions();
  const key = parsed.session_id;
  const existing = data.sessions[key];

  if (existing) {
    data.sessions[key] = {
      // Preserved manual fields (not overwritten)
      tool: existing.tool ?? 'copilot-cli',
      model: existing.model ?? 'claude-sonnet-4.6',
      premium: existing.premium ?? true,
      premium_requests: existing.premium_requests ?? 0,
      premium_multiplier: existing.premium_multiplier ?? 1,
      premium_cost_units: existing.premium_cost_units ?? 0,
      tokens: existing.tokens ?? { input: 0, output: 0, total: 0 },
      agent: existing.agent ?? 'general',
      notes: existing.notes ?? '',
      // Auto-updated fields
      session_id: parsed.session_id,
      turns: parsed.turns,
      start_date: parsed.start_date,
      // If new turns came in, clear end_date (session resumed)
      // If no new turns, preserve whatever end_date was already set
      end_date: parsed.status === 'running' && parsed.turns > (existing.turns ?? 0)
        ? null
        : (existing.end_date ?? parsed.end_date ?? null),
      status: parsed.status === 'running' && parsed.turns > (existing.turns ?? 0)
        ? 'running'
        : (existing.status ?? parsed.status),
    };
  } else {
    // New session — add with defaults
    data.sessions[key] = {
      session_id: parsed.session_id,
      tool: 'copilot-cli',
      model: 'claude-sonnet-4.6',
      premium: true,
      premium_requests: 0,
      premium_multiplier: 1,
      premium_cost_units: 0,
      tokens: { input: 0, output: 0, total: 0 },
      agent: 'general',
      turns: parsed.turns,
      status: parsed.status,
      start_date: parsed.start_date,
      end_date: parsed.end_date,
      notes: '',
    };
  }

  writeSessions(data);
  console.log(`[sync] Updated session ${parsed.session_id}: turns=${parsed.turns}, status=${parsed.status}`);
}

// ─── Sync all sessions ────────────────────────────────────────────────────────

function syncAll() {
  if (!existsSync(DEBUG_LOGS_BASE)) {
    console.error('[sync] Debug logs directory not found:', DEBUG_LOGS_BASE);
    return;
  }

  const sessionIds = readdirSync(DEBUG_LOGS_BASE);
  let updated = 0;

  for (const sessionId of sessionIds) {
    const parsed = parseDebugLog(sessionId);
    if (!parsed) continue;
    if (parsed.turns < MIN_TURNS) continue; // skip noise
    upsertSession(parsed);
    updated++;
  }

  console.log(`[sync] Synced ${updated} sessions at ${new Date().toISOString()}`);
}

// ─── Watch mode ───────────────────────────────────────────────────────────────

function watchSession(sessionId) {
  const logPath = join(DEBUG_LOGS_BASE, sessionId, 'main.jsonl');
  if (!existsSync(logPath)) return;

  watchFile(logPath, { interval: WATCH_INTERVAL_MS }, () => {
    const parsed = parseDebugLog(sessionId);
    if (parsed && parsed.turns >= MIN_TURNS) {
      upsertSession(parsed);
    }
  });
}

function startWatching() {
  if (!existsSync(DEBUG_LOGS_BASE)) {
    console.error('[sync] Debug logs directory not found:', DEBUG_LOGS_BASE);
    process.exit(1);
  }

  // Initial sync
  syncAll();

  // Watch all existing sessions
  const sessionIds = readdirSync(DEBUG_LOGS_BASE);
  for (const sessionId of sessionIds) {
    watchSession(sessionId);
  }

  // Periodically re-scan for new sessions + full re-sync
  setInterval(() => {
    syncAll();
    const currentIds = readdirSync(DEBUG_LOGS_BASE);
    for (const sessionId of currentIds) {
      watchSession(sessionId); // watchFile is idempotent for same path
    }
  }, 60_000); // re-scan every minute

  console.log(`[sync] Watching ${sessionIds.length} sessions. Press Ctrl+C to stop.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--once')) {
  syncAll();
} else {
  startWatching();
}
