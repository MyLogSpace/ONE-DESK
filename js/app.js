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

  if ((state.meta.schemaVersion || 1) < 2) {
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
  }

  // v3: 로그인/역할 기능 추가 — 예전 데이터에 회사명·로그인 계정 정보를 보정한다.
  if ((state.meta.schemaVersion || 1) < 3) {
    if (!state.meta.companyName) state.meta.companyName = '하나솔루션';

    const seedAccounts = {
      '김도윤': { birthDate: '1985-04-12', systemRole: 'admin' },
      '박지훈': { birthDate: '1993-07-25', systemRole: 'general' },
      '최하은': { birthDate: '1999-11-03', systemRole: 'general' },
    };
    (state.employees || []).forEach((e) => {
      const acc = seedAccounts[e.name];
      if (!acc) return;
      if (!e.birthDate) e.birthDate = acc.birthDate;
      if (!e.systemRole) e.systemRole = acc.systemRole;
    });

    state.meta.schemaVersion = 3;
  }

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

// 헤더 토글(일반 직원 보기 / 경영지원팀 보기)에 따라 사이드바 메뉴와 상단 사용자 정보를 갱신한다.
function applyRoleUI() {
  const user = Auth.currentUser();
  if (!user) return;
  const admin = Auth.getViewRole() === 'admin';

  document.querySelectorAll('.nav-item[data-role="admin"]').forEach((el) => {
    el.style.display = admin ? '' : 'none';
  });
  document.querySelectorAll('.nav-item[data-role="general"]').forEach((el) => {
    el.style.display = admin ? 'none' : '';
  });

  document.getElementById('userChipAvatar').textContent = user.name.slice(-1);
  document.getElementById('userChipName').textContent = `${user.name} ${user.position}`;
  document.getElementById('userChipMeta').textContent =
    `${user.dept} · ${admin ? '경영지원팀 관리자' : '일반 직원'}`;

  document.querySelectorAll('.role-toggle-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.role === (admin ? 'admin' : 'general'));
  });

  // 역할 전환 등으로 현재 화면이 더 이상 보이지 않는 메뉴라면 대시보드로 되돌린다.
  const activeBtn = document.querySelector('.nav-item.is-active');
  if (activeBtn && activeBtn.style.display === 'none') {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('is-active'));
    document.querySelector('.nav-item[data-view="dashboard"]').classList.add('is-active');
    renderView('dashboard');
  }
}

function initRoleToggle() {
  document.querySelectorAll('.role-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      Auth.setViewRole(btn.dataset.role);
      applyRoleUI();
    });
  });
}

function initLogout() {
  document.getElementById('btnLogout').addEventListener('click', () => {
    if (!confirm('로그아웃할까요? 다른 계정으로 다시 로그인할 수 있어요.')) return;
    Auth.logout();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.init(() => {
    initNav();
    initTopbar();
    initRoleToggle();
    initLogout();
    applyRoleUI();
    persist(); // 최초 시드 데이터를 즉시 저장해둔다
    renderView('dashboard');
  });
});
