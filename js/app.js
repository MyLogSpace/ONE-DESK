/* =========================================================
   App bootstrap & router
   각 모듈(js/*.js)은 window.Views.<key> = { title, subtitle, render(el) } 를 등록합니다.
   ========================================================= */
window.Views = window.Views || {};

let STATE = migrateState(Storage.load() || buildSeedState());

// 이전 버전에 저장된 localStorage 데이터를 최신 스키마로 보정한다.
// (예: 전자결재에 docType/chain/stepIndex가 추가되기 전 데이터, 자산의 method가 없는 데이터)
function migrateState(state) {
  state.meta = state.meta || {};
  if ((state.meta.schemaVersion || 1) >= 2) return state;

  (state.approvals || []).forEach((a) => {
    if (!a.docType) a.docType = '지출결의서';
    if (!Array.isArray(a.chain) || !a.chain.length) {
      a.chain = (typeof chainForAmount === 'function') ? chainForAmount(a.total || 0) : ['팀장'];
    }
    if (typeof a.stepIndex !== 'number') {
      a.stepIndex = a.status === '승인' ? a.chain.length : 0;
    }
    delete a.approverLine;
  });

  (state.assets || []).forEach((asset) => {
    if (!asset.method) asset.method = '정액법';
  });

  state.meta.schemaVersion = 2;
  return state;
}

function persist() {
  Storage.save(STATE);
}

function rerender() {
  const view = document.querySelector('.nav-item.is-active')?.dataset.view || 'dashboard';
  renderView(view);
}

function renderView(key) {
  const view = Views[key];
  if (!view) return;
  document.getElementById('viewTitle').textContent = view.title;
  document.getElementById('viewSubtitle').textContent = view.subtitle;
  const content = document.getElementById('content');
  content.innerHTML = '';
  view.render(content);
}

function initNav() {
  const items = document.querySelectorAll('.nav-item[data-view]');
  items.forEach((btn) => {
    btn.addEventListener('click', () => {
      items.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderView(btn.dataset.view);
    });
  });
}

function initTopbar() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  document.getElementById('todayLabel').textContent =
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initTopbar();
  persist(); // 최초 시드 데이터를 즉시 저장해둔다
  renderView('dashboard');
});
