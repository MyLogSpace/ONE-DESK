/* =========================================================
   Assets view — 자산/재고 CRUD, 정액법 감가상각, 안전재고 경고
   ========================================================= */
Views.assets = {
  title: '재고 · 자산관리',
  subtitle: '비품/자산 현황과 감가상각을 관리합니다',

  render(el) {
    const list = STATE.assets;
    const lowStock = list.filter((a) => (a.qty ?? 1) <= (a.safeAmount ?? 0));

    el.innerHTML = `
      ${lowStock.length ? `
        <div class="card" style="margin-bottom:18px;border-color:#FCA5A5;background:#FFF8F8;">
          <div style="display:flex;align-items:center;gap:8px;font-size:12.8px;color:#B91C1C;font-weight:700;">
            ⚠ 안전재고 이하 품목 ${lowStock.length}건: ${lowStock.map((a) => UI.escapeHtml(a.name)).join(', ')}
          </div>
        </div>
      ` : ''}

      <div class="view-toolbar">
        <div><strong style="font-size:13.5px;">자산 · 재고 목록</strong></div>
        <button class="btn btn-primary" id="btnAddAsset">+ 자산 추가</button>
      </div>

      <div class="card">
        <table id="astTable">
          <thead>
            <tr>
              <th>자산명</th><th>분류</th><th>구매일</th><th class="num">구매금액</th>
              <th class="num">내용연수</th><th>상각방법</th><th class="num">감가상각누계</th><th class="num">현재 장부가치</th>
              <th class="num">수량</th><th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    const tbody = el.querySelector('#astTable tbody');

    const draw = () => {
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="empty">등록된 자산이 없습니다.</div></td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((a) => {
        const dep = depreciation(a);
        const low = (a.qty ?? 1) <= (a.safeAmount ?? 0);
        return `
          <tr data-id="${a.id}">
            <td><strong>${UI.escapeHtml(a.name)}</strong></td>
            <td>${UI.escapeHtml(a.category)}</td>
            <td>${UI.dateFmt(a.purchaseDate)}</td>
            <td class="num">${UI.won(a.price)}</td>
            <td class="num">${a.usefulYears ? `${a.usefulYears}년` : '-'}</td>
            <td>${a.usefulYears ? `<span class="badge badge-gray">${a.method || '정액법'}</span>` : '-'}</td>
            <td class="num">${a.usefulYears ? UI.won(dep.accumulated) : '-'}</td>
            <td class="num"><strong>${a.usefulYears ? UI.won(dep.bookValue) : UI.won(a.price)}</strong></td>
            <td class="num">${low ? `<span class="badge badge-red">${a.qty}개</span>` : `${a.qty ?? 1}개`}</td>
            <td class="row-actions">
              <button class="btn btn-ghost btn-sm act-edit">수정</button>
              <button class="btn btn-danger btn-sm act-del">삭제</button>
            </td>
          </tr>
        `;
      }).join('');
    };

    draw();

    el.querySelector('#btnAddAsset').addEventListener('click', () => openAssetModal());

    UI.on(tbody, '.act-edit', 'click', (e, t) => {
      const id = t.closest('tr').dataset.id;
      openAssetModal(list.find((x) => x.id === id));
    });

    UI.on(tbody, '.act-del', 'click', (e, t) => {
      const id = t.closest('tr').dataset.id;
      STATE.assets = STATE.assets.filter((x) => x.id !== id);
      persist();
      Views.assets.render(el);
      UI.toast('삭제되었습니다.');
    });
  },
};

// 정액법: 연간 상각액 = 취득가액 / 내용연수, 경과연수만큼 누적 (취득가액 한도)
// 정률법: 잔존가치를 취득가액의 5%로 가정하고 상각률 r = 1-(잔존가치/취득가액)^(1/내용연수)을 적용해
//         매년 (기초 장부가액 × r)만큼 상각 — 초기에 더 많이, 갈수록 적게 상각되는 방식
function depreciation(asset) {
  if (!asset.usefulYears) return { accumulated: 0, bookValue: asset.price };
  const now = new Date();
  const purchase = new Date(asset.purchaseDate);
  const elapsedYears = Math.max(0, (now - purchase) / (365.25 * 86400000));

  if (asset.method === '정률법') {
    const salvageRatio = 0.05;
    const rate = 1 - Math.pow(salvageRatio, 1 / asset.usefulYears);
    const bookValue = Math.max(asset.price * salvageRatio, asset.price * Math.pow(1 - rate, elapsedYears));
    return { accumulated: asset.price - bookValue, bookValue };
  }

  const annual = asset.price / asset.usefulYears;
  const accumulated = Math.min(asset.price, annual * elapsedYears);
  return { accumulated, bookValue: asset.price - accumulated };
}

function openAssetModal(asset) {
  const isEdit = !!asset;
  UI.openModal(`
    <div class="modal-head"><h3>${isEdit ? '자산 정보 수정' : '자산 추가'}</h3><button class="modal-close" id="mClose">✕</button></div>
    <form id="astForm">
      <div class="field"><label>자산명</label><input name="name" required value="${isEdit ? UI.escapeHtml(asset.name) : ''}"></div>
      <div class="field-row">
        <div class="field"><label>분류</label>
          <select name="category">
            ${['전자기기', '가구', '소모품', '차량', '기타'].map((c) => `<option ${isEdit && asset.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>구매일</label><input type="date" name="purchaseDate" required value="${isEdit ? asset.purchaseDate : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>구매금액 (원)</label><input type="number" min="0" name="price" required value="${isEdit ? asset.price : ''}"></div>
        <div class="field"><label>내용연수 (년, 소모품은 0)</label><input type="number" min="0" name="usefulYears" required value="${isEdit ? asset.usefulYears : 4}"></div>
      </div>
      <div class="field">
        <label>감가상각 방법</label>
        <select name="method">
          <option ${isEdit && asset.method === '정액법' ? 'selected' : ''}>정액법</option>
          <option ${isEdit && asset.method === '정률법' ? 'selected' : ''}>정률법</option>
        </select>
        <div class="hint">정액법: 매년 동일 금액 상각 · 정률법: 초기에 많이, 갈수록 적게 상각(잔존가치 5% 가정)</div>
      </div>
      <div class="field-row">
        <div class="field"><label>보유 수량</label><input type="number" min="0" name="qty" required value="${isEdit ? asset.qty : 1}"></div>
        <div class="field"><label>안전재고 수량</label><input type="number" min="0" name="safeAmount" required value="${isEdit ? asset.safeAmount : 0}"></div>
      </div>
      <div class="hint">내용연수를 0으로 두면 감가상각 없이 재고 수량만 관리됩니다.</div>
      <div class="modal-foot" style="margin-top:14px;">
        <button type="button" class="btn btn-ghost" id="mCancel">취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '추가'}</button>
      </div>
    </form>
  `);
  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mCancel').onclick = close;
  document.getElementById('astForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'), category: fd.get('category'), purchaseDate: fd.get('purchaseDate'),
      price: parseFloat(fd.get('price')) || 0,
      usefulYears: parseFloat(fd.get('usefulYears')) || 0,
      method: fd.get('method') || '정액법',
      qty: parseInt(fd.get('qty'), 10) || 0,
      safeAmount: parseInt(fd.get('safeAmount'), 10) || 0,
    };
    if (isEdit) Object.assign(asset, data);
    else STATE.assets.push({ id: Storage.uid('ast'), ...data });
    persist();
    close();
    Views.assets.render(document.getElementById('content'));
    UI.toast(isEdit ? '수정되었습니다.' : '자산이 추가되었습니다.');
  };
}
