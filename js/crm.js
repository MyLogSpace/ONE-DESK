/* =========================================================
   CRM view — 영업 파이프라인(칸반) + 고객 목록 CRUD
   ========================================================= */
const CRM_STAGES = ['리드', '상담', '제안', '계약'];

Views.crm = {
  title: '고객 · 영업관리 (CRM)',
  subtitle: '영업 파이프라인과 고객 정보를 관리합니다',

  render(el) {
    const list = STATE.customers;
    const totalPipeline = list.filter((c) => c.stage !== '계약').reduce((s, c) => s + (c.dealAmount || 0), 0);
    const closedAmount = list.filter((c) => c.stage === '계약').reduce((s, c) => s + (c.dealAmount || 0), 0);

    el.innerHTML = `
      <div class="grid grid-3" style="margin-bottom:18px;">
        <div class="card"><div class="kpi-label">진행 중 파이프라인</div><div class="kpi-value blue num">${UI.won(totalPipeline)}</div><div class="kpi-foot">${list.filter(c=>c.stage!=='계약').length}건 진행 중</div></div>
        <div class="card"><div class="kpi-label">계약 확정 금액</div><div class="kpi-value green num">${UI.won(closedAmount)}</div><div class="kpi-foot">${list.filter(c=>c.stage==='계약').length}건 계약</div></div>
        <div class="card"><div class="kpi-label">전체 고객 수</div><div class="kpi-value num">${list.length}명</div><div class="kpi-foot">누적 등록 고객</div></div>
      </div>

      <div class="view-toolbar">
        <div><strong style="font-size:13.5px;">영업 파이프라인</strong></div>
        <button class="btn btn-primary" id="btnAddCus">+ 고객 추가</button>
      </div>

      <div class="kanban" id="kanban"></div>
    `;

    const kanban = el.querySelector('#kanban');

    const draw = () => {
      kanban.innerHTML = CRM_STAGES.map((stage) => {
        const items = list.filter((c) => c.stage === stage);
        const sum = items.reduce((s, c) => s + (c.dealAmount || 0), 0);
        return `
          <div class="kanban-col" data-stage="${stage}">
            <h4>${stage} <span class="num">${items.length}건 · ${UI.wonShort(sum)}</span></h4>
            ${items.map((c) => `
              <div class="kanban-card" data-id="${c.id}">
                <strong>${UI.escapeHtml(c.company)}</strong>
                <div>${UI.escapeHtml(c.name)} · ${UI.escapeHtml(c.contact || '-')}</div>
                ${c.dealAmount ? `<div class="amt num">${UI.won(c.dealAmount)}</div>` : ''}
                <div style="display:flex;gap:5px;margin-top:9px;">
                  <select class="stage-move" style="flex:1;font-size:11px;padding:5px 6px;border:1px solid var(--border);border-radius:6px;">
                    ${CRM_STAGES.map((s) => `<option value="${s}" ${s === stage ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                  <button class="btn btn-ghost btn-sm cus-edit">수정</button>
                </div>
              </div>
            `).join('') || `<div class="hint" style="padding:8px 2px;">항목 없음</div>`}
          </div>
        `;
      }).join('');
    };

    draw();

    el.querySelector('#btnAddCus').addEventListener('click', () => openCusModal());

    UI.on(kanban, '.cus-edit', 'click', (e, t) => {
      const id = t.closest('.kanban-card').dataset.id;
      openCusModal(list.find((c) => c.id === id));
    });

    kanban.addEventListener('change', (e) => {
      if (!e.target.classList.contains('stage-move')) return;
      const id = e.target.closest('.kanban-card').dataset.id;
      const cus = list.find((c) => c.id === id);
      cus.stage = e.target.value;
      persist();
      Views.crm.render(el);
      UI.toast(`${cus.company} → ${cus.stage} 단계로 이동했습니다.`);
    });
  },
};

function openCusModal(cus) {
  const isEdit = !!cus;
  UI.openModal(`
    <div class="modal-head"><h3>${isEdit ? '고객 정보 수정' : '고객 추가'}</h3><button class="modal-close" id="mClose">✕</button></div>
    <form id="cusForm">
      <div class="field-row">
        <div class="field"><label>담당자명</label><input name="name" required value="${isEdit ? UI.escapeHtml(cus.name) : ''}"></div>
        <div class="field"><label>회사명</label><input name="company" required value="${isEdit ? UI.escapeHtml(cus.company) : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>연락처</label><input name="contact" value="${isEdit ? UI.escapeHtml(cus.contact || '') : ''}"></div>
        <div class="field"><label>영업 단계</label>
          <select name="stage">${CRM_STAGES.map((s) => `<option ${isEdit && cus.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>예상/계약 금액 (원)</label><input type="number" min="0" name="dealAmount" value="${isEdit ? cus.dealAmount : 0}"></div>
      <div class="field"><label>메모</label><textarea name="memo" rows="2">${isEdit ? UI.escapeHtml(cus.memo || '') : ''}</textarea></div>
      <div class="modal-foot">
        ${isEdit ? `<button type="button" class="btn btn-danger" id="mDelete" style="margin-right:auto;">삭제</button>` : ''}
        <button type="button" class="btn btn-ghost" id="mCancel">취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '추가'}</button>
      </div>
    </form>
  `);
  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mCancel').onclick = close;
  if (isEdit) {
    document.getElementById('mDelete').onclick = () => {
      if (!confirm('이 고객 정보를 삭제할까요?')) return;
      STATE.customers = STATE.customers.filter((c) => c.id !== cus.id);
      persist();
      close();
      Views.crm.render(document.getElementById('content'));
      UI.toast('삭제되었습니다.');
    };
  }
  document.getElementById('cusForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.dealAmount = parseFloat(data.dealAmount) || 0;
    if (isEdit) Object.assign(cus, data);
    else STATE.customers.push({ id: Storage.uid('cus'), ...data });
    persist();
    close();
    Views.crm.render(document.getElementById('content'));
    UI.toast(isEdit ? '수정되었습니다.' : '고객이 추가되었습니다.');
  };
}
