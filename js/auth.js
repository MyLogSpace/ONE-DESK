/* =========================================================
   Auth — 역할(일반 직원 · 경영지원팀) 관리
   - 로그인 절차 없이 앱이 바로 열립니다. 기본 계정은 STATE.employees 중
     systemRole이 'admin'인 직원(경영지원팀)을 사용합니다.
   - 상단 "일반 직원 보기 / 경영지원팀 보기" 토글로 화면 관점만 전환하며,
     이는 실제 계정과 무관하게 탭 단위(sessionStorage)로 유지됩니다.
   ========================================================= */
const Auth = (() => {
  const VIEW_ROLE_KEY = 'oneDeskViewRole';

  function birthPassword(birthISO) {
    if (!birthISO) return null;
    const [y, m, d] = birthISO.split('-');
    return `${y.slice(2)}${m}${d}`;
  }

  // 로그인 절차가 없으므로, 경영지원팀(admin) 계정을 기본 사용자로 사용합니다.
  function currentUser() {
    const list = STATE.employees || [];
    return list.find((e) => e.systemRole === 'admin') || list[0] || null;
  }

  function isAdmin() {
    const u = currentUser();
    return !!u && u.systemRole === 'admin';
  }

  // 헤더 토글로 즉시 전환되는 "보기 역할" — 실제 계정과 별개로,
  // 데모/시연 목적으로 화면만 일반 직원 ↔ 경영지원팀 시점으로 바꿔 보여준다.
  function getViewRole() {
    const u = currentUser();
    if (!u) return 'general';
    return sessionStorage.getItem(VIEW_ROLE_KEY) || u.systemRole || 'general';
  }

  function setViewRole(role) {
    sessionStorage.setItem(VIEW_ROLE_KEY, role);
  }

  function changePassword(newPw) {
    const u = currentUser();
    if (!u) return false;
    u.password = newPw;
    persist();
    return true;
  }

  // 로그인 기능은 없지만, 다른 모듈에서 호출될 수 있어 화면 관점만 초기화하고 새로고침합니다.
  function logout() {
    sessionStorage.removeItem(VIEW_ROLE_KEY);
    location.reload();
  }

  function init(onReady) {
    // 로그인 게이트 없이 바로 앱을 엽니다.
    onReady();
  }

  return { init, logout, currentUser, isAdmin, changePassword, birthPassword, getViewRole, setViewRole };
})();
