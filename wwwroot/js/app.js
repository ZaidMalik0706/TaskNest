// Dashboard: rendering, filters, the task modal, the offline queue and reminders.
const els = {
  badge: document.getElementById('connection-badge'),
  pendingBadge: document.getElementById('pending-badge'),
  reminderBtn: document.getElementById('reminder-btn'),
  addBtn: document.getElementById('add-task-btn'),
  tabs: document.querySelector('.tabs'),
  categoryFilter: document.getElementById('category-filter'),
  search: document.getElementById('search-input'),
  offlineNotice: document.getElementById('offline-notice'),
  status: document.getElementById('status-message'),
  loading: document.getElementById('loading'),
  grid: document.getElementById('task-grid'),
  empty: document.getElementById('empty-state'),
  summary: document.getElementById('task-summary'),
  modal: document.getElementById('task-modal'),
  modalTitle: document.getElementById('modal-title'),
  form: document.getElementById('task-form'),
  taskId: document.getElementById('task-id'),
  title: document.getElementById('task-title'),
  notes: document.getElementById('task-notes'),
  priority: document.getElementById('task-priority'),
  due: document.getElementById('task-due'),
  category: document.getElementById('task-category'),
  titleError: document.getElementById('title-error'),
  subtaskList: document.getElementById('subtask-list'),
  newSubtask: document.getElementById('new-subtask'),
  addSubtaskBtn: document.getElementById('add-subtask-btn'),
  submit: document.getElementById('modal-submit'),
  categorySuggestions: document.getElementById('category-suggestions')
};

const state = {
  tasks: [],
  filter: 'all',
  category: '',
  query: '',
  pending: 0,
  loading: true
};

let draftSubtasks = [];
let removedSubtaskIds = [];
let originalSubtasks = new Map();
let lastFocused = null;
let searchTimer = null;

/* ---------------- small helpers ---------------- */

function showStatus(message, isError = false) {
  els.status.textContent = message || '';
  els.status.className = `notice ${isError ? 'notice--error' : 'notice--info'}`;
  els.status.hidden = !message;
}

function showTitleError(visible) {
  els.titleError.hidden = !visible;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  }).format(new Date(value));
}

function isOverdue(task) {
  if (task.isDone || !task.dueDate) return false;
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function visibleTasks() {
  const query = state.query.trim().toLowerCase();
  return state.tasks.filter(task => {
    if (state.filter === 'active' && task.isDone) return false;
    if (state.filter === 'done' && !task.isDone) return false;
    if (state.category && (task.category || '').toLowerCase() !== state.category.toLowerCase()) return false;
    if (query) {
      const text = `${task.title} ${task.notes || ''}`.toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  });
}

async function cacheTasks() {
  await localDb.setCache('tasks', state.tasks);
}

/* ---------------- rendering ---------------- */

function renderSubtasks(task, container) {
  const total = task.subtasks.length;
  if (!total) return;

  const done = task.subtasks.filter(subtask => subtask.isDone).length;
  const percent = Math.round((done / total) * 100);
  const noun = total === 1 ? 'subtask' : 'subtasks';

  const wrapper = document.createElement('div');
  wrapper.className = 'subtask-progress';

  const track = document.createElement('div');
  track.className = 'progress';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(total));
  track.setAttribute('aria-valuenow', String(done));
  track.setAttribute('aria-label', `${done} of ${total} ${noun} complete`);

  const fill = document.createElement('span');
  fill.className = 'progress__fill';
  fill.style.width = `${percent}%`;
  track.appendChild(fill);

  const label = document.createElement('p');
  label.className = 'subtask-progress__label';
  label.textContent = `${done} of ${total} ${noun} complete`;

  wrapper.append(track, label);
  container.appendChild(wrapper);
}

function createTaskCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card' + (task.isDone ? ' is-done' : '');
  card.dataset.id = task.id;

  const top = document.createElement('div');
  top.className = 'task-card__top';

  const checkLabel = document.createElement('label');
  checkLabel.className = 'task-check';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.isDone;
  checkbox.dataset.action = 'toggle';
  checkbox.dataset.id = task.id;
  checkbox.setAttribute('aria-label', task.isDone
    ? `Mark “${task.title}” as active`
    : `Mark “${task.title}” as done`);
  checkLabel.appendChild(checkbox);

  const title = document.createElement('h2');
  title.className = 'task-card__title';
  title.textContent = task.title;

  const priority = document.createElement('span');
  priority.className = `priority priority--${task.priority.toLowerCase()}`;
  priority.textContent = task.priority;

  top.append(checkLabel, title, priority);

  const meta = document.createElement('div');
  meta.className = 'task-card__meta';

  if (task.category) {
    const category = document.createElement('span');
    category.className = 'chip';
    category.textContent = task.category;
    meta.appendChild(category);
  }

  if (task.dueDate) {
    const due = document.createElement('span');
    due.className = 'due' + (isOverdue(task) ? ' due--overdue' : '');
    due.textContent = `${isOverdue(task) ? 'Overdue · ' : 'Due '}${formatDate(task.dueDate)}`;
    meta.appendChild(due);
  }

  const actions = document.createElement('div');
  actions.className = 'task-card__actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn btn--small btn--ghost';
  editBtn.textContent = 'Edit';
  editBtn.dataset.action = 'edit';
  editBtn.dataset.id = task.id;

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn--small btn--danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.dataset.id = task.id;

  actions.append(editBtn, deleteBtn);
  card.appendChild(top);

  if (task.notes) {
    const notes = document.createElement('p');
    notes.className = 'task-card__notes';
    notes.textContent = task.notes;
    card.appendChild(notes);
  }

  renderSubtasks(task, card);

  if (meta.childElementCount > 0) card.appendChild(meta);
  card.appendChild(actions);
  return card;
}

function updateCategoryOptions() {
  const categories = [...new Set(state.tasks.map(task => task.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  if (state.category && !categories.includes(state.category)) {
    state.category = '';
  }

  els.categoryFilter.replaceChildren(new Option('All categories', ''));
  categories.forEach(category => els.categoryFilter.appendChild(new Option(category, category)));
  els.categoryFilter.value = state.category;

  els.categorySuggestions.replaceChildren(...categories.map(category => {
    const option = document.createElement('option');
    option.value = category;
    return option;
  }));
}

function renderEmptyState(items) {
  if (items.length > 0) {
    els.empty.hidden = true;
    return;
  }

  els.empty.hidden = false;
  if (state.query) {
    els.empty.textContent = `No tasks match “${state.query}”.`;
  } else if (state.category) {
    els.empty.textContent = `No tasks in ${state.category}.`;
  } else if (state.filter === 'active') {
    els.empty.textContent = 'No active tasks. Nice work.';
  } else if (state.filter === 'done') {
    els.empty.textContent = 'No completed tasks yet.';
  } else {
    els.empty.textContent = 'No tasks yet. Add your first one.';
  }
}

function render() {
  const items = visibleTasks();
  els.grid.replaceChildren(...items.map(createTaskCard));
  renderEmptyState(items);
  updateCategoryOptions();

  const active = state.tasks.filter(task => !task.isDone).length;
  els.summary.textContent = state.tasks.length
    ? `${active} active · ${state.tasks.length - active} done`
    : 'Nothing here yet.';

  els.loading.hidden = true;
}

/* ---------------- loading + queue ---------------- */

async function refreshPendingCount() {
  state.pending = await localDb.countQueue();
  els.pendingBadge.hidden = state.pending === 0;
  els.pendingBadge.textContent = `${state.pending} pending change${state.pending === 1 ? '' : 's'}`;
  els.pendingBadge.title = 'Changes saved on this device, waiting to sync.';
}

async function loadTasks() {
  const cached = await localDb.getCache('tasks');

  // While offline (or while changes are still queued) the local copy is newer
  // than the last API response the service worker may have cached.
  if (!navigator.onLine || state.pending > 0) {
    state.tasks = sortTasks(cached || []);
    state.loading = false;
    render();
    checkDueReminders();
    return;
  }

  try {
    const tasks = await api.tasks.list();
    state.tasks = sortTasks(tasks);
    await cacheTasks();
    showStatus('', false);
  } catch (error) {
    // status 0 = network failure, so fall back to the IndexedDB copy.
    if (error.status === 0) {
      const cached = await localDb.getCache('tasks');
      state.tasks = sortTasks(cached || []);
      showStatus(cached
        ? 'Showing the last task list saved on this device.'
        : 'You are offline and no tasks have been saved on this device yet.', !cached);
    } else {
      state.tasks = [];
      showStatus(error.message, true);
    }
  } finally {
    state.loading = false;
    render();
    checkDueReminders();
  }
}

async function enqueueMutation(method, path, body) {
  await localDb.addToQueue({ method, path, body, timestamp: Date.now() });
  await refreshPendingCount();
  registerBackgroundSync();
}

async function sendMutation(method, path, body) {
  if (!navigator.onLine) {
    await enqueueMutation(method, path, body);
    return false;
  }

  try {
    await api.raw(path, { method, body });
    return true;
  } catch (error) {
    if (error.status === 0) {
      await enqueueMutation(method, path, body);
      return false;
    }
    throw error;
  }
}

async function flushQueue() {
  if (!navigator.onLine) return false;

  const queue = await localDb.getQueue();
  let removedAny = false;

  for (const item of queue) {
    try {
      await api.raw(item.path, { method: item.method, body: item.body });
      await localDb.removeFromQueue(item.id);
      removedAny = true;
    } catch {
      // Keep this item (and the ones after it) so mutations stay in order.
      break;
    }
  }

  await refreshPendingCount();
  return removedAny;
}

function registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;

  navigator.serviceWorker.ready
    .then(registration => registration.sync.register('tasknest-sync'))
    .catch(() => { /* Safari/Firefox use the online event instead. */ });
}

/* ---------------- task actions ---------------- */

async function toggleTask(task) {
  task.isDone = !task.isDone;
  task.completedAt = task.isDone ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();
  await cacheTasks();
  render();

  try {
    const synced = await sendMutation('PATCH', `/api/tasks/${task.id}/toggle`);
    if (synced) {
      await loadTasks();
    } else {
      showStatus('Change saved on this device. It will sync when you are online.');
    }
  } catch (error) {
    showStatus(error.message, true);
    await loadTasks();
  }
}

async function deleteTask(task) {
  if (!confirm(`Delete “${task.title}”?`)) return;

  state.tasks = state.tasks.filter(item => item.id !== task.id);
  await cacheTasks();
  render();

  try {
    const synced = await sendMutation('DELETE', `/api/tasks/${task.id}`);
    if (synced) {
      await loadTasks();
    } else {
      showStatus('Delete saved on this device. It will sync when you are online.');
    }
  } catch (error) {
    showStatus(error.message, true);
    await loadTasks();
  }
}

/* ---------------- modal ---------------- */

function renderSubtaskEditor() {
  els.subtaskList.replaceChildren();

  draftSubtasks.forEach(draft => {
    const item = document.createElement('li');
    item.className = 'subtask-row' + (draft.isDone ? ' is-done' : '');

    const label = document.createElement('label');
    label.className = 'subtask-check';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = draft.isDone;
    checkbox.setAttribute('aria-label', `Mark “${draft.title}” as done`);
    checkbox.addEventListener('change', () => {
      draft.isDone = checkbox.checked;
      item.classList.toggle('is-done', draft.isDone);
    });

    const text = document.createElement('span');
    text.className = 'subtask-row__title';
    text.textContent = draft.title;
    label.append(checkbox, text);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-btn';
    remove.setAttribute('aria-label', `Remove subtask “${draft.title}”`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
    remove.addEventListener('click', () => {
      if (!draft.isNew) removedSubtaskIds.push(draft.id);
      draftSubtasks = draftSubtasks.filter(entry => entry !== draft);
      renderSubtaskEditor();
      els.newSubtask.focus();
    });

    item.append(label, remove);
    els.subtaskList.appendChild(item);
  });
}

function addDraftSubtask() {
  const title = els.newSubtask.value.trim();
  if (!title) return;

  draftSubtasks.push({
    id: crypto.randomUUID(),
    title,
    isDone: false,
    isNew: true
  });
  els.newSubtask.value = '';
  renderSubtaskEditor();
  els.newSubtask.focus();
}

function openModal(task = null) {
  lastFocused = document.activeElement;

  els.form.reset();
  els.taskId.value = task ? task.id : '';
  els.title.value = task ? task.title : '';
  els.notes.value = task ? task.notes || '' : '';
  els.priority.value = task ? task.priority : 'Medium';
  els.due.value = task && task.dueDate ? task.dueDate.slice(0, 10) : '';
  els.category.value = task ? task.category || '' : '';

  originalSubtasks = new Map((task ? task.subtasks : []).map(subtask => [subtask.id, subtask.isDone]));
  draftSubtasks = task
    ? task.subtasks.map(subtask => ({ ...subtask, isNew: false }))
    : [];
  removedSubtaskIds = [];

  renderSubtaskEditor();
  showTitleError(false);

  els.modalTitle.textContent = task ? 'Edit task' : 'Add task';
  els.submit.textContent = task ? 'Save changes' : 'Add task';
  els.modal.hidden = false;
  document.body.classList.add('modal-open');
  els.title.focus();
}

function closeModal() {
  els.modal.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastFocused) lastFocused.focus();
}

async function handleSubmit(event) {
  event.preventDefault();

  const title = els.title.value.trim();
  if (!title) {
    showTitleError(true);
    els.title.focus();
    return;
  }
  showTitleError(false);

  const existingId = els.taskId.value;
  const existing = existingId ? state.tasks.find(task => task.id === existingId) : null;
  const id = existing ? existing.id : crypto.randomUUID();
  const now = new Date().toISOString();

  const payload = {
    title,
    notes: els.notes.value.trim() || null,
    priority: els.priority.value,
    category: els.category.value.trim() || null,
    dueDate: els.due.value ? `${els.due.value}T00:00:00` : null,
    isDone: existing ? existing.isDone : false
  };

  const subtasks = draftSubtasks.map(draft => ({
    id: draft.id,
    title: draft.title,
    isDone: draft.isDone
  }));

  // Snapshot the pending changes: the user could open another modal while the
  // requests below are still running, which resets these shared arrays.
  const subtasksToAdd = draftSubtasks.filter(draft => draft.isNew).map(draft => ({ ...draft }));
  const subtasksToUpdate = draftSubtasks
    .filter(draft => !draft.isNew && originalSubtasks.get(draft.id) !== draft.isDone)
    .map(draft => ({ ...draft }));
  const subtasksToRemove = [...removedSubtaskIds];

  // Apply the change locally first so the UI stays instant, even offline.
  if (existing) {
    Object.assign(existing, payload, { updatedAt: now, subtasks });
  } else {
    state.tasks.push({
      id,
      ...payload,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      subtasks
    });
  }

  state.tasks = sortTasks(state.tasks);
  await cacheTasks();
  render();
  closeModal();
  els.submit.disabled = true;

  try {
    let queued = false;
    const save = async (method, path, body) => {
      const synced = await sendMutation(method, path, body);
      if (!synced) queued = true;
    };

    await save(
      existing ? 'PUT' : 'POST',
      existing ? `/api/tasks/${id}` : '/api/tasks',
      { ...payload, id }
    );

    for (const subtask of subtasksToAdd) {
      await save('POST', `/api/tasks/${id}/subtasks`, {
        id: subtask.id,
        title: subtask.title
      });
    }

    for (const subtask of subtasksToUpdate) {
      await save('PATCH', `/api/tasks/${id}/subtasks/${subtask.id}`, {
        isDone: subtask.isDone
      });
    }

    for (const subtaskId of subtasksToRemove) {
      await save('DELETE', `/api/tasks/${id}/subtasks/${subtaskId}`);
    }

    if (queued) {
      showStatus('Saved on this device. It will sync when you are online.');
    } else if (navigator.onLine) {
      await loadTasks();
    }
  } catch (error) {
    showStatus(error.message, true);
    await loadTasks();
  } finally {
    els.submit.disabled = false;
  }
}

/* ---------------- reminders ---------------- */

function dueWithinAnHour(task) {
  if (task.isDone || !task.dueDate) return false;

  // Due dates are dates, not times, so the deadline is the end of that day.
  const deadline = new Date(task.dueDate);
  if (Number.isNaN(deadline.getTime())) return false;
  deadline.setHours(23, 59, 0, 0);

  const diff = deadline.getTime() - Date.now();
  return diff > 0 && diff <= 60 * 60 * 1000;
}

async function showTaskNotification(task) {
  const options = {
    body: `“${task.title}” is due within an hour.`,
    tag: `tasknest-${task.id}`,
    icon: '/icons/icon-192.png'
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Task due soon', options);
      return;
    }
  } catch { /* fall through to the page notification */ }

  new Notification('Task due soon', options);
}

function checkDueReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notified = new Set(JSON.parse(sessionStorage.getItem('tasknest_notified') || '[]'));
  state.tasks.filter(dueWithinAnHour).forEach(task => {
    if (notified.has(task.id)) return;
    notified.add(task.id);
    showTaskNotification(task);
  });
  sessionStorage.setItem('tasknest_notified', JSON.stringify([...notified]));
}

function setupReminders() {
  if (!('Notification' in window)) {
    els.reminderBtn.hidden = true;
    return;
  }

  const setLabel = () => {
    if (Notification.permission === 'granted') {
      els.reminderBtn.textContent = 'Reminders on';
      els.reminderBtn.disabled = true;
    } else if (Notification.permission === 'denied') {
      els.reminderBtn.textContent = 'Reminders blocked';
      els.reminderBtn.disabled = true;
    }
  };

  setLabel();

  els.reminderBtn.addEventListener('click', async () => {
    const permission = await Notification.requestPermission();
    setLabel();
    if (permission === 'granted') {
      showStatus('Reminders enabled for tasks due within an hour.');
      checkDueReminders();
    }
  });
}

/* ---------------- wiring ---------------- */

function updateConnectionUI() {
  const online = navigator.onLine;
  els.badge.textContent = online ? 'Online' : 'Offline';
  els.badge.classList.toggle('badge--online', online);
  els.badge.classList.toggle('badge--offline', !online);
  els.offlineNotice.hidden = online;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'flush-queue') {
      flushQueue().then(changed => {
        if (changed) loadTasks();
      });
    }
  });

  navigator.serviceWorker.register('/sw.js').catch(error => {
    console.warn('Service worker registration failed:', error);
  });
}

els.addBtn.addEventListener('click', () => openModal());
els.form.addEventListener('submit', handleSubmit);
els.title.addEventListener('input', () => showTitleError(false));
els.addSubtaskBtn.addEventListener('click', addDraftSubtask);
els.newSubtask.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addDraftSubtask();
  }
});

document.querySelectorAll('[data-close-modal]').forEach(element => {
  element.addEventListener('click', closeModal);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !els.modal.hidden) closeModal();
});

els.grid.addEventListener('change', event => {
  const checkbox = event.target.closest('input[data-action="toggle"]');
  if (!checkbox) return;

  const task = state.tasks.find(item => item.id === checkbox.dataset.id);
  if (task) toggleTask(task);
});

els.grid.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const task = state.tasks.find(item => item.id === button.dataset.id);
  if (!task) return;

  if (button.dataset.action === 'edit') openModal(task);
  if (button.dataset.action === 'delete') deleteTask(task);
});

els.tabs.addEventListener('click', event => {
  const tab = event.target.closest('[data-filter]');
  if (!tab) return;

  state.filter = tab.dataset.filter;
  els.tabs.querySelectorAll('.tab').forEach(item => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
  });
  render();
});

els.categoryFilter.addEventListener('change', () => {
  state.category = els.categoryFilter.value;
  render();
});

els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = els.search.value;
    render();
  }, 200);
});

window.addEventListener('online', async () => {
  updateConnectionUI();
  showStatus('Back online — syncing saved changes.');
  await flushQueue();
  await loadTasks();
});

window.addEventListener('offline', () => {
  updateConnectionUI();
  refreshPendingCount();
});

(async function init() {
  registerServiceWorker();
  updateConnectionUI();
  await refreshPendingCount();
  setupReminders();
  await flushQueue();
  await loadTasks();
  setInterval(checkDueReminders, 60 * 1000);
})();
