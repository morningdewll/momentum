import { $, el, formatDate, toast } from './util.js';
import { ready, getEntries, getPrefs, setPrefs, hasEntryToday, todayEntry } from './store.js';
import { renderCheckin } from './mood.js';
import { renderCalendar } from './calendar.js';
import * as graph from './graph.js';
import {
  pickActivity, onReroll, onComplete, canReroll, canComplete,
  rerollCount, MAX_REROLLS, byId,
} from './activities.js';
import { openSettings } from './settings.js';

ready();

const CATEGORIES = [
  { id: 'physical', label: 'physical' },
  { id: 'creative', label: 'creative' },
  { id: 'social', label: 'social' },
  { id: 'spiritual', label: 'spiritual' },
  { id: null, label: 'show me anything' },
];

function mount() {
  const root = $('#app');
  root.innerHTML = '';

  const header = el('div', { class: 'app-header' }, [
    el('div', {}, [
      el('h1', { class: 'app-title' }, 'Ebb'),
      el('div', { class: 'app-date' }, formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })),
    ]),
    el('button', {
      class: 'cog-btn',
      type: 'button',
      'aria-label': 'settings',
      onClick: () => openSettings(() => repaint()),
    }, '⚙'),
  ]);

  const consistencyBadge = el('div', { class: 'consistency' });
  const checkinSection = el('section', { class: 'card', id: 'checkin-card' });
  const activitySection = el('section', { class: 'activity-wrap', id: 'activity-wrap' });
  const graphSection = el('section', { class: 'card', id: 'graph-card' }, [
    el('div', { class: 'section-label' }, 'Trajectory'),
    el('canvas', { id: 'moodChart', height: '180' }),
    el('div', { class: 'zone-legend' }, [
      zoneItem('thriving', 'thriving'),
      zoneItem('watch', 'watch'),
      zoneItem('struggle', 'struggling'),
    ]),
  ]);
  const calSection = el('section', { class: 'card', id: 'cal-card' }, [
    el('div', { class: 'section-label' }, 'Last 30 days'),
    el('div', { id: 'cal-root' }),
  ]);

  root.append(header, consistencyBadge, checkinSection, activitySection, graphSection, calSection);

  repaint();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function repaint() {
  const entries = getEntries();
  paintConsistency(entries);
  paintGraph(entries);
  renderCalendar($('#cal-root'), entries);
  paintCheckin(entries);
}

function paintCheckin(entries) {
  const card = $('#checkin-card');
  const wrap = $('#activity-wrap');

  renderCheckin(card, {
    onSubmit: (entry) => {
      paintAfterSubmit(entry, entries.length === 0);
      paintGraph(getEntries());
      renderCalendar($('#cal-root'), getEntries());
      paintConsistency(getEntries());
    },
    onEdit: () => {
      const card = $('#checkin-card');
      const wrap = $('#activity-wrap');
      wrap.innerHTML = '';
      renderCheckin(card, {
        onSubmit: (entry) => {
          paintAfterSubmit(entry, false);
          paintGraph(getEntries());
          renderCalendar($('#cal-root'), getEntries());
          paintConsistency(getEntries());
        },
      });
    },
  });

  if (hasEntryToday()) {
    const today = todayEntry();
    paintActivityForMood(today.mood);
  } else {
    wrap.innerHTML = '';
  }
}

function paintAfterSubmit(entry, isFirstEver) {
  paintActivityForMood(entry.mood);
  if (isFirstEver) paintCategoryChips();
}

function paintActivityForMood(mood) {
  const wrap = $('#activity-wrap');
  wrap.innerHTML = '';
  const activity = pickActivity(mood);
  if (!activity) {
    wrap.appendChild(el('p', { class: 'activity-done' }, 'No fitting activity right now. That\'s okay.'));
    return;
  }
  wrap.appendChild(buildActivityCard(activity, mood, { committed: false }));
}

function buildActivityCard(activity, mood, { committed }) {
  const card = el('section', { class: 'card activity-card' });
  card.appendChild(el('div', { class: 'section-label' }, committed ? 'Your activity' : 'Suggested'));
  card.appendChild(el('div', { class: 'activity-title' }, activity.text));

  if (!committed) {
    card.appendChild(el('div', { class: 'activity-why' }, activity.why));
  } else {
    card.appendChild(el('div', { class: 'activity-instructions' }, activity.instructions));
  }

  const dots = el('div', { class: 'benefit-dots' });
  for (let i = 1; i <= 3; i++) {
    dots.appendChild(el('div', { class: 'benefit-dot' + (i <= activity.benefit ? ' filled' : '') }));
  }
  card.appendChild(el('div', { class: 'benefit-row' }, [
    el('span', { class: 'benefit-label' }, 'impact'),
    dots,
  ]));

  if (!committed) {
    const commit = el('button', { class: 'btn-primary', type: 'button' }, 'Do this');
    commit.addEventListener('click', () => {
      const wrap = $('#activity-wrap');
      wrap.innerHTML = '';
      wrap.appendChild(buildActivityCard(activity, mood, { committed: true }));
    });

    const rerollLeft = MAX_REROLLS - rerollCount();
    const reroll = el('button', {
      class: 'btn-ghost',
      type: 'button',
      disabled: rerollLeft <= 0 ? 'disabled' : null,
    }, `Try another (${rerollLeft} left)`);
    reroll.addEventListener('click', () => {
      if (!canReroll()) return;
      onReroll(activity.id);
      const next = pickActivity(mood);
      const wrap = $('#activity-wrap');
      wrap.innerHTML = '';
      if (next) {
        wrap.appendChild(buildActivityCard(next, mood, { committed: false }));
      } else {
        wrap.appendChild(el('p', { class: 'activity-done' }, 'Out of ideas right now. That\'s okay.'));
      }
    });

    card.appendChild(el('div', { class: 'activity-actions' }, [commit, reroll]));
  } else {
    const done = el('button', { class: 'btn-primary', type: 'button' }, 'I did this');
    done.addEventListener('click', () => {
      onComplete(activity.id, { helped: null });
      toast('Logged. That counts.');
      paintActivityDone(mood);
    });

    const helped = el('button', { class: 'btn-ghost', type: 'button' }, 'it helped');
    helped.addEventListener('click', () => {
      onComplete(activity.id, { helped: true });
      toast('Logged — that helped.');
      paintActivityDone(mood);
    });

    card.appendChild(el('div', { class: 'activity-actions' }, [done, helped]));
  }

  return card;
}

function paintActivityDone(mood) {
  const wrap = $('#activity-wrap');
  wrap.innerHTML = '';
  if (canComplete()) {
    const again = el('button', { class: 'btn-ghost-block', type: 'button' }, 'Do another activity?');
    again.addEventListener('click', () => paintActivityForMood(mood));
    wrap.appendChild(again);
  } else {
    wrap.appendChild(el('p', { class: 'activity-done' }, 'That\'s enough for today. Rest counts too.'));
  }
}

function paintCategoryChips() {
  const existing = $('#category-chips');
  if (existing) existing.remove();
  const wrap = el('section', { class: 'card category-card', id: 'category-chips' });
  wrap.appendChild(el('div', { class: 'section-label' }, 'What tends to help you?'));
  wrap.appendChild(el('div', { class: 'category-hint' }, 'Ebb will suggest more of what fits. Skip if unsure.'));
  const row = el('div', { class: 'chip-row' });
  CATEGORIES.forEach(c => {
    const chip = el('button', { class: 'chip', type: 'button' }, c.label);
    chip.addEventListener('click', () => {
      setPrefs({ category: c.id });
      toast('Preference saved.');
      wrap.remove();
    });
    row.appendChild(chip);
  });
  wrap.appendChild(row);
  const activity = $('#activity-wrap');
  activity.parentNode.insertBefore(wrap, activity.nextSibling);
}

function paintConsistency(entries) {
  const badge = $('.consistency');
  if (!badge) return;
  const thirty = 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (thirty - 1));
  const count = entries.filter(e => new Date(e.date) >= cutoff).length;
  const pct = Math.round((count / thirty) * 100);
  badge.textContent = count === 0 ? 'no check-ins yet' : `${pct}% consistent — last 30 days`;
}

function paintGraph(entries) {
  const canvas = $('#moodChart');
  if (!canvas) return;
  graph.renderChart(canvas, entries);
}

function zoneItem(cls, label) {
  return el('div', { class: 'zone-item' }, [
    el('span', { class: `zone-dot zone-${cls}` }),
    label,
  ]);
}

let graphResizeBound = false;
window.addEventListener('resize', () => {
  const canvas = $('#moodChart');
  if (canvas) graph.renderChart(canvas, getEntries());
});

document.addEventListener('DOMContentLoaded', mount);
