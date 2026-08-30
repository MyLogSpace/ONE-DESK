/* =========================================================
   Dashboard view — 경영지원팀은 회사 전체 KPI, 일반 직원은 개인화된 요약을 봅니다
   ========================================================= */
Views.dashboard = {
  title: '경영 요약 대시보드',
  subtitle: '오늘 현황을 한눈에 확인하세요',

  render(el) {
    const admin = Auth.getViewRole() === 'admin';
    if (admin) renderAdminDashboard(el);
    else renderMyDashboard(el);
  },
};

function renderAdminDashboard(el) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthEntries = STATE.accountingEntries.filter((e) => e.date.startsWith(ym));
  const income = monthEntries.filter((e) => e.type === '수입').reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries.filter((e) => e.type === '지출').reduce((s, e) => s + e.amount, 0);
  const net = income - expense;

  const attendance = { 출근: 0, 휴가: 0, 재택: 0 };
  STATE.employees.forEach((e) => { attendance[e.status] = (attendance[e.status] || 0) + 1; });

  const pending = STATE.approvals.filter((a) => a.status === '대기');

  el.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:18px;">
      ${kpiCard('이번 달 총수입', UI.won(income), 'blue', `수입 항목 ${monthEntries.filter(e=>e.type==='수입').length}건`)}
      ${kpiCard('이번 달 총지출', UI.won(expense), 'red', `지출 항목 ${monthEntries.filter(e=>e.type==='지출').length}건`)}
      ${kpiCard('이번 달 순이익', UI.won(net), net >= 0 ? 'green' : 'red', net >= 0 ? '흑자' : '적자')}
      ${kpiCard('결재 대기 문서', `${pending.length}건`, 'green', '전자결재함 확인 필요')}
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-head">
        <div><h3>다가오는 회계 일정</h3><div class="sub">매월 반복되는 정산 마감을 자동으로 계산합니다</div></div>
        ${notifyButtonHtml()}
      </div>
      <div class="dday-row" id="ddayRow"></div>
    </div>

    <div class="grid grid-3">
      <div class="card">
        <div class="card-head"><div><h3>오늘 출근 현황</h3><div class="sub">인사관리 연동</div></div></div>
        ${attendRow('출근', attendance.출근, 'green')}
        ${attendRow('휴가', attendance.휴가, 'amber')}
        ${attendRow('재택', attendance.재택, 'blue')}
      </div>

      <div class="card" style="grid-column: span 2;">
        <div class="card-head">
          <div><h3>결재 대기 문서</h3><div class="sub">전자결재 연동 · 최근 순</div></div>
          <button class="btn btn-ghost btn-sm" data-goto="approval">전자결재함 이동</button>
        </div>
        ${pending.length ? `
          <table>
            <thead><tr><th>유형</th><th>제목</th><th>기안자</th><th>결재 단계</th><th class="num">금액</th></tr></thead>
            <tbody>
              ${pending.slice(0, 5).map((a) => `
                <tr>
                  <td><span class="badge badge-gray">${a.docType}</span></td>
                  <td>${UI.escapeHtml(a.title)}</td>
                  <td>${UI.escapeHtml(a.requester)}</td>
                  <td><span class="badge badge-amber">${(a.chain && a.chain[a.stepIndex]) || '팀장'} 결재 대기</span></td>
                  <td class="num">${a.docType === '지출결의서' ? UI.won(a.total) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<div class="empty">대기 중인 결재 문서가 없습니다.</div>`}
      </div>
    </div>
  `;

  const ddayItems = [
    computeDday('급여 정산 마감', 25),
    computeDday('카드사 정산 마감', 5),
    computeDday('이번 달 결산 마감', lastDayOfMonth(now)),
  ];
  el.querySelector('#ddayRow').innerHTML = ddayItems.map((d) => d.html).join('');
  maybeNotifyDeadlines(ddayItems);

  el.querySelector('#btnEnableNotify')?.addEventListener('click', async () => {
    if (!('Notification' in window)) { UI.toast('이 브라우저는 알림을 지원하지 않습니다.'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      UI.toast('마감 임박 알림이 활성화되었습니다.');
      new Notification('ONE DESK', { body: '알림이 켜졌습니다. 마감 3일 전부터 알려드릴게요.' });
    } else {
      UI.toast('알림 권한이 허용되지 않았습니다.');
    }
    Views.dashboard.render(document.getElementById('content'));
  });

  el.querySelector('[data-goto="approval"]')?.addEventListener('click', () => {
    document.querySelector('.nav-item[data-view="approval"]').click();
  });
}

// 일반 직원 대시보드 — 회사 전체 데이터가 아니라 본인 데이터만 요약해서 보여준다.
function renderMyDashboard(el) {
  const user = Auth.currentUser();
  if (!user) { el.innerHTML = `<div class="empty">로그인 정보를 확인할 수 없습니다.</div>`; return; }

  const entitled = computeAnnualLeave(user.hireDate);
  const used = user.annualLeaveUsed || 0;
  const remain = Math.max(entitled - used, 0);

  const myApprovals = (STATE.approvals || []).filter((a) => a.requester === user.name);
  const myPending = myApprovals.filter((a) => a.status === '대기');
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const myMonthExpense = myApprovals
    .filter((a) => a.docType === '지출결의서' && a.createdAt.startsWith(ym))
    .reduce((s, a) => s + (a.total || 0), 0);

  el.innerHTML = `
    <div class="card" style="margin-bottom:18px;background:var(--accent);color:#fff;border:none;box-shadow:none;">
      <div style="font-size:13px;color:#D7E4E9;">안녕하세요</div>
      <div style="font-size:19px;font-weight:800;margin-top:4px;">${UI.escapeHtml(user.name)}님, 오늘도 좋은 하루 보내세요</div>
      <div style="font-size:12px;color:#C4DAE0;margin-top:6px;">${UI.escapeHtml(user.dept)} · ${UI.escapeHtml(user.position)}</div>
    </div>

    <div class="grid grid-3" style="margin-bottom:18px;">
      ${kpiCard('내 잔여 연차', `${remain}일`, 'blue', `올해 발생 ${entitled}일 · 사용 ${used}일`)}
      ${kpiCard('내 결재 대기', `${myPending.length}건`, myPending.length ? 'red' : 'green', '승인/반려 결과를 기다리는 중')}
      ${kpiCard('이번 달 내 지출결의', UI.won(myMonthExpense), 'green', `${ym.replace('-', '년 ')}월 상신 기준`)}
    </div>

    <div class="card">
      <div class="card-head">
        <div><h3>내 결재·지출결의 현황</h3><div class="sub">내가 상신한 문서만 보여요</div></div>
        <button class="btn btn-ghost btn-sm" data-goto="myinfo">마이페이지에서 새 문서 작성</button>
      </div>
      ${myApprovals.length ? `
        <table>
          <thead><tr><th>유형</th><th>제목</th><th class="num">금액</th><th>상태</th><th>상신일</th></tr></thead>
          <tbody>
            ${myApprovals.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5).map((a) => `
              <tr>
                <td><span class="badge badge-gray">${a.docType}</span></td>
                <td>${UI.escapeHtml(a.title)}</td>
                <td class="num">${a.total ? UI.won(a.total) : '-'}</td>
                <td>${statusBadgeApv(a.status)}</td>
                <td>${UI.dateFmt(a.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `<div class="empty">아직 상신한 결재 문서가 없습니다.</div>`}
    </div>
  `;

  el.querySelector('[data-goto="myinfo"]')?.addEventListener('click', () => {
    document.querySelector('.nav-item[data-view="myinfo"]').click();
  });
}

function notifyButtonHtml() {
  if (!('Notification' in window)) return '';
  const perm = Notification.permission;
  if (perm === 'granted') return `<span class="badge badge-green">🔔 알림 켜짐</span>`;
  if (perm === 'denied') return `<span class="badge badge-gray" title="브라우저 설정에서 알림 권한을 허용해주세요.">🔕 알림 차단됨</span>`;
  return `<button class="btn btn-ghost btn-sm" id="btnEnableNotify">🔔 마감 알림 켜기</button>`;
}

// 마감 3일 이내 항목에 대해, 하루 1회만 브라우저 알림을 보낸다(중복 방지 로그는 localStorage에 별도 저장)
function maybeNotifyDeadlines(items) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const LOG_KEY = 'oneDeskNotifiedLog';
  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
  let changed = false;
  items.forEach(({ label, target, diff }) => {
    if (diff > 3) return;
    const key = `${label}_${target.toISOString().slice(0, 10)}`;
    if (log[key]) return;
    new Notification('ONE DESK · 마감 임박', {
      body: `${label} — ${diff === 0 ? 'D-DAY' : `D-${diff}`} (${target.getMonth() + 1}월 ${target.getDate()}일)`,
    });
    log[key] = true;
    changed = true;
  });
  if (changed) localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

function kpiCard(label, value, color, foot) {
  return `
    <div class="card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value ${color} num">${value}</div>
      <div class="kpi-foot">${foot}</div>
    </div>
  `;
}

function attendRow(label, count, tone) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #F1F0EB;">
      <span style="font-size:12.8px;display:flex;align-items:center;gap:8px;"><span class="dot dot-${tone}"></span>${label}</span>
      <strong class="num">${count}명</strong>
    </div>
  `;
}

function lastDayOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function computeDday(label, dayOfMonth) {
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    target = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
  }
  const diff = UI.daysBetween(target.toISOString(), now);
  const tone = diff <= 3 ? 'urgent' : diff <= 7 ? 'soon' : '';
  const ddayText = diff === 0 ? 'D-DAY' : `D-${diff}`;
  const html = `
    <div class="dday-chip ${tone}">
      <div class="lbl">${label}</div>
      <div class="num-lg">${ddayText}<span>· ${target.getMonth() + 1}월 ${target.getDate()}일</span></div>
    </div>
  `;
  return { label, target, diff, html };
}
