/* =========================================================
   UI helpers — 포맷터 / 모달 / 토스트 / 공통 헬퍼
   ========================================================= */
const UI = (() => {
  const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
  const wonShort = (n) => {
    const v = Math.round(n);
    if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
    if (Math.abs(v) >= 10000) return `${Math.round(v / 10000).toLocaleString('ko-KR')}만`;
    return v.toLocaleString('ko-KR');
  };
  const dateFmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function daysBetween(fromISO, toDate = new Date()) {
    const from = new Date(fromISO);
    const to = new Date(toDate);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return Math.round((from - to) / 86400000);
  }

  // ---- toast ----
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2200);
  }

  // ---- modal ----
  function openModal(innerHtml, { wide = false } = {}) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${innerHtml}</div>`;
    root.classList.add('is-open');
    root.onclick = (e) => { if (e.target === root) closeModal(); };
  }
  function closeModal() {
    const root = document.getElementById('modalRoot');
    root.classList.remove('is-open');
    root.innerHTML = '';
  }

  // ---- delegated click handler registry ----
  function on(container, selector, event, handler) {
    container.addEventListener(event, (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) handler(e, target);
    });
  }

  return { won, wonShort, dateFmt, escapeHtml, daysBetween, toast, openModal, closeModal, on };
})();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') UI.closeModal();
});
