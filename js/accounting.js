/* =========================================================
   Accounting view — 수입/지출 CRUD, 예산 게이지, 적격증빙 체크리스트, CSV 내보내기
   ========================================================= */
Views.accounting = {
  title: '회계 · 지출증빙',
  subtitle: '수입·지출 내역과 예산 소진 현황을 관리합니다',

  render(el) {
    const now = new Date();
    let ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    el.innerHTML = `
      <div class="view-toolbar">
        <div class="search">
          <input type="month" id="ymPicker" value="${ym}">
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" id="btnCsv">엑셀(CSV) 다운로드</button>
          <button class="btn btn-primary" id="btnAddAcc">+ 항목 추가</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px;">
        <div class="card-head"><div><h3>월별 예산 소진 현황</h3><div class="sub">항목별 한도 대비 지출 비율</div></div></div>
        <div class="grid grid-3" id="budgetGrid"></div>
      </div>

      <div class="card">
        <table id="accTable">
          <thead>
            <tr><th>날짜</th><th>구분</th><th>분류</th><th class="num">금액</th><th>메모</th><th>적격증빙</th><th></th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    const tbody = el.querySelector('#accTable tbody');
    const budgetGrid = el.querySelector('#budgetGrid');

    const drawBudgets = () => {
      const entries = STATE.accountingEntries.filter((e) => e.date.startsWith(ym) && e.type === '지출');
      const cats = Object.keys(STATE.budgets);
      budgetGrid.innerHTML = cats.map((cat) => {
        const spent = entries.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
        const limit = STATE.budgets[cat];
        const pct = limit ? Math.min(150, Math.round((spent / limit) * 100)) : 0;
        const tone = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
        return `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12.3px;margin-bottom:6px;">
              <span>${cat}</span>
              <span class="num">${UI.wonShort(spent)} / ${UI.wonShort(limit)}</span>
            </div>
            <div class="gauge ${tone}"><span style="width:${Math.min(100, pct)}%"></span></div>
            ${pct >= 80 ? `<div class="hint" style="color:${pct >= 100 ? 'var(--red)' : 'var(--point)'};margin-top:4px;">${pct >= 100 ? `⚠ 예산 ${pct - 100}% 초과 사용` : '⚠ 예산 80% 이상 사용'}</div>` : ''}
          </div>
        `;
      }).join('');
    };

    const drawTable = () => {
      const list = STATE.accountingEntries.filter((e) => e.date.startsWith(ym)).sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty">해당 월의 내역이 없습니다.</div></td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((e) => {
        const compliant = isCompliant(e);
        return `
          <tr data-id="${e.id}">
            <td>${UI.dateFmt(e.date)}</td>
            <td>${e.type === '수입' ? '<span class="badge badge-blue">수입</span>' : '<span class="badge badge-red">지출</span>'}</td>
            <td>${UI.escapeHtml(e.category)}</td>
            <td class="num"><strong>${UI.won(e.amount)}</strong></td>
            <td>${UI.escapeHtml(e.memo || '-')}</td>
            <td>
              ${e.type === '지출' ? (compliant ? '<span class="badge badge-green">완비</span>' : '<span class="badge badge-red">미비</span>') : '<span class="badge badge-gray">해당없음</span>'}
              ${e.receiptImage ? `<button class="btn btn-ghost btn-sm act-receipt" style="margin-left:6px;padding:3px 8px;">📎 영수증</button>` : ''}
            </td>
            <td class="row-actions">
              <button class="btn btn-ghost btn-sm act-edit">수정</button>
              <button class="btn btn-danger btn-sm act-del">삭제</button>
            </td>
          </tr>
        `;
      }).join('');
    };

    const drawAll = () => { drawBudgets(); drawTable(); };
    drawAll();

    el.querySelector('#ymPicker').addEventListener('change', (e) => { ym = e.target.value; drawAll(); });

    el.querySelector('#btnAddAcc').addEventListener('click', () => openAccModal(ym));

    el.querySelector('#btnCsv').addEventListener('click', () => {
      exportCsv(STATE.accountingEntries.filter((e) => e.date.startsWith(ym)), ym);
      UI.toast('CSV 파일이 다운로드되었습니다.');
    });

    UI.on(tbody, '.act-edit', 'click', (e, t) => {
      const entry = STATE.accountingEntries.find((x) => x.id === t.closest('tr').dataset.id);
      openAccModal(ym, entry);
    });

    UI.on(tbody, '.act-receipt', 'click', (e, t) => {
      const entry = STATE.accountingEntries.find((x) => x.id === t.closest('tr').dataset.id);
      openReceiptViewer(entry);
    });

    UI.on(tbody, '.act-del', 'click', (e, t) => {
      const id = t.closest('tr').dataset.id;
      STATE.accountingEntries = STATE.accountingEntries.filter((x) => x.id !== id);
      persist();
      drawAll();
      UI.toast('삭제되었습니다.');
    });
  },
};

// 적격증빙 간이 판정: 3만원 초과 지출은 세금계산서(또는 계산서/카드전표)가 있어야 완비로 간주
function isCompliant(entry) {
  if (entry.type !== '지출') return true;
  if (!entry.hasReceipt) return false;
  if (entry.amount > 30000 && !entry.hasTaxInvoice) return false;
  return true;
}

function exportCsv(rows, ym) {
  const header = ['날짜', '구분', '분류', '금액', '메모', '영수증', '세금계산서'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      r.date, r.type, r.category, r.amount,
      `"${(r.memo || '').replace(/"/g, '""')}"`,
      r.hasReceipt ? 'Y' : 'N', r.hasTaxInvoice ? 'Y' : 'N',
    ].join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `accounting-${ym}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function openAccModal(ym, entry) {
  const isEdit = !!entry;
  UI.openModal(`
    <div class="modal-head"><h3>${isEdit ? '내역 수정' : '수입·지출 항목 추가'}</h3><button class="modal-close" id="mClose">✕</button></div>
    <form id="accForm">
      <div class="field-row">
        <div class="field"><label>날짜</label><input type="date" name="date" required value="${isEdit ? entry.date : `${ym}-01`}"></div>
        <div class="field"><label>구분</label>
          <select name="type" id="accType">
            <option ${isEdit && entry.type === '지출' ? 'selected' : ''}>지출</option>
            <option ${isEdit && entry.type === '수입' ? 'selected' : ''}>수입</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>분류</label>
          <select name="category">
            ${['매출', '비품 구매', '접대비', '소모품비', '통신비', '교육훈련비', '기타']
              .map((c) => `<option ${isEdit && entry.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>금액 (원)</label><input type="number" min="0" name="amount" required value="${isEdit ? entry.amount : ''}"></div>
      </div>
      <div class="field"><label>메모</label><input name="memo" value="${isEdit ? UI.escapeHtml(entry.memo || '') : ''}"></div>

      <div class="field">
        <label>영수증 첨부 (이미지)</label>
        <input type="file" id="receiptFile" accept="image/*">
        <div class="hint">첨부하면 AI가 금액·날짜를 먼저 읽어 채워드려요. 인식 결과는 반드시 확인 후 필요하면 직접 수정해주세요. 큰 이미지는 자동으로 축소되어 저장됩니다.</div>
        <div id="ocrStatus" class="ocr-status" style="display:none;"></div>
        <div id="receiptPreviewWrap" style="${isEdit && entry.receiptImage ? '' : 'display:none;'}margin-top:8px;">
          <img id="receiptPreviewImg" src="${isEdit && entry.receiptImage ? entry.receiptImage : ''}"
               style="max-width:100%;max-height:180px;border-radius:8px;border:1px solid var(--border);display:block;">
          <button type="button" class="btn btn-ghost btn-sm" id="receiptRemove" style="margin-top:6px;">첨부 제거</button>
        </div>
      </div>

      <div class="card" style="background:#F7F9F7;box-shadow:none;padding:14px;margin-bottom:6px;">
        <div class="hint" style="margin-bottom:8px;font-weight:600;color:var(--text-dim);">적격증빙 체크리스트</div>
        <div class="checklist">
          <label><input type="checkbox" name="hasReceipt" id="hasReceiptChk" ${isEdit && entry.hasReceipt ? 'checked' : ''}> 법인카드 영수증(또는 현금영수증)을 보유하고 있다</label>
          <label><input type="checkbox" name="hasTaxInvoice" ${isEdit && entry.hasTaxInvoice ? 'checked' : ''}> 3만 원 초과 건이며 세금계산서/계산서를 수취했다</label>
        </div>
      </div>

      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" id="mCancel">취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '추가'}</button>
      </div>
    </form>
  `);
  let receiptImage = isEdit ? (entry.receiptImage || null) : null;
  const previewWrap = document.getElementById('receiptPreviewWrap');
  const previewImg = document.getElementById('receiptPreviewImg');
  const hasReceiptChk = document.getElementById('hasReceiptChk');
  const ocrStatus = document.getElementById('ocrStatus');
  const amountInput = document.querySelector('#accForm [name="amount"]');
  const dateInput = document.querySelector('#accForm [name="date"]');
  const memoInput = document.querySelector('#accForm [name="memo"]');

  document.getElementById('receiptFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      receiptImage = await resizeImageToDataURL(file);
      previewImg.src = receiptImage;
      previewWrap.style.display = '';
      hasReceiptChk.checked = true; // 영수증을 첨부하면 보유 여부를 자동 체크(사용자가 다시 해제 가능)
      UI.toast('영수증 미리보기가 반영되었습니다.');
      runReceiptOcr(receiptImage);
    } catch (err) {
      console.error(err);
      alert('이미지를 읽는 중 문제가 발생했습니다.');
    }
  });

  // 영수증 이미지에서 금액·날짜를 1차로 읽어 입력창에 채워준다.
  // AI가 인식한 값을 그대로 신뢰하지 않고, 사용자가 눈으로 확인·수정하는 것을 전제로 한다.
  async function runReceiptOcr(dataURL) {
    if (typeof Tesseract === 'undefined') {
      ocrStatus.style.display = '';
      ocrStatus.className = 'ocr-status ocr-status--warn';
      ocrStatus.textContent = '⚠ OCR 라이브러리를 불러오지 못했습니다. 금액·날짜를 직접 입력해주세요.';
      return;
    }
    ocrStatus.style.display = '';
    ocrStatus.className = 'ocr-status ocr-status--busy';
    ocrStatus.textContent = '🔍 영수증에서 금액·날짜를 인식하는 중...';
    try {
      const { data } = await Tesseract.recognize(dataURL, 'kor+eng');
      const text = data && data.text ? data.text : '';
      const parsed = parseReceiptText(text);

      let filled = [];
      if (parsed.amount && (!amountInput.value || amountInput.value === '0')) {
        amountInput.value = parsed.amount;
        filled.push('금액');
      }
      if (parsed.date && dateInput) {
        dateInput.value = parsed.date;
        filled.push('날짜');
      }
      if (parsed.merchant && memoInput && !memoInput.value) {
        memoInput.value = parsed.merchant;
        filled.push('메모');
      }

      if (filled.length) {
        ocrStatus.className = 'ocr-status ocr-status--ok';
        ocrStatus.textContent = `✓ ${filled.join('·')}을(를) 자동으로 채웠어요. 정확한지 확인 후 필요하면 수정해주세요.`;
      } else {
        ocrStatus.className = 'ocr-status ocr-status--warn';
        ocrStatus.textContent = '영수증에서 금액/날짜를 정확히 읽지 못했어요. 직접 입력해주세요.';
      }
    } catch (err) {
      console.error(err);
      ocrStatus.className = 'ocr-status ocr-status--warn';
      ocrStatus.textContent = '자동 인식에 실패했어요. 직접 입력해주세요.';
    }
  }

  document.getElementById('receiptRemove').addEventListener('click', () => {
    receiptImage = null;
    previewWrap.style.display = 'none';
    previewImg.src = '';
    document.getElementById('receiptFile').value = '';
    ocrStatus.style.display = 'none';
  });

  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mCancel').onclick = close;
  document.getElementById('accForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      date: fd.get('date'),
      type: fd.get('type'),
      category: fd.get('category'),
      amount: parseFloat(fd.get('amount')) || 0,
      memo: fd.get('memo'),
      hasReceipt: fd.get('hasReceipt') === 'on',
      hasTaxInvoice: fd.get('hasTaxInvoice') === 'on',
      receiptImage,
    };
    if (isEdit) Object.assign(entry, data);
    else STATE.accountingEntries.push({ id: Storage.uid('acc'), ...data });
    persist();
    close();
    Views.accounting.render(document.getElementById('content'));
    UI.toast(isEdit ? '수정되었습니다.' : '항목이 추가되었습니다.');
  };
}

// 큰 이미지는 localStorage 용량 부담이 크므로 캔버스로 축소 후 JPEG로 저장한다.
function resizeImageToDataURL(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// OCR 원문 텍스트에서 금액·날짜·상호명을 추출한다.
// 완벽한 인식을 목표로 하지 않는다 — "1차로 채워주고, 사람이 확인·수정한다"는 전제의 보조 도구다.
function parseReceiptText(text) {
  const result = { amount: null, date: null, merchant: null };
  if (!text) return result;

  const clean = text.replace(/\r/g, '');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  // 날짜: 2024-01-05 / 2024.01.05 / 2024/01/05 형태를 찾는다.
  const dateMatch = clean.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = String(dateMatch[2]).padStart(2, '0');
    const d = String(dateMatch[3]).padStart(2, '0');
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) result.date = `${y}-${m}-${d}`;
  }

  // 금액: '합계/총액/결제금액' 근처의 숫자를 우선하고, 없으면 문서 내 최댓값을 사용한다.
  const priorityLines = lines.filter((l) => /(합계|총액|결제금액|받을금액|판매금액|과세물품가액|공급대가)/.test(l));
  const numberFrom = (line) => {
    const matches = line.match(/[\d]{1,3}(?:,\d{3})+|\d{4,}/g);
    if (!matches) return null;
    const nums = matches.map((n) => parseInt(n.replace(/,/g, ''), 10)).filter((n) => n >= 100 && n <= 50000000);
    return nums.length ? Math.max(...nums) : null;
  };

  let amount = null;
  for (const line of priorityLines) {
    const n = numberFrom(line);
    if (n) { amount = n; break; }
  }
  if (!amount) {
    const allNums = lines.map(numberFrom).filter((n) => n !== null);
    if (allNums.length) amount = Math.max(...allNums);
  }
  result.amount = amount;

  // 상호명: 보통 영수증 맨 위 1~2줄에 있고, 숫자만으로 이뤄진 줄은 제외한다.
  const merchantLine = lines.slice(0, 3).find((l) => l.length >= 2 && !/^[\d.\-/:\s]+$/.test(l));
  if (merchantLine) result.merchant = merchantLine.slice(0, 30);

  return result;
}

function openReceiptViewer(entry) {
  UI.openModal(`
    <div class="modal-head"><h3>영수증 · ${UI.escapeHtml(entry.memo || entry.category)}</h3><button class="modal-close" id="mClose">✕</button></div>
    <div style="font-size:12.3px;color:var(--text-dim);margin-bottom:10px;">
      ${UI.dateFmt(entry.date)} · ${UI.escapeHtml(entry.category)} · <strong class="num">${UI.won(entry.amount)}</strong>
    </div>
    <img src="${entry.receiptImage}" style="width:100%;border-radius:10px;border:1px solid var(--border);">
    <div class="modal-foot"><button type="button" class="btn btn-ghost" id="mClose2">닫기</button></div>
  `);
  const close = () => UI.closeModal();
  document.getElementById('mClose').onclick = close;
  document.getElementById('mClose2').onclick = close;
}
