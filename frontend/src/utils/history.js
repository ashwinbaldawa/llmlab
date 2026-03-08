const STORAGE_KEY = "llmlab_history";
const MAX_ENTRIES = 50;
let _idCounter = 0;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRun(entry) {
  const history = loadHistory();
  history.unshift({ ...entry, id: Date.now() + (++_idCounter), ts: new Date().toISOString() });
  if (history.length > MAX_ENTRIES) history.length = MAX_ENTRIES;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

export function deleteRun(id) {
  const history = loadHistory().filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}
