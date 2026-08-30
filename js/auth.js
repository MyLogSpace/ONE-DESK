/* =========================================================
   Auth — 로그인 / 로그아웃 / 역할(일반 직원 · 경영지원팀) 관리
   - 계정은 STATE.employees 중 systemRole('admin'|'general')이 지정된 직원만 가능합니다.
   - 아이디는 이름, 기본 비밀번호는 생년월일 앞 6자리(YYMMDD)이며,
     마이페이지에서 변경하면 employee.password에 저장되어 이후 그 값이 우선합니다.
   - 세션은 브라우저 탭 단위(sessionStorage)로 유지되어, 탭을 닫으면 다시 로그인해야 합니다.
   ========================================================= */
const Auth = (() => {
  const SESSION_KEY = 'oneDeskSession';
  // 테스트 계정 힌트 버튼용 — seed.js의 생년월일과 동일하게 맞춰둡니다.
  const iso1985 = '1985-04-12';
  const iso1999 = '1999-11-03';
  const iso1993 = '1993-07-25';

  function birthPassword(birthISO) {
    if (!birthISO) return null;
    const [y, m, d] = birthISO.split('-');
    return `${y.slice(2)}${m}${d}`;
  }

  function findEmployee(name) {
    return (STATE.employees || []).find((e) => e.name === String(name || '').trim());
  }

  function checkPassword(emp, pw) {
    const expected = emp.password || birthPassword(emp.birthDate);
    return !!expected && pw === expected;
  }

  function currentUser() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const { employeeId } = JSON.parse(raw);
      return (STATE.employees || []).find((e) => e.id === employeeId) || null;
    } catch (e) {
      return null;
    }
  }

  function isAdmin() {
    const u = currentUser();
    return !!u && u.systemRole === 'admin';
  }

  // 헤더 토글로 즉시 전환되는 "보기 역할" — 실제 로그인 계정과 별개로,
  // 데모/시연 목적으로 화면만 일반 직원 ↔ 경영지원팀 시점으로 바꿔 보여준다.
  const VIEW_ROLE_KEY = 'oneDeskViewRole';

  function getViewRole() {
    const u = currentUser();
    if (!u) return 'general';
    return sessionStorage.getItem(VIEW_ROLE_KEY) || u.systemRole || 'general';
  }

  function setViewRole(role) {
    sessionStorage.setItem(VIEW_ROLE_KEY, role);
  }

  function login(name, pw) {
    const emp = findEmployee(name);
    if (!emp) return { ok: false, msg: '등록되지 않은 이름입니다.' };
    if (!emp.systemRole) return { ok: false, msg: '로그인 계정으로 등록되지 않은 직원입니다. 경영지원팀에 문의해주세요.' };
    if (!checkPassword(emp, pw)) return { ok: false, msg: '비밀번호가 일치하지 않습니다.' };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ employeeId: emp.id }));
    return { ok: true };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(VIEW_ROLE_KEY);
    location.reload();
  }

  function changePassword(newPw) {
    const u = currentUser();
    if (!u) return false;
    u.password = newPw;
    persist();
    return true;
  }

  function renderLogin(onSuccess) {
    document.querySelector('.app').style.display = 'none';
    const root = document.getElementById('loginScreen');
    root.style.display = 'flex';
    const companyName = (STATE.meta && STATE.meta.companyName) || '하나솔루션';

    root.innerHTML = `
      <div class="login-card">
        <div class="login-brand">
          <span class="brand-mark">OD</span>
          <div>
            <strong>ONE DESK</strong>
            <small>${UI.escapeHtml(companyName)} 경영지원 통합 플랫폼</small>
          </div>
        </div>
        <form id="loginForm">
          <div class="field"><label>아이디 (이름)</label>
            <input name="name" placeholder="이름을 입력하세요" autocomplete="off" required>
          </div>
          <div class="field"><label>비밀번호</label>
            <input name="pw" type="password" placeholder="비밀번호" required>
          </div>
          <div class="login-error" id="loginError"></div>
          <button type="submit" class="btn btn-primary" style="width:100%;">로그인</button>
        </form>
        <div class="login-hint">
          <div class="login-hint-title">테스트 계정으로 빠른 로그인</div>
          <button type="button" class="login-quick" data-name="김도윤" data-pw="${birthPassword(iso1985)}">경영지원팀 · 김도윤 팀장 (관리자)</button>
          <button type="button" class="login-quick" data-name="최하은" data-pw="${birthPassword(iso1999)}">개발팀 · 최하은 사원</button>
          <button type="button" class="login-quick" data-name="박지훈" data-pw="${birthPassword(iso1993)}">영업팀 · 박지훈 과장</button>
          <p class="login-hint-note">기본 비밀번호는 생년월일 앞 6자리(YYMMDD)이며, 로그인 후 마이페이지에서 변경할 수 있어요.</p>
        </div>
      </div>
    `;

    root.querySelector('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = login(fd.get('name'), fd.get('pw'));
      const errEl = root.querySelector('#loginError');
      if (!res.ok) {
        errEl.textContent = res.msg;
        return;
      }
      errEl.textContent = '';
      sessionStorage.removeItem(VIEW_ROLE_KEY); // 로그인 시점엔 본인 실제 역할로 시작
      root.style.display = 'none';
      document.querySelector('.app').style.display = 'flex';
      onSuccess();
    });

    root.querySelectorAll('.login-quick').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelector('[name="name"]').value = btn.dataset.name;
        root.querySelector('[name="pw"]').value = btn.dataset.pw;
      });
    });
  }

  function init(onReady) {
    const u = currentUser();
    if (u) {
      onReady();
    } else {
      renderLogin(onReady);
    }
  }

  return { init, login, logout, currentUser, isAdmin, changePassword, birthPassword, getViewRole, setViewRole };
})();
