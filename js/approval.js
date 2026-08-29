/* =========================================================
   Approval view — 다단계 결재선(금액별 자동 판단) + 지출결의서/휴가신청서
   ========================================================= */

// 금액 구간별 결재선 자동 판단 (전결 규정)
const APPROVAL_TIERS = [
  { max: 300000, chain: ['팀장'] },
  { max: 1000000, chain: ['팀장', '본부장'] },
  { max: Infinity, chain: ['팀장', '본부장', '대표이사'] },
];
function chainForAmount(total) {
  return APPROVAL_TIERS.find((t) => total <= t.max).chain;
}

Views.approval = {
  title: '전자결재',
  subtitle: '지출결의서 · 휴가신청서를 작성하고 결재 현황을 확인합니다',

  render(el) {
    el.innerHTML = `
      <div class="view-toolbar">
        <div class="tabs" id="apvTabs">
          ${['전체', '대기', '승인', '반려'].map((t, i) => `<button class="tab ${i === 0 ? 'is-active' : ''}" data-status="${t}">${t}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" id="btnNewLeave">+ 휴가신청서 작성</button>
          <button class="btn btn-primary" id="btnNewApv">+ 지출결의서 작성</button>
        </div>
      </div>
      <div class="card">
        <table id="apvTable">
          <thead>
            <tr>
              <th>유형</th><th>제목 / 내용</th><th>기안자</th>
              <th class="num">금액</th><th>결재선 진행</th><th>상태</th><th>기안일</th><th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    const tbody = el.querySelector('#apvTable tbody');
    let currentTab = '전체';

    const draw = () => {
      const list = STATE.approvals
        .filter((a) => currentTab === '전체' || a.status === currentTab)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty">해당 조건의 결재 문서가 없습니다.</div></td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((a) => `
        <tr data-id="${a.id}">
          <td><span class="badge badge-gray">${a.docType}</span></td>
          <td><strong>${UI.escapeHtml(a.title)}</strong>${a.docType === '휴가신청서' ? `<div class="hint">${UI.dateFmt(a.startDate)} ~ ${UI.dateFmt(a.endDate)} · ${a.days}일</div>` : ''}</td>
          <td>${UI.escapeHtml(a.requester)}</td>
          <td class="num">${a.docType === '지출결의서' ? `<strong>${UI.won(a.total)}</strong>` : '-'}</td>
          <td>${chainProgressHtml(a)}</td>
          <td>${statusBadgeApv(a.status)}</td>
          <td>${UI.dateFmt(a.createdAt)}</td>
          <td class="row-actions">
            ${a.status === '대기' ? `
              <button class="btn btn-accent btn-sm act-approve">승인</button>
              <button class="btn btn-danger btn-sm act-reject">반려</button>
            ` : `<button class="btn btn-ghost btn-sm act-del">삭제</button>`}
          </td>
        </tr>
      `).join('');
    };

    draw();

    el.querySelectorAll('#apvTabs .tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('#apvTabs .tab').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        currentTab = btn.dataset.status;
        draw();
      });
    });

    el.querySelector('#btnNewApv').addEventListener('click', () => openApvModal());
    el.querySelector('#btnNewLeave').addEventListener('click', () => openLeaveModal());

    UI.on(tbody, '.act-approve', 'click', (e, t) => {
      const a = STATE.approvals.find((x) => x.id === t.closest('tr').dataset.id);
      advanceApproval(a);
      persist();
      draw();
    });

    UI.on(tbody, '.act-reject', 'click', (e, t) => {
      const a = STATE.approvals.find((x) => x.id === t.closest('tr').dataset.id);
      a.status = '반려';
      persist();
      draw();
      UI.toast('반려 처리되었습니다.');
    });

    UI.on(tbody, '.act-del', 'click', (e, t) => {
      const id = t.closest('tr').dataset.id;
      STATE.approvals = STATE.approvals.filter((x) => x.id !== id);
      persist();
      draw();
      UI.toast('삭제되었습니다.');
    });
  },
};

// 현재 결재 단계를 진행시키고, 마지막 단계면 최종 승인 처리 + 후속 반영(회계장부 / 연차차감)
function advanceApproval(a) {
  a.stepIndex += 1;
  if (a.stepIndex >= a.chain.length) {
    a.status = '승인';
    if (a.docType === '지출결의서') {
      STATE.accountingEntries.push({
        id: Storage.uid('acc'),
        date: new Date().toISOString().slice(0, 10),
        type: '지출',
        category: a.category,
        amount: a.total,
        memo: `[전자결재 승인] ${a.title}`,
        hasReceipt: false,
        hasTaxInvoice: false,
      });
      UI.toast('최종 승인되었고, 회계 장부에 반영되었습니다.');
    } else if (a.docType === '휴가신청서') {
      const emp = STATE.employees.find((x) => x.id === a.employeeId);
      if (emp) {
        emp.annualLeaveUsed = (emp.annualLeaveUsed || 0) + a.days;
        UI.toast(`최종 승인되었고, ${emp.name}님의 연차가 ${a.days}일 차감되었습니다.`);
      } else {
        UI.toast('최종 승인되었습니다.');
      }
    }
  } else {
    UI.toast(`${a.chain[a.stepIndex - 1]} 승인 완료 · 다음 결재자: ${a.chain[a.stepIndex]}`);
  }
}

function chainProgressHtml(a) {
  const chain = Array.isArray(a.chain) && a.chain.length ? a.chain : ['팀장'];
  return `
    <div style="display:flex;gap:4px;flex-wrap:wrap;">
      ${chain.map((stage, i) => {
        let cls = 'badge-gray';
        if (a.status === '반려' && i === a.stepIndex) cls = 'badge-red';
        else if (i < a.stepIndex) cls = 'badge-green';
        else if (i === a.stepIndex && a.status === '대기') cls = 'badge-amber';
        return `<span class="badge ${cls}">${stage}</span>`;
      }).join('<span style="color:var(--text-faint);font-size:10px;align-self:center;">→</span>')}
    </div>
  `;
}

function statusBadgeApv(status) {
  const map = { 대기: 'badge-amber', 승인: 'badge-green', 반려: 'badge-red' };
  return `<span class="badge ${map[status]}">${status}</span>`;
}

/* ---------------------- 지출결의서 작성 ---------------------- */
function openApvModal() {
  UI.openModal(`
    <div class="modal-head"><h3>지출결의서 작성</h3><button class="modal-close" id="mClose">✕</button></div>
    <form id="apvForm">
      <div class="field"><label>제목</label><input name="title" required placeholder="예: 노트북 구매의 건"></div>
      <div class="field-row">
        <div class="field"><label>기안자</label><input name="requester" required></div>
        <div class="field"><label>분류</label>
          <select name="category">
            ${['비품 구매', '접대비', '소모품비', '통신비', '교육훈련비', '기타'].map((c) => `<option>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>수량</label><input type="number" min="1" name="qty" id="apvQty" value="1" required></div>
        <div class="field"><label>단가 (공급가액 기준, 원)</label><input type="number" min="0" name="unitPrice" id="apvUnit" value="0" required></div>
      </div>
      <div class="card" style="background:#F7F9F7;box-shadow:none;padding:14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;"><span>공급가액</span><strong id="calcSupply" class="num">0원</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;"><span>부가세 (10%)</span><strong id="calcVat" class="num">0원</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;border-top:1px solid var(--border);padding-top:8px;"><span>합계</span><strong id="calcTotal" class="num">0원</strong></div>
        <div class="hint" style="margin-top:8px;">결재선(자동): <strong id="calcLine">팀장</strong></div>
        <div class="hint">30만원 이하 팀장 전결 · 100만원 이하 팀장→본부장 · 초과 시 팀장→본부장→대표이사</div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" id="mCancel">취소</button>
        <button type="submit" class="btn btn-primary">기안 상신</button>
      </div>
    </form>
  `);

  const qtyEl = document.getElementById('apvQty');
  const unitEl = document.getElementById('apvUnit');
  const recalc = () => {
    const qty = parseFloat(qtyEl.value) || 0;
    const unit = parseFloat(unitEl.value) || 0;
    const supply = Math.round(qty * unit);
    const vat = Math.round(supply * 0.1);
    const total = supply + vat;
    document.getElementById('calcSupply').textContent = UI.won(supply);
    document.getElementById('calcVat').textContent = UI.won(vat);
    document.getElementById('calcTotal').textContent = UI.won(total);
    document.getElementById('calcLine').textContent = chainForAmount(total).join(' → ');
  };
  qtyEl.addEventListener('input', recalc);
  unitEl.addEventListener('input', recalc);
  recalc();

  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mCancel').onclick = close;
  document.getElementById('apvForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const qty = parseFloat(fd.get('qty')) || 0;
    const unitPrice = parseFloat(fd.get('unitPrice')) || 0;
    const supplyAmount = Math.round(qty * unitPrice);
    const vat = Math.round(supplyAmount * 0.1);
    const total = supplyAmount + vat;
    STATE.approvals.push({
      id: Storage.uid('apv'),
      docType: '지출결의서',
      title: fd.get('title'),
      requester: fd.get('requester'),
      category: fd.get('category'),
      qty, unitPrice, supplyAmount, vat, total,
      chain: chainForAmount(total),
      stepIndex: 0,
      status: '대기',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    persist();
    close();
    Views.approval.render(document.getElementById('content'));
    UI.toast('결재가 상신되었습니다.');
  };
}

/* ---------------------- 휴가신청서 작성 ---------------------- */
function openLeaveModal() {
  const emps = STATE.employees;
  UI.openModal(`
    <div class="modal-head"><h3>휴가신청서 작성</h3><button class="modal-close" id="mClose">✕</button></div>
    <form id="leaveForm">
      <div class="field"><label>신청자</label>
        <select name="employeeId" id="leaveEmp" required>
          <option value="">선택하세요</option>
          ${emps.map((e) => `<option value="${e.id}">${UI.escapeHtml(e.name)} (${UI.escapeHtml(e.dept)})</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>시작일</label><input type="date" name="startDate" id="leaveStart" required></div>
        <div class="field"><label>종료일</label><input type="date" name="endDate" id="leaveEnd" required></div>
      </div>
      <div class="field"><label>사유</label><input name="reason" placeholder="예: 개인 사유"></div>
      <div class="card" style="background:#F7F9F7;box-shadow:none;padding:14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:12.8px;">
          <span>신청 일수</span><strong id="leaveDays" class="num">0일</strong>
        </div>
        <div class="hint" id="leaveRemainHint" style="margin-top:6px;">신청자를 먼저 선택하세요.</div>
        <div class="hint" style="margin-top:6px;">결재선(자동): <strong>팀장</strong> · 승인 시 인사관리의 사용 연차가 자동 차감됩니다.</div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" id="mCancel">취소</button>
        <button type="submit" class="btn btn-primary">기안 상신</button>
      </div>
    </form>
  `);

  const empEl = document.getElementById('leaveEmp');
  const startEl = document.getElementById('leaveStart');
  const endEl = document.getElementById('leaveEnd');
  const daysEl = document.getElementById('leaveDays');
  const remainEl = document.getElementById('leaveRemainHint');

  const recalc = () => {
    const start = startEl.value, end = endEl.value;
    let days = 0;
    if (start && end) {
      days = Math.floor((new Date(end) - new Date(start)) / 86400000) + 1;
      if (days < 0) days = 0;
    }
    daysEl.textContent = `${days}일`;

    const emp = emps.find((x) => x.id === empEl.value);
    if (emp) {
      const entitled = computeAnnualLeave(emp.hireDate);
      const used = emp.annualLeaveUsed || 0;
      const remain = Math.max(entitled - used, 0);
      remainEl.textContent = `${emp.name}님의 현재 잔여 연차: ${remain}일 (신청 후 ${Math.max(remain - days, 0)}일 남음)`;
      remainEl.style.color = days > remain ? 'var(--red)' : 'var(--text-faint)';
    } else {
      remainEl.textContent = '신청자를 먼저 선택하세요.';
      remainEl.style.color = 'var(--text-faint)';
    }
  };
  empEl.addEventListener('change', recalc);
  startEl.addEventListener('change', recalc);
  endEl.addEventListener('change', recalc);

  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mCancel').onclick = close;
  document.getElementById('leaveForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const emp = emps.find((x) => x.id === fd.get('employeeId'));
    if (!emp) { alert('신청자를 선택해주세요.'); return; }
    const start = fd.get('startDate'), end = fd.get('endDate');
    const days = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 86400000) + 1);
    if (days <= 0) { alert('종료일은 시작일 이후여야 합니다.'); return; }
    STATE.approvals.push({
      id: Storage.uid('apv'),
      docType: '휴가신청서',
      title: `연차 신청 (${fd.get('reason') || '개인 사유'})`,
      requester: emp.name,
      employeeId: emp.id,
      startDate: start, endDate: end, days,
      reason: fd.get('reason'),
      chain: ['팀장'],
      stepIndex: 0,
      status: '대기',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    persist();
    close();
    Views.approval.render(document.getElementById('content'));
    UI.toast('휴가신청서가 상신되었습니다.');
  };
}
