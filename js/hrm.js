/* =========================================================
   HRM view — 직원 목록 CRUD + 연차 자동 계산기
   ========================================================= */
Views.hrm = {
  title: '인사관리 (HRM)',
  subtitle: '직원 현황과 연차를 관리합니다',

  render(el) {
    const emps = STATE.employees;

    el.innerHTML = `
      <div class="view-toolbar">
        <div class="search">
          <input type="search" id="hrmSearch" placeholder="이름 또는 부서 검색">
        </div>
        <button class="btn btn-primary" id="btnAddEmp">+ 직원 추가</button>
      </div>

      <div class="card">
        <table id="hrmTable">
          <thead>
            <tr>
              <th>이름</th><th>부서 / 직급</th><th>입사일</th><th>근속</th>
              <th>상태</th><th class="num">올해 연차 발생</th><th class="num">사용</th><th class="num">잔여</th><th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    const tbody = el.querySelector('#hrmTable tbody');

    const draw = (filter = '') => {
      const list = emps.filter((e) =>
        !filter || e.name.includes(filter) || e.dept.includes(filter));
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty">등록된 직원이 없습니다.</div></td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((e) => {
        const entitled = computeAnnualLeave(e.hireDate);
        const used = e.annualLeaveUsed || 0;
        const remain = Math.max(entitled - used, 0);
        const tenure = tenureLabel(e.hireDate);
        return `
          <tr data-id="${e.id}">
            <td><strong>${UI.escapeHtml(e.name)}</strong></td>
            <td>${UI.escapeHtml(e.dept)} · ${UI.escapeHtml(e.position)}</td>
            <td>${UI.dateFmt(e.hireDate)}</td>
            <td>${tenure}</td>
            <td>${statusBadge(e.status)}</td>
            <td class="num">${entitled}일</td>
            <td class="num">
              <input type="number" min="0" class="leave-used" value="${used}"
                     style="width:56px;border:1px solid var(--border);border-radius:6px;padding:4px 6px;text-align:right;">
            </td>
            <td class="num">${remain}일</td>
            <td class="row-actions">
              <button class="btn btn-ghost btn-sm act-edit">수정</button>
              <button class="btn btn-danger btn-sm act-del">삭제</button>
            </td>
          </tr>
        `;
      }).join('');
    };

    draw();

    el.querySelector('#hrmSearch').addEventListener('input', (e) => draw(e.target.value.trim()));

    el.querySelector('#btnAddEmp').addEventListener('click', () => openEmpModal());

    UI.on(tbody, '.act-edit', 'click', (e, t) => {
      const id = t.closest('tr').dataset.id;
      openEmpModal(emps.find((x) => x.id === id));
    });

    UI.on(tbody, '.act-del', 'click', (e, t) => {
      const id = t.closest('tr').dataset.id;
      const emp = emps.find((x) => x.id === id);
      if (!confirm(`${emp.name}님을 삭제할까요?`)) return;
      STATE.employees = STATE.employees.filter((x) => x.id !== id);
      persist();
      Views.hrm.render(el);
      UI.toast('삭제되었습니다.');
    });

    UI.on(tbody, '.act-status', 'click', (e, t) => {
      const id = t.closest('tr').dataset.id;
      const emp = emps.find((x) => x.id === id);
      const order = ['출근', '휴가', '재택'];
      emp.status = order[(order.indexOf(emp.status) + 1) % order.length];
      persist();
      Views.hrm.render(el);
    });

    tbody.addEventListener('change', (e) => {
      if (!e.target.classList.contains('leave-used')) return;
      const id = e.target.closest('tr').dataset.id;
      const emp = emps.find((x) => x.id === id);
      emp.annualLeaveUsed = Math.max(0, parseInt(e.target.value, 10) || 0);
      persist();
      draw(el.querySelector('#hrmSearch').value.trim());
    });
  },
};

function statusBadge(status) {
  const map = { 출근: 'badge-green', 휴가: 'badge-amber', 재택: 'badge-blue' };
  return `<span class="badge ${map[status]} act-status" style="cursor:pointer;" title="클릭해서 상태 변경">${status}</span>`;
}

function tenureLabel(hireISO) {
  const now = new Date();
  const hire = new Date(hireISO);
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  if (now.getDate() < hire.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return '입사 예정';
  return years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
}

// 근로기준법 간이 계산: 1년 미만은 개근 월 1일(최대 11일),
// 1년 이상은 15일 + (근속연수-1)/2 가산(최대 25일)
function computeAnnualLeave(hireISO) {
  const now = new Date();
  const hire = new Date(hireISO);
  const fullMonths = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth())
    - (now.getDate() < hire.getDate() ? 1 : 0);
  if (fullMonths < 12) return Math.max(0, Math.min(11, fullMonths));
  const years = Math.floor(fullMonths / 12);
  return Math.min(25, 15 + Math.floor((years - 1) / 2));
}

function openEmpModal(emp) {
  const isEdit = !!emp;
  UI.openModal(`
    <div class="modal-head"><h3>${isEdit ? '직원 정보 수정' : '직원 추가'}</h3>
      <button class="modal-close" id="mClose">✕</button></div>
    <form id="empForm">
      <div class="field"><label>이름</label><input name="name" required value="${isEdit ? UI.escapeHtml(emp.name) : ''}"></div>
      <div class="field-row">
        <div class="field"><label>부서</label><input name="dept" required value="${isEdit ? UI.escapeHtml(emp.dept) : ''}"></div>
        <div class="field"><label>직급</label><input name="position" required value="${isEdit ? UI.escapeHtml(emp.position) : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>입사일</label><input type="date" name="hireDate" required value="${isEdit ? emp.hireDate : ''}"></div>
        <div class="field"><label>상태</label>
          <select name="status">
            ${['출근', '휴가', '재택'].map((s) => `<option ${isEdit && emp.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" id="mCancel">취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '추가'}</button>
      </div>
    </form>
  `);
  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mCancel').onclick = close;
  document.getElementById('empForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (isEdit) {
      Object.assign(emp, data);
    } else {
      STATE.employees.push({ id: Storage.uid('emp'), annualLeaveUsed: 0, ...data });
    }
    persist();
    close();
    Views.hrm.render(document.getElementById('content'));
    UI.toast(isEdit ? '수정되었습니다.' : '직원이 추가되었습니다.');
  };
}
