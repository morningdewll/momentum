import { el, toast } from './util.js';
import { addEntry, todayEntry, hasEntryToday } from './store.js';

const MOOD_WORDS = ['', 'rough', 'low', 'okay', 'good', 'great'];

export function renderCheckin(root, { onSubmit, onEdit }) {
  root.innerHTML = '';
  if (hasEntryToday()) {
    root.appendChild(renderLoggedState(todayEntry(), onEdit));
  } else {
    root.appendChild(renderPicker(onSubmit));
  }
}

function renderPicker(onSubmit) {
  const state = { mood: null };
  const wrap = el('div', { class: 'checkin-picker' });

  const label = el('div', { class: 'section-label' }, 'Today');
  const scale = el('div', { class: 'mood-scale' });
  const scaleBtns = [];
  for (let i = 1; i <= 5; i++) {
    const btn = el('button', {
      class: 'mood-btn',
      type: 'button',
      'aria-label': `mood ${i} — ${MOOD_WORDS[i]}`,
    }, [
      el('span', { class: 'mood-num' }, String(i)),
      el('span', { class: 'mood-word' }, MOOD_WORDS[i]),
    ]);
    btn.addEventListener('click', () => {
      state.mood = i;
      scaleBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      submit.disabled = false;
    });
    scale.appendChild(btn);
    scaleBtns.push(btn);
  }

  const note = el('input', {
    class: 'note-input',
    type: 'text',
    placeholder: 'Anything on your mind? (optional)',
    maxlength: 140,
  });

  const submit = el('button', {
    class: 'btn-primary',
    type: 'button',
    disabled: 'disabled',
  }, 'Log today');
  submit.addEventListener('click', () => {
    if (state.mood == null) return;
    const entry = {
      date: new Date().toISOString(),
      mood: state.mood,
      note: note.value.trim(),
    };
    addEntry(entry);
    toast('Logged.');
    onSubmit(entry);
  });

  wrap.append(label, scale, note, submit);
  return wrap;
}

function renderLoggedState(entry, onEdit) {
  const wrap = el('div', { class: 'logged-state' });
  const score = el('div', { class: 'logged-score' }, `${entry.mood} / 5`);
  const word = el('div', { class: 'logged-word' }, MOOD_WORDS[entry.mood]);
  wrap.append(score, word);
  if (entry.note) {
    wrap.appendChild(el('div', { class: 'logged-note' }, `"${entry.note}"`));
  }
  const edit = el('button', {
    class: 'btn-ghost',
    type: 'button',
  }, 'change today\'s entry');
  edit.addEventListener('click', () => onEdit && onEdit());
  wrap.appendChild(edit);
  return wrap;
}
