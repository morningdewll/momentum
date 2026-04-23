import { el, toast, download } from './util.js';
import { getPrefs, setPrefs, exportAll } from './store.js';

const CATEGORIES = [
  { id: null, label: 'show me anything' },
  { id: 'physical', label: 'physical' },
  { id: 'creative', label: 'creative' },
  { id: 'social', label: 'social' },
  { id: 'spiritual', label: 'spiritual' },
];

export function openSettings(onChange) {
  const prefs = getPrefs();

  const overlay = el('div', { class: 'modal-overlay', onClick: e => { if (e.target === overlay) close(); } });
  const panel = el('div', { class: 'modal-panel' });

  const close = () => {
    overlay.remove();
    if (onChange) onChange();
  };

  panel.appendChild(el('div', { class: 'modal-head' }, [
    el('h2', {}, 'Settings'),
    el('button', {
      class: 'btn-ghost',
      type: 'button',
      'aria-label': 'close',
      onClick: close,
    }, 'close'),
  ]));

  const wakeInput = numberField('wake', 'Wake hour', prefs.wake_hour, 0, 23);
  const sleepInput = numberField('sleep', 'Sleep hour', prefs.sleep_hour, 0, 23);
  wakeInput.input.addEventListener('change', () => {
    const v = clampInt(wakeInput.input.value, 0, 23);
    setPrefs({ wake_hour: v });
  });
  sleepInput.input.addEventListener('change', () => {
    const v = clampInt(sleepInput.input.value, 0, 23);
    setPrefs({ sleep_hour: v });
  });

  const categoryRow = el('div', { class: 'chip-row' });
  const chips = [];
  CATEGORIES.forEach(c => {
    const chip = el('button', {
      class: 'chip' + (prefs.category === c.id ? ' selected' : ''),
      type: 'button',
    }, c.label);
    chip.addEventListener('click', () => {
      setPrefs({ category: c.id });
      chips.forEach(x => x.classList.remove('selected'));
      chip.classList.add('selected');
      toast('Preference saved.');
    });
    categoryRow.appendChild(chip);
    chips.push(chip);
  });

  const exportBtn = el('button', {
    class: 'btn-secondary',
    type: 'button',
  }, 'Export data (JSON)');
  exportBtn.addEventListener('click', () => {
    const data = exportAll();
    download(`ebb-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
  });

  const darkBtn = el('button', {
    class: 'btn-secondary',
    type: 'button',
    disabled: 'disabled',
  }, 'Dark mode — coming later');

  panel.append(
    labelRow('Wake time', wakeInput.wrap),
    labelRow('Sleep time', sleepInput.wrap),
    labelRow('Suggest more', categoryRow),
    labelRow('Your data', exportBtn),
    labelRow('Appearance', darkBtn),
  );

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function numberField(id, label, value, min, max) {
  const input = el('input', {
    class: 'number-input',
    type: 'number',
    min: String(min),
    max: String(max),
    value: String(value),
    id,
  });
  const wrap = el('div', { class: 'number-wrap' }, [input, el('span', { class: 'number-unit' }, ':00')]);
  return { input, wrap };
}

function labelRow(label, child) {
  return el('div', { class: 'settings-row' }, [
    el('div', { class: 'settings-label' }, label),
    child,
  ]);
}

function clampInt(v, lo, hi) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
