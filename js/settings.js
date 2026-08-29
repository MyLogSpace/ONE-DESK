/* =========================================================
   Settings view — 데이터 백업(JSON 다운로드) / 복구(업로드)
   ========================================================= */
Views.settings = {
  title: '데이터 백업 / 복구',
  subtitle: '이 사이트는 서버 없이 브라우저에만 데이터를 저장합니다',

  render(el) {
    const updatedAt = STATE.meta?.updatedAt ? new Date(STATE.meta.updatedAt) : null;

    el.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div><h3>📤 데이터 백업</h3><div class="sub">전체 데이터를 JSON 파일로 다운로드합니다</div></div></div>
          <p style="font-size:12.8px;color:var(--text-dim);line-height:1.7;">
            인사·전자결재·회계·CRM·자산 데이터가 모두 하나의 파일로 저장됩니다.
            브라우저를 바꾸거나 캐시를 지우기 전에 백업해 두면 안전합니다.
          </p>
          <button class="btn btn-primary" id="btnBackup" style="margin-top:6px;">JSON 파일로 백업 다운로드</button>
        </div>

        <div class="card">
          <div class="card-head"><div><h3>📥 데이터 복구</h3><div class="sub">백업 파일을 업로드해 데이터를 복원합니다</div></div></div>
          <p style="font-size:12.8px;color:var(--text-dim);line-height:1.7;">
            복구 시 현재 브라우저에 저장된 데이터는 업로드한 파일 내용으로 <strong>덮어써집니다.</strong>
          </p>
          <input type="file" id="restoreFile" accept="application/json" style="display:none;">
          <button class="btn btn-ghost" id="btnRestore" style="margin-top:6px;">백업 파일 선택 후 복구</button>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-head"><div><h3>현재 저장 상태</h3></div></div>
        <table class="mini-table">
          <tbody>
            <tr><td>마지막 저장 시각</td><td class="num">${updatedAt ? updatedAt.toLocaleString('ko-KR') : '기록 없음'}</td></tr>
            <tr><td>직원 수</td><td class="num">${STATE.employees.length}명</td></tr>
            <tr><td>결재 문서 수</td><td class="num">${STATE.approvals.length}건</td></tr>
            <tr><td>회계 내역 수</td><td class="num">${STATE.accountingEntries.length}건</td></tr>
            <tr><td>고객 수</td><td class="num">${STATE.customers.length}명</td></tr>
            <tr><td>자산 항목 수</td><td class="num">${STATE.assets.length}건</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:16px;border-color:#FCA5A5;background:#FFF8F8;">
        <div class="card-head"><div><h3 style="color:#B91C1C;">⚠ 샘플 데이터로 초기화</h3><div class="sub">현재 데이터를 모두 지우고 예시 데이터로 되돌립니다</div></div></div>
        <button class="btn btn-danger" id="btnReset">초기화하기</button>
      </div>
    `;

    el.querySelector('#btnBackup').addEventListener('click', () => {
      Storage.exportJSON(STATE);
      UI.toast('백업 파일이 다운로드되었습니다.');
    });

    const fileInput = el.querySelector('#restoreFile');
    el.querySelector('#btnRestore').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!confirm('현재 데이터를 백업 파일 내용으로 덮어씁니다. 계속할까요?')) { fileInput.value = ''; return; }
      Storage.importJSON(file, (parsed) => {
        STATE = parsed;
        persist();
        UI.toast('데이터가 복구되었습니다.');
        Views.settings.render(el);
      }, (err) => {
        alert('파일을 읽을 수 없습니다. 올바른 백업(JSON) 파일인지 확인해주세요.');
        console.error(err);
      });
      fileInput.value = '';
    });

    el.querySelector('#btnReset').addEventListener('click', () => {
      if (!confirm('정말로 모든 데이터를 삭제하고 샘플 데이터로 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) return;
      STATE = buildSeedState();
      persist();
      UI.toast('샘플 데이터로 초기화되었습니다.');
      Views.settings.render(el);
    });
  },
};
