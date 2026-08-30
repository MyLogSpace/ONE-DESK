/* =========================================================
   마이페이지 — 일반 직원용 "본인 데이터만" 화면
   연차/월차, 본인 결재·지출결의 상태, 본인 근로계약서 요약, 비밀번호 변경을 제공합니다.
   ========================================================= */
Views.myinfo = {
  title: '마이페이지',
  subtitle: '내 정보와 연차·결재 현황을 확인합니다',

  render(el) {
    const user = Auth.currentUser();
    if (!user) {
      el.innerHTML = `<div class="empty">로그인 정보를 확인할 수 없습니다.</div>`;
      return;
    }

    const entitled = computeAnnualLeave(user.hireDate);
    const used = user.annualLeaveUsed || 0;
    const remain = Math.max(entitled - used, 0);

    const myApprovals = (STATE.approvals || []).filter((a) => a.requester === user.name);
    const myContract = (STATE.contracts || []).find((c) => c.employeeId === user.id);

    el.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div><h3>내 정보</h3></div></div>
          <table class="mini-table">
            <tbody>
              <tr><td>이름</td><td class="num">${UI.escapeHtml(user.name)}</td></tr>
              <tr><td>소속</td><td class="num">${UI.escapeHtml(user.dept)} · ${UI.escapeHtml(user.position)}</td></tr>
              <tr><td>입사일</td><td class="num">${UI.dateFmt(user.hireDate)}</td></tr>
              <tr><td>근속</td><td class="num">${tenureLabel(user.hireDate)}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>연차·월차 현황</h3></div></div>
          <table class="mini-table">
            <tbody>
              <tr><td>올해 연차 발생</td><td class="num">${entitled}일</td></tr>
              <tr><td>사용</td><td class="num">${used}일</td></tr>
              <tr><td>잔여</td><td class="num"><strong>${remain}일</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-head"><div><h3>내 근로계약서</h3><div class="sub">본인 계약서만 열람할 수 있어요</div></div></div>
        ${myContract ? `
          <table class="mini-table">
            <tbody>
              <tr><td>계약 형태</td><td class="num">${UI.escapeHtml(myContract.contractType)}</td></tr>
              <tr><td>계약기간</td><td class="num">${UI.dateFmt(myContract.startDate)} ~ ${myContract.endDate ? UI.dateFmt(myContract.endDate) : '기간의 정함 없음'}</td></tr>
              <tr><td>근무 장소</td><td class="num">${UI.escapeHtml(myContract.workplace || '-')}</td></tr>
              <tr><td>임금</td><td class="num">${myContract.wageAmount ? `${UI.won(myContract.wageAmount)} / ${UI.escapeHtml(myContract.wageType)}` : '-'}</td></tr>
              <tr><td>임금 지급일</td><td class="num">${UI.escapeHtml(myContract.paymentDate || '-')}</td></tr>
            </tbody>
          </table>
        ` : `<div class="empty">등록된 근로계약서가 없습니다. 경영지원팀에 문의해주세요.</div>`}
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-head"><div><h3>내 결재·지출결의 현황</h3><div class="sub">내가 상신한 문서의 진행 상태만 보여요</div></div></div>
        <table>
          <thead><tr><th>문서 종류</th><th>제목</th><th class="num">금액</th><th>상태</th><th>상신일</th></tr></thead>
          <tbody>
            ${myApprovals.length ? myApprovals.map((a) => `
              <tr>
                <td>${UI.escapeHtml(a.docType)}</td>
                <td>${UI.escapeHtml(a.title)}</td>
                <td class="num">${a.total ? UI.won(a.total) : '-'}</td>
                <td>${statusBadgeApv(a.status)}</td>
                <td>${UI.dateFmt(a.createdAt)}</td>
              </tr>
            `).join('') : `<tr><td colspan="5"><div class="empty">상신한 결재 문서가 없습니다.</div></td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-head"><div><h3>비밀번호 변경</h3></div></div>
        <form id="pwForm">
          <div class="field-row">
            <div class="field"><label>새 비밀번호</label><input type="password" name="pw1" minlength="4" required></div>
            <div class="field"><label>새 비밀번호 확인</label><input type="password" name="pw2" minlength="4" required></div>
          </div>
          <button type="submit" class="btn btn-primary">변경하기</button>
        </form>
      </div>
    `;

    el.querySelector('#pwForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const pw1 = fd.get('pw1');
      const pw2 = fd.get('pw2');
      if (pw1 !== pw2) { alert('새 비밀번호가 서로 일치하지 않습니다.'); return; }
      Auth.changePassword(pw1);
      e.target.reset();
      UI.toast('비밀번호가 변경되었습니다.');
    });
  },
};
