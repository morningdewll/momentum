import { ACTIVITIES, byId } from './activities-library.js';
import {
  getPrefs, getScore, bumpScore,
  getDailyShown, markShown, incReroll, incCompleted, getDailyCounts,
  logActivity,
} from './store.js';

export const MAX_REROLLS = 2;
export const MAX_COMPLETIONS = 3;

export function getTimeBucket(now = new Date(), prefs = getPrefs()) {
  const h = now.getHours();
  const { wake_hour, sleep_hour } = prefs;
  const afternoonStart = (wake_hour + 4) % 24;
  const eveningStart = (wake_hour + 8) % 24;
  const lateNightStart = (sleep_hour - 1 + 24) % 24;

  if (inRange(h, lateNightStart, wake_hour)) return 'late_night';
  if (inRange(h, wake_hour, afternoonStart))  return 'morning';
  if (inRange(h, afternoonStart, eveningStart)) return 'afternoon';
  if (inRange(h, eveningStart, lateNightStart)) return 'evening';
  return 'evening';
}

function inRange(h, start, end) {
  if (start === end) return false;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

export function isDaylightHour(now = new Date(), prefs = getPrefs()) {
  const h = now.getHours();
  const dayStart = Math.min(Math.max(prefs.wake_hour, 6), 9);
  const dayEnd = Math.min(Math.max(prefs.sleep_hour - 3, 17), 20);
  return h >= dayStart && h < dayEnd;
}

function matchesTime(activity, bucket, daylight) {
  if (!activity.time_of_day.includes(bucket) && !activity.time_of_day.includes('any')) return false;
  if (activity.requires_daylight && !daylight) return false;
  return true;
}

function matchesMood(activity, mood) {
  return activity.mood_range.includes(mood);
}

export function filterPool(mood, { bucket, daylight, category, exclude = [] } = {}) {
  bucket = bucket ?? getTimeBucket();
  daylight = daylight ?? isDaylightHour();
  let pool = ACTIVITIES.filter(a =>
    matchesMood(a, mood) &&
    matchesTime(a, bucket, daylight) &&
    !exclude.includes(a.id)
  );
  if (category) {
    const narrowed = pool.filter(a => a.category === category);
    if (narrowed.length > 0) pool = narrowed;
  }
  return pool;
}

export function pickActivity(mood, { exclude = [] } = {}) {
  const prefs = getPrefs();
  const dailyShown = getDailyShown();
  const excludeAll = [...new Set([...exclude, ...dailyShown])];

  let pool = filterPool(mood, { category: prefs.category, exclude: excludeAll });
  if (pool.length === 0) pool = filterPool(mood, { exclude: excludeAll });
  if (pool.length === 0) pool = filterPool(mood, { daylight: true, exclude: excludeAll });
  if (pool.length === 0) pool = ACTIVITIES.filter(a => matchesMood(a, mood) && !excludeAll.includes(a.id));
  if (pool.length === 0) pool = ACTIVITIES.filter(a => matchesMood(a, mood));
  if (pool.length === 0) return null;

  const scored = pool.map(a => ({
    activity: a,
    weight: getScore(a.id) * (0.85 + Math.random() * 0.3),
  }));
  scored.sort((x, y) => y.weight - x.weight);
  const picked = scored[0].activity;
  markShown(picked.id);
  return picked;
}

export function canReroll() {
  return getDailyCounts().rerolls < MAX_REROLLS;
}

export function canComplete() {
  return getDailyCounts().completed < MAX_COMPLETIONS;
}

export function rerollCount() {
  return getDailyCounts().rerolls;
}

export function completionCount() {
  return getDailyCounts().completed;
}

export function onReroll(prevId) {
  if (prevId) bumpScore(prevId, 0.92);
  incReroll();
}

export function onComplete(id, { helped = null } = {}) {
  const factor = helped === true ? 1.20 : 1.05;
  bumpScore(id, factor);
  logActivity({ id, completed: true, helped });
  incCompleted();
}

export { byId };
