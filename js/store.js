import { clamp, dateKey } from './util.js';

const NS = 'ebb.v1.';
const K = {
  schema: NS + 'schema_version',
  entries: NS + 'entries',
  log: NS + 'activity_log',
  scores: NS + 'activity_scores',
  prefs: NS + 'prefs',
  daily: NS + 'daily',
};

const DEFAULT_PREFS = {
  category: null,
  wake_hour: 7,
  sleep_hour: 23,
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function ready() {
  const v = load(K.schema);
  if (v === 1) return;
  migrateFromV0();
  save(K.schema, 1);
}

function migrateFromV0() {
  const oldEntries = load('momentum_v3');
  if (Array.isArray(oldEntries) && oldEntries.length > 0) {
    const cleaned = oldEntries
      .filter(e => e && e.date && e.mood >= 1 && e.mood <= 5)
      .map(e => ({ date: e.date, mood: e.mood, note: e.note || '' }));
    save(K.entries, cleaned);
  }
  const oldPref = load('momentum_pref');
  if (typeof oldPref === 'string') {
    const prefs = { ...DEFAULT_PREFS, category: oldPref === 'general' ? null : oldPref };
    save(K.prefs, prefs);
  }
}

export function getEntries() {
  return load(K.entries, []);
}

export function addEntry(entry) {
  const entries = getEntries();
  const today = dateKey();
  const filtered = entries.filter(e => dateKey(e.date) !== today);
  filtered.unshift(entry);
  save(K.entries, filtered);
}

export function hasEntryToday() {
  const today = dateKey();
  return getEntries().some(e => dateKey(e.date) === today);
}

export function todayEntry() {
  const today = dateKey();
  return getEntries().find(e => dateKey(e.date) === today) || null;
}

export function getLog() {
  return load(K.log, []);
}

export function logActivity({ id, completed, helped }) {
  const log = getLog();
  log.unshift({ id, date: new Date().toISOString(), completed: !!completed, helped: helped ?? null });
  save(K.log, log.slice(0, 500));
}

export function getScore(id) {
  const scores = load(K.scores, {});
  return scores[id] ?? 1.0;
}

export function bumpScore(id, factor) {
  const scores = load(K.scores, {});
  const next = clamp((scores[id] ?? 1.0) * factor, 0.3, 2.0);
  scores[id] = next;
  save(K.scores, scores);
  return next;
}

export function getPrefs() {
  return { ...DEFAULT_PREFS, ...load(K.prefs, {}) };
}

export function setPrefs(patch) {
  const prefs = getPrefs();
  save(K.prefs, { ...prefs, ...patch });
}

function getDaily(date = dateKey()) {
  const all = load(K.daily, {});
  return all[date] || { shown: [], completed: 0, rerolls: 0 };
}

export function getDailyShown(date = dateKey()) {
  return getDaily(date).shown;
}

export function getDailyCounts(date = dateKey()) {
  const d = getDaily(date);
  return { completed: d.completed, rerolls: d.rerolls };
}

export function markShown(id, date = dateKey()) {
  const all = load(K.daily, {});
  const d = all[date] || { shown: [], completed: 0, rerolls: 0 };
  if (!d.shown.includes(id)) d.shown.push(id);
  all[date] = d;
  save(K.daily, all);
}

export function incReroll(date = dateKey()) {
  const all = load(K.daily, {});
  const d = all[date] || { shown: [], completed: 0, rerolls: 0 };
  d.rerolls += 1;
  all[date] = d;
  save(K.daily, all);
}

export function incCompleted(date = dateKey()) {
  const all = load(K.daily, {});
  const d = all[date] || { shown: [], completed: 0, rerolls: 0 };
  d.completed += 1;
  all[date] = d;
  save(K.daily, all);
}

export function exportAll() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(NS)) {
      try { out[key] = JSON.parse(localStorage.getItem(key)); } catch { out[key] = null; }
    }
  }
  return out;
}

export const KEYS = K;
