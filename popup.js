/**
 * popup.html의 스크립트 로직
 * 인증 횟수, 닉네임, 본문 템플릿, 달력 기능을 관리합니다.
 */

document.addEventListener('DOMContentLoaded', () => {
  const countInput = document.getElementById('auth-count-input');
  const nicknameInput = document.getElementById('nickname-input');
  const templateInput = document.getElementById('template-input'); // 템플릿 textarea 추가
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');
  
  // 스토리지에서 데이터(인증 횟수, 닉네임, 본문 템플릿)를 불러와서 각 입력 필드에 채웁니다.
  chrome.storage.sync.get(['authCount', 'cafeNickname', 'bodyTemplate'], (result) => {
    if (result.authCount) {
      countInput.value = result.authCount;
    }
    if (result.cafeNickname) {
      nicknameInput.value = result.cafeNickname;
    }
    // 저장된 본문 템플릿을 불러오거나, 없으면 기본값을 설정합니다.
    if (result.bodyTemplate) {
      templateInput.value = result.bodyTemplate;
    } else {
      // 기본 템플릿 설정
      templateInput.value = '#${authCount} 번째 [${nickname}] 데일리 인증\n - ';
    }
  });

  // '설정 저장' 버튼 클릭 이벤트 리스너
  saveBtn.addEventListener('click', () => {
    const authCount = countInput.value;
    const nickname = nicknameInput.value;
    const bodyTemplate = templateInput.value; // 템플릿 내용 가져오기

    // 인증 횟수, 닉네임, 본문 템플릿을 스토리지에 저장합니다.
    chrome.storage.sync.set({ 
      authCount: authCount, 
      cafeNickname: nickname,
      bodyTemplate: bodyTemplate // 템플릿 저장
    }, () => {
      status.textContent = '✅ 저장이 완료되었습니다!';
      status.classList.add('show');
      
      setTimeout(() => {
        status.classList.remove('show');
      }, 2000);
    });
  });

  // --- 달력 기능 ---
  const monthYearEl = document.getElementById('month-year');
  const calendarGridEl = document.getElementById('calendar-grid');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  
  let currentDate = new Date();

  const renderCalendar = (date) => {
    // 달력을 그릴 때, 'authDates'와 'lastAuthDate'를 함께 가져옵니다.
    chrome.storage.sync.get(['authDates', 'lastAuthDate'], (data) => {
      const authDates = data.authDates || [];
      const lastAuthDate = data.lastAuthDate;
      const year = date.getFullYear();
      const month = date.getMonth();

      monthYearEl.textContent = `${year}년 ${month + 1}월`;
      calendarGridEl.innerHTML = '';

      // 요일 헤더 추가
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      days.forEach((day, index) => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-cell day-header';
        if (index === 0) dayEl.classList.add('sunday');
        if (index === 6) dayEl.classList.add('saturday');
        dayEl.textContent = day;
        calendarGridEl.appendChild(dayEl);
      });

      const firstDayOfMonth = new Date(year, month, 1).getDay();
      const lastDateOfMonth = new Date(year, month + 1, 0).getDate();

      for (let i = 0; i < firstDayOfMonth; i++) {
        calendarGridEl.appendChild(document.createElement('div')).className = 'calendar-cell';
      }

      for (let i = 1; i <= lastDateOfMonth; i++) {
        const dateCell = document.createElement('div');
        dateCell.className = 'calendar-cell';
        dateCell.textContent = i;
        
        const today = new Date();
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = i.toString().padStart(2, '0');
        const dateString = `${y}-${m}-${d}`;

        if (today.getFullYear() === y && today.getMonth() === month && today.getDate() === i) {
          dateCell.classList.add('today');
        }

        if (authDates.includes(dateString)) {
          dateCell.classList.add('authenticated');
        }
        
        // *** 애니메이션 적용 부분 ***
        // 마지막 인증 날짜와 일치하면 애니메이션 클래스를 추가합니다.
        if (lastAuthDate === dateString) {
          dateCell.classList.add('newly-authenticated');
          // 애니메이션은 한 번만 보여주고, 저장된 마지막 인증 날짜를 삭제합니다.
          chrome.storage.sync.remove('lastAuthDate');
        }

        calendarGridEl.appendChild(dateCell);
      }
    });
  };

  prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
  });

  nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
  });

  renderCalendar(currentDate);
});
