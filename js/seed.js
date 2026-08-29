/* =========================================================
   Seed data — 최초 접속(데이터가 비어있을 때)에만 채워지는 예시 데이터
   ========================================================= */
function buildSeedState() {
  const today = new Date();
  const iso = (y, m, d) => new Date(y, m - 1, d).toISOString().slice(0, 10);
  const thisY = today.getFullYear();
  const thisM = today.getMonth() + 1;

  return {
    meta: { version: 1, createdAt: new Date().toISOString() },

    employees: [
      { id: 'emp_1', name: '김도윤', dept: '경영지원팀', position: '팀장', hireDate: iso(2019, 3, 4), status: '출근' },
      { id: 'emp_2', name: '이서아', dept: '경영지원팀', position: '주임', hireDate: iso(2022, 7, 18), status: '출근' },
      { id: 'emp_3', name: '박지훈', dept: '영업팀', position: '대리', hireDate: iso(2021, 1, 11), status: '휴가' },
      { id: 'emp_4', name: '최하은', dept: '개발팀', position: '사원', hireDate: iso(2023, 9, 1), status: '출근' },
      { id: 'emp_5', name: '정우진', dept: '영업팀', position: '팀장', hireDate: iso(2018, 5, 20), status: '재택' },
    ],

    approvals: [
      {
        id: 'apv_1', docType: '지출결의서', title: '노트북 구매의 건', requester: '최하은', category: '비품 구매',
        qty: 1, unitPrice: 1800000, supplyAmount: 1800000, vat: 180000, total: 1980000,
        chain: ['팀장', '본부장', '대표이사'], stepIndex: 0, status: '대기', createdAt: iso(thisY, thisM, 3),
      },
      {
        id: 'apv_2', docType: '지출결의서', title: '거래처 미팅 식대', requester: '박지훈', category: '접대비',
        qty: 1, unitPrice: 220000, supplyAmount: 200000, vat: 20000, total: 220000,
        chain: ['팀장'], stepIndex: 1, status: '승인', createdAt: iso(thisY, thisM, 5),
      },
      {
        id: 'apv_3', docType: '지출결의서', title: '사무용품 구매', requester: '이서아', category: '소모품비',
        qty: 5, unitPrice: 12000, supplyAmount: 54545, vat: 5455, total: 60000,
        chain: ['팀장'], stepIndex: 1, status: '승인', createdAt: iso(thisY, thisM, 8),
      },
      {
        id: 'apv_4', docType: '지출결의서', title: '외부 세미나 참가비', requester: '정우진', category: '교육훈련비',
        qty: 2, unitPrice: 150000, supplyAmount: 272727, vat: 27273, total: 300000,
        chain: ['팀장', '본부장'], stepIndex: 0, status: '반려', createdAt: iso(thisY, thisM, 10),
      },
      {
        id: 'apv_5', docType: '휴가신청서', title: '연차 신청 (개인 사유)', requester: '박지훈', employeeId: 'emp_3',
        startDate: iso(thisY, thisM, 20), endDate: iso(thisY, thisM, 21), days: 2, reason: '개인 사유',
        chain: ['팀장'], stepIndex: 0, status: '대기', createdAt: iso(thisY, thisM, 15),
      },
    ],

    accountingEntries: [
      { id: 'acc_1', date: iso(thisY, thisM, 2), type: '수입', category: '매출', amount: 8500000, memo: '정기 구독 매출', hasReceipt: true, hasTaxInvoice: true },
      { id: 'acc_2', date: iso(thisY, thisM, 4), type: '지출', category: '소모품비', amount: 60000, memo: '사무용품 구매', hasReceipt: true, hasTaxInvoice: false },
      { id: 'acc_3', date: iso(thisY, thisM, 6), type: '지출', category: '접대비', amount: 220000, memo: '거래처 미팅 식대', hasReceipt: true, hasTaxInvoice: false },
      { id: 'acc_4', date: iso(thisY, thisM, 12), type: '지출', category: '통신비', amount: 145000, memo: '법인 인터넷/통신 요금', hasReceipt: false, hasTaxInvoice: true },
      { id: 'acc_5', date: iso(thisY, thisM, 15), type: '수입', category: '매출', amount: 3200000, memo: '신규 계약 계약금', hasReceipt: false, hasTaxInvoice: true },
      { id: 'acc_6', date: iso(thisY, thisM, 18), type: '지출', category: '비품 구매', amount: 1980000, memo: '노트북 구매', hasReceipt: true, hasTaxInvoice: true },
    ],

    budgets: {
      '소모품비': 300000,
      '접대비': 500000,
      '통신비': 200000,
      '교육훈련비': 400000,
      '비품 구매': 3000000,
    },

    customers: [
      { id: 'cus_1', name: '이현수', company: '(주)브릿지랩', contact: '010-2222-3333', stage: '리드', dealAmount: 0, memo: '홈페이지 문의 유입' },
      { id: 'cus_2', name: '한소영', company: '스퀘어스튜디오', contact: '010-4444-5555', stage: '상담', dealAmount: 4500000, memo: '2차 미팅 예정' },
      { id: 'cus_3', name: '오민재', company: '그린테이블', contact: '010-6666-7777', stage: '제안', dealAmount: 7200000, memo: '제안서 발송 완료' },
      { id: 'cus_4', name: '장예린', company: '노바푸드', contact: '010-8888-9999', stage: '계약', dealAmount: 12000000, memo: '계약서 서명 완료' },
      { id: 'cus_5', name: '배준호', company: '데일리커머스', contact: '010-1111-2222', stage: '상담', dealAmount: 3000000, memo: '견적 요청' },
    ],

    contracts: [
      {
        id: 'ctr_1', employeeId: 'emp_1', contractType: '정규직',
        startDate: iso(2019, 3, 4), endDate: '', workplace: '서울 본사',
        jobDescription: '경영지원팀 팀장 직무', workHours: '09:00~18:00', breakTime: '12:00~13:00',
        workDays: '주 5일(월~금), 주휴일 일요일', wageType: '월급', wageAmount: 4200000, paymentDate: '매월 25일',
        annualLeaveNoticed: true, socialInsuranceEnrolled: true, hasSignature: true,
      },
      {
        id: 'ctr_2', employeeId: 'emp_4', contractType: '정규직',
        startDate: iso(2023, 9, 1), endDate: '', workplace: '서울 본사',
        jobDescription: '개발팀 사원 직무', workHours: '09:00~18:00', breakTime: '12:00~13:00',
        workDays: '', wageType: '월급', wageAmount: 3100000, paymentDate: '',
        annualLeaveNoticed: true, socialInsuranceEnrolled: true, hasSignature: false,
      },
    ],

    assets: [
      { id: 'ast_1', name: '노트북 (MacBook Pro)', category: '전자기기', purchaseDate: iso(thisY - 1, 3, 15), price: 2800000, usefulYears: 4, method: '정률법', qty: 1, safeAmount: 15 },
      { id: 'ast_2', name: '사무용 의자', category: '가구', purchaseDate: iso(thisY - 2, 9, 1), price: 350000, usefulYears: 5, method: '정액법', qty: 8, safeAmount: 3 },
      { id: 'ast_3', name: '모니터 27형', category: '전자기기', purchaseDate: iso(thisY, 1, 20), price: 420000, usefulYears: 4, method: '정액법', qty: 6, safeAmount: 2 },
      { id: 'ast_4', name: 'A4 용지 (박스)', category: '소모품', purchaseDate: iso(thisY, thisM, 1), price: 32000, usefulYears: 0, method: '정액법', qty: 4, safeAmount: 5 },
    ],
  };
}
