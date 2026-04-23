import { el } from './util.js';
import { dateKey } from './util.js';

const DAYS = 30;

export function renderCalendar(root, entries) {
  root.innerHTML = '';
  const map = {};
  for (const e of entries) {
    const k = dateKey(e.date);
    if (!(k in map)) map[k] = e.mood;
  }
  const grid = el('div', { class: 'cal-grid' });
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dateKey(d);
    const mood = map[k];
    const classes = ['cal-day'];
    if (mood) classes.push(`m${mood}`);
    if (i === 0) classes.push('today');
    grid.appendChild(el('div', { class: classes.join(' '), title: k }));
  }
  root.appendChild(grid);
}
