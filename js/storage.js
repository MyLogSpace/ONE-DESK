/* =========================================================
   Storage
   - 전체 데이터를 하나의 localStorage 키에 JSON으로 저장합니다.
   - 서버가 없는 정적 사이트이므로 백업(JSON 다운로드)/복구(업로드)를
     제공하여 브라우저 데이터 유실에 대비합니다.
   ========================================================= */
const Storage = (() => {
  const KEY = 'oneDeskData.v1';

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) { console.error('저장된 데이터를 읽는 중 오류가 발생했습니다.', e); return null; }
  }

  function save(state) {
    state.meta = state.meta || {};
    state.meta.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function exportJSON(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `onedesk-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJSON(file, onDone, onError) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('형식이 올바르지 않습니다.');
        onDone(parsed);
      } catch (e) {
        onError(e);
      }
    };
    reader.onerror = () => onError(reader.error);
    reader.readAsText(file);
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  return { load, save, exportJSON, importJSON, uid };
})();
