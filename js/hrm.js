/* =========================================================
   HRM view — 직원 목록 CRUD / 근로계약서 검토 / 4대보험 정산
   ========================================================= */

// 근로기준법 제17조 등 근로계약서 필수 기재사항 체크리스트 정의
const CONTRACT_CHECKS = [
  { key: 'startDate', label: '근로계약기간(시작일)이 명시되어 있다' },
  { key: 'workplace', label: '근무 장소가 명시되어 있다' },
  { key: 'jobDescription', label: '업무 내용(직무)이 명시되어 있다' },
  { key: 'workHoursBreak', label: '소정근로시간·휴게시간이 명시되어 있다' },
  { key: 'workDays', label: '근무일 및 주휴일이 명시되어 있다' },
  { key: 'wage', label: '임금 구성·계산·지급방법(지급일 포함)이 명시되어 있다' },
  { key: 'annualLeaveNoticed', label: '연차유급휴가 규정을 안내했다' },
  { key: 'socialInsuranceEnrolled', label: '4대보험 적용 대상임을 확인했다' },
  { key: 'hasSignature', label: '근로자 서명 및 계약서 교부를 완료했다' },
];

function evalContractChecklist(c) {
  return {
    startDate: !!c.startDate,
    workplace: !!c.workplace,
    jobDescription: !!c.jobDescription,
    workHoursBreak: !!(c.workHours && c.breakTime),
    workDays: !!c.workDays,
    wage: !!(c.wageType && c.wageAmount && c.paymentDate),
    annualLeaveNoticed: !!c.annualLeaveNoticed,
    socialInsuranceEnrolled: !!c.socialInsuranceEnrolled,
    hasSignature: !!c.hasSignature,
  };
}
function contractIsComplete(c) {
  const r = evalContractChecklist(c);
  return Object.values(r).every(Boolean);
}

// 2026년 4대보험 요율 (국민연금 9.5%/건강보험 7.19%/장기요양 0.9448%/고용보험 근로자 0.9%/산재 평균 1.47%)
// 요율은 매년 고시로 변경되므로 실제 급여 처리 시에는 그해 공단 고시 요율로 갱신해야 함
const INSURANCE_RATES = {
  npsEmployee: 0.0475, npsEmployer: 0.0475, npsFloor: 400000, npsCap: 6370000,
  nhiEmployee: 0.03595, nhiEmployer: 0.03595,
  ltcEmployee: 0.004724, ltcEmployer: 0.004724, // 장기요양 0.9448%의 절반씩
  eiEmployee: 0.009, eiEmployerBase: 0.009, eiEmployerExtra: 0.0025, // 고용안정·직업능력개발사업분(규모별 0.25~0.85%, 예시로 최소치 적용)
  workCompEmployer: 0.0147, // 업종별 상이, 평균값(전액 사업주 부담)
};

Views.hrm = {
  title: '인사관리 (HRM)',
  subtitle: '직원 현황·근로계약서·4대보험을 관리합니다',

  render(el) {
    el.innerHTML = `
      <div class="tabs" id="hrmTabs">
        <button class="tab is-active" data-tab="list">직원 목록</button>
        <button class="tab" data-tab="contract">근로계약서 검토</button>
        <button class="tab" data-tab="insurance">4대보험 정산</button>
      </div>
      <div id="hrmTabBody"></div>
    `;
    const body = el.querySelector('#hrmTabBody');
    const tabs = { list: renderEmployeeList, contract: renderContracts, insurance: renderInsuranceCalc };

    el.querySelectorAll('#hrmTabs .tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('#hrmTabs .tab').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        body.innerHTML = '';
        tabs[btn.dataset.tab](body);
      });
    });

    renderEmployeeList(body);
  },
};

/* ================= 직원 목록 ================= */
function renderEmployeeList(el) {
  const emps = STATE.employees;

  el.innerHTML = `
    <div class="view-toolbar">
      <div class="search"><input type="search" id="hrmSearch" placeholder="이름 또는 부서 검색"></div>
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
    const list = emps.filter((e) => !filter || e.name.includes(filter) || e.dept.includes(filter));
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty">등록된 직원이 없습니다.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((e) => {
      const entitled = computeAnnualLeave(e.hireDate);
      const used = e.annualLeaveUsed || 0;
      const remain = Math.max(entitled - used, 0);
      return `
        <tr data-id="${e.id}">
          <td><strong>${UI.escapeHtml(e.name)}</strong></td>
          <td>${UI.escapeHtml(e.dept)} · ${UI.escapeHtml(e.position)}</td>
          <td>${UI.dateFmt(e.hireDate)}</td>
          <td>${tenureLabel(e.hireDate)}</td>
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

  UI.on(tbody, '.act-edit', 'click', (e, t) => openEmpModal(emps.find((x) => x.id === t.closest('tr').dataset.id)));

  UI.on(tbody, '.act-del', 'click', (e, t) => {
    const id = t.closest('tr').dataset.id;
    const emp = emps.find((x) => x.id === id);
    if (!confirm(`${emp.name}님을 삭제할까요?`)) return;
    STATE.employees = STATE.employees.filter((x) => x.id !== id);
    persist();
    renderEmployeeList(el);
    UI.toast('삭제되었습니다.');
  });

  UI.on(tbody, '.act-status', 'click', (e, t) => {
    const emp = emps.find((x) => x.id === t.closest('tr').dataset.id);
    const order = ['출근', '휴가', '재택'];
    emp.status = order[(order.indexOf(emp.status) + 1) % order.length];
    persist();
    renderEmployeeList(el);
  });

  tbody.addEventListener('change', (e) => {
    if (!e.target.classList.contains('leave-used')) return;
    const emp = emps.find((x) => x.id === e.target.closest('tr').dataset.id);
    emp.annualLeaveUsed = Math.max(0, parseInt(e.target.value, 10) || 0);
    persist();
    draw(el.querySelector('#hrmSearch').value.trim());
  });
}

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
    <div class="modal-head"><h3>${isEdit ? '직원 정보 수정' : '직원 추가'}</h3><button class="modal-close" id="mClose">✕</button></div>
    <form id="empForm">
      <div class="field"><label>이름</label><input name="name" required value="${isEdit ? UI.escapeHtml(emp.name) : ''}"></div>
      <div class="field-row">
        <div class="field"><label>부서</label><input name="dept" required value="${isEdit ? UI.escapeHtml(emp.dept) : ''}"></div>
        <div class="field"><label>직급</label><input name="position" required value="${isEdit ? UI.escapeHtml(emp.position) : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>입사일</label><input type="date" name="hireDate" required value="${isEdit ? emp.hireDate : ''}"></div>
        <div class="field"><label>상태</label>
          <select name="status">${['출근', '휴가', '재택'].map((s) => `<option ${isEdit && emp.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
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
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (isEdit) Object.assign(emp, data);
    else STATE.employees.push({ id: Storage.uid('emp'), annualLeaveUsed: 0, ...data });
    persist();
    close();
    Views.hrm.render(document.getElementById('content'));
    UI.toast(isEdit ? '수정되었습니다.' : '직원이 추가되었습니다.');
  };
}

/* ================= 근로계약서 검토 ================= */
function renderContracts(el) {
  STATE.contracts = STATE.contracts || [];
  const list = STATE.contracts;

  el.innerHTML = `
    <div class="view-toolbar">
      <div><strong style="font-size:13.5px;">근로계약서 필수 기재사항 체크</strong>
        <div class="hint">근로기준법 제17조 등 필수 기재사항 충족 여부를 자동으로 판별합니다</div>
      </div>
      <button class="btn btn-primary" id="btnAddContract">+ 근로계약서 등록</button>
    </div>
    <div class="card">
      <table id="ctrTable">
        <thead>
          <tr><th>직원</th><th>계약 형태</th><th>계약기간</th><th class="num">임금</th><th>필수사항 충족</th><th></th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = el.querySelector('#ctrTable tbody');

  const draw = () => {
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty">등록된 근로계약서가 없습니다.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((c) => {
      const emp = STATE.employees.find((e) => e.id === c.employeeId);
      const checks = evalContractChecklist(c);
      const done = Object.values(checks).filter(Boolean).length;
      const total = Object.keys(checks).length;
      const complete = done === total;
      return `
        <tr data-id="${c.id}">
          <td><strong>${emp ? UI.escapeHtml(emp.name) : '(삭제된 직원)'}</strong></td>
          <td>${UI.escapeHtml(c.contractType)}</td>
          <td>${UI.dateFmt(c.startDate)} ~ ${c.endDate ? UI.dateFmt(c.endDate) : '기간의 정함 없음'}</td>
          <td class="num">${c.wageAmount ? `${UI.won(c.wageAmount)} / ${UI.escapeHtml(c.wageType)}` : '-'}</td>
          <td>
            ${complete ? '<span class="badge badge-green">완비</span>' : `<span class="badge badge-red">미비 (${done}/${total})</span>`}
          </td>
          <td class="row-actions">
            <button class="btn btn-ghost btn-sm act-view">체크리스트</button>
            <button class="btn btn-danger btn-sm act-del">삭제</button>
          </td>
        </tr>
      `;
    }).join('');
  };
  draw();

  el.querySelector('#btnAddContract').addEventListener('click', () => openContractModal());

  UI.on(tbody, '.act-view', 'click', (e, t) => {
    openContractModal(list.find((c) => c.id === t.closest('tr').dataset.id));
  });

  UI.on(tbody, '.act-del', 'click', (e, t) => {
    const id = t.closest('tr').dataset.id;
    STATE.contracts = STATE.contracts.filter((c) => c.id !== id);
    persist();
    draw();
    UI.toast('삭제되었습니다.');
  });
}

function openContractModal(contract) {
  const isEdit = !!contract;
  const emps = STATE.employees;
  UI.openModal(`
    <div class="modal-head"><h3>${isEdit ? '근로계약서 검토' : '근로계약서 등록'}</h3><button class="modal-close" id="mClose">✕</button></div>
    <form id="ctrForm">
      <div class="field-row">
        <div class="field"><label>대상 직원</label>
          <select name="employeeId" required>
            <option value="">선택하세요</option>
            ${emps.map((e) => `<option value="${e.id}" ${isEdit && contract.employeeId === e.id ? 'selected' : ''}>${UI.escapeHtml(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>계약 형태</label>
          <select name="contractType">${['정규직', '계약직', '인턴'].map((t) => `<option ${isEdit && contract.contractType === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>계약 시작일</label><input type="date" name="startDate" value="${isEdit ? contract.startDate : ''}"></div>
        <div class="field"><label>계약 종료일 (기간 정함 없으면 비움)</label><input type="date" name="endDate" value="${isEdit ? contract.endDate || '' : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>근무 장소</label><input name="workplace" value="${isEdit ? UI.escapeHtml(contract.workplace || '') : ''}"></div>
        <div class="field"><label>업무 내용(직무)</label><input name="jobDescription" value="${isEdit ? UI.escapeHtml(contract.jobDescription || '') : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>소정근로시간</label><input name="workHours" placeholder="예: 09:00~18:00" value="${isEdit ? UI.escapeHtml(contract.workHours || '') : ''}"></div>
        <div class="field"><label>휴게시간</label><input name="breakTime" placeholder="예: 12:00~13:00" value="${isEdit ? UI.escapeHtml(contract.breakTime || '') : ''}"></div>
      </div>
      <div class="field"><label>근무일 / 주휴일</label><input name="workDays" placeholder="예: 주 5일(월~금), 주휴일 일요일" value="${isEdit ? UI.escapeHtml(contract.workDays || '') : ''}"></div>
      <div class="field-row">
        <div class="field"><label>임금 형태</label>
          <select name="wageType">${['월급', '시급', '연봉'].map((t) => `<option ${isEdit && contract.wageType === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
        <div class="field"><label>임금액 (원)</label><input type="number" min="0" name="wageAmount" value="${isEdit ? contract.wageAmount || '' : ''}"></div>
      </div>
      <div class="field"><label>임금 지급일</label><input name="paymentDate" placeholder="예: 매월 25일" value="${isEdit ? UI.escapeHtml(contract.paymentDate || '') : ''}"></div>

      <div class="card" style="background:#F7F9F7;box-shadow:none;padding:14px;margin-bottom:6px;">
        <div class="hint" style="margin-bottom:8px;font-weight:600;color:var(--text-dim);">추가 확인 항목</div>
        <div class="checklist">
          <label><input type="checkbox" name="annualLeaveNoticed" ${isEdit && contract.annualLeaveNoticed ? 'checked' : ''}> 연차유급휴가 규정을 안내했다</label>
          <label><input type="checkbox" name="socialInsuranceEnrolled" ${isEdit && contract.socialInsuranceEnrolled ? 'checked' : ''}> 4대보험 적용 대상임을 확인했다</label>
          <label><input type="checkbox" name="hasSignature" ${isEdit && contract.hasSignature ? 'checked' : ''}> 근로자 서명 및 계약서 교부를 완료했다</label>
        </div>
      </div>

      <div id="ctrChecklistPreview"></div>

      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" id="mCancel">취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '등록'}</button>
      </div>
    </form>
  `, { wide: true });

  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mCancel').onclick = close;
  document.getElementById('ctrForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      employeeId: fd.get('employeeId'),
      contractType: fd.get('contractType'),
      startDate: fd.get('startDate'),
      endDate: fd.get('endDate'),
      workplace: fd.get('workplace'),
      jobDescription: fd.get('jobDescription'),
      workHours: fd.get('workHours'),
      breakTime: fd.get('breakTime'),
      workDays: fd.get('workDays'),
      wageType: fd.get('wageType'),
      wageAmount: parseFloat(fd.get('wageAmount')) || 0,
      paymentDate: fd.get('paymentDate'),
      annualLeaveNoticed: fd.get('annualLeaveNoticed') === 'on',
      socialInsuranceEnrolled: fd.get('socialInsuranceEnrolled') === 'on',
      hasSignature: fd.get('hasSignature') === 'on',
    };
    if (!data.employeeId) { alert('대상 직원을 선택해주세요.'); return; }
    STATE.contracts = STATE.contracts || [];
    if (isEdit) Object.assign(contract, data);
    else STATE.contracts.push({ id: Storage.uid('ctr'), ...data });
    persist();
    close();
    document.querySelector('.nav-item[data-view="hrm"]').click();
    document.querySelector('#hrmTabs .tab[data-tab="contract"]').click();
    UI.toast(isEdit ? '저장되었습니다.' : '근로계약서가 등록되었습니다.');
  };
}

/* ================= 4대보험 정산 계산기 ================= */
function renderInsuranceCalc(el) {
  el.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h3>4대보험 정산 계산기</h3><div class="sub">2026년 요율 기준 · 월 급여를 입력하세요</div></div></div>
        <div class="field"><label>대상 직원 (선택 시 임금 자동 입력)</label>
          <select id="insEmp">
            <option value="">직접 입력</option>
            ${STATE.employees.map((e) => `<option value="${e.id}">${UI.escapeHtml(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>월 급여 (보수월액, 원)</label><input type="number" id="insSalary" min="0" value="3000000"></div>
        <div class="hint">국민연금은 기준소득월액 상·하한액(${UI.won(INSURANCE_RATES.npsFloor)} ~ ${UI.won(INSURANCE_RATES.npsCap)})이 적용됩니다.</div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>요율 안내 (2026년)</h3></div></div>
        <table class="mini-table">
          <tbody>
            <tr><td>국민연금</td><td class="num">9.5% (근로자 4.75% / 사업주 4.75%)</td></tr>
            <tr><td>건강보험</td><td class="num">7.19% (근로자 3.595% / 사업주 3.595%)</td></tr>
            <tr><td>장기요양보험</td><td class="num">0.9448% (근로자 0.4724% / 사업주 0.4724%)</td></tr>
            <tr><td>고용보험</td><td class="num">근로자 0.9% / 사업주 0.9%+α(규모별 상이)</td></tr>
            <tr><td>산재보험</td><td class="num">평균 1.47% (전액 사업주 부담)</td></tr>
          </tbody>
        </table>
        <div class="hint" style="margin-top:8px;">※ 요율은 매년 고시로 변경되므로, 실제 급여 처리 시 그해 공단 고시 요율로 갱신이 필요합니다.</div>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="card-head"><div><h3>정산 결과</h3></div></div>
      <table id="insTable">
        <thead><tr><th>항목</th><th class="num">근로자 부담</th><th class="num">사업주 부담</th><th class="num">합계</th></tr></thead>
        <tbody></tbody>
      </table>
      <div style="display:flex;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
        <span style="font-size:13.5px;font-weight:700;">근로자 공제 합계 / 예상 실수령액</span>
        <strong id="insSummary" class="num" style="font-size:14px;"></strong>
      </div>
    </div>
  `;

  const empEl = el.querySelector('#insEmp');
  const salaryEl = el.querySelector('#insSalary');
  const tbody = el.querySelector('#insTable tbody');
  const summaryEl = el.querySelector('#insSummary');

  const round = (n) => Math.round(n);

  const calc = () => {
    const salary = parseFloat(salaryEl.value) || 0;
    const npsBase = Math.min(INSURANCE_RATES.npsCap, Math.max(INSURANCE_RATES.npsFloor, salary));
    const rows = [
      { label: '국민연금', emp: round(npsBase * INSURANCE_RATES.npsEmployee), er: round(npsBase * INSURANCE_RATES.npsEmployer) },
      { label: '건강보험', emp: round(salary * INSURANCE_RATES.nhiEmployee), er: round(salary * INSURANCE_RATES.nhiEmployer) },
      { label: '장기요양보험', emp: round(salary * INSURANCE_RATES.ltcEmployee), er: round(salary * INSURANCE_RATES.ltcEmployer) },
      { label: '고용보험', emp: round(salary * INSURANCE_RATES.eiEmployee), er: round(salary * (INSURANCE_RATES.eiEmployerBase + INSURANCE_RATES.eiEmployerExtra)) },
      { label: '산재보험', emp: 0, er: round(salary * INSURANCE_RATES.workCompEmployer) },
    ];
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${r.label}</td>
        <td class="num">${r.emp ? UI.won(r.emp) : '-'}</td>
        <td class="num">${UI.won(r.er)}</td>
        <td class="num"><strong>${UI.won(r.emp + r.er)}</strong></td>
      </tr>
    `).join('');
    const empTotal = rows.reduce((s, r) => s + r.emp, 0);
    const netPay = salary - empTotal;
    summaryEl.textContent = `공제 ${UI.won(empTotal)} → 실수령 약 ${UI.won(netPay)}`;
  };

  empEl.addEventListener('change', () => {
    const emp = STATE.employees.find((x) => x.id === empEl.value);
    const contract = (STATE.contracts || []).find((c) => c.employeeId === empEl.value);
    if (contract && contract.wageAmount) salaryEl.value = contract.wageAmount;
    calc();
  });
  salaryEl.addEventListener('input', calc);
  calc();
}
