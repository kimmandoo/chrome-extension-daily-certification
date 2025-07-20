/**
 * popup.html의 스크립트 로직
 * 인증 횟수, 닉네임, 본문 템플릿, 달력 기능을 관리합니다.
 * 추가된 기능: 연속 인증 스트릭 계산 및 표시
 */

document.addEventListener('DOMContentLoaded', () => {
  const countInput = document.getElementById('auth-count-input');
  const nicknameInput = document.getElementById('nickname-input');
  const templateInput = document.getElementById('template-input');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  // 스트릭 DOM 요소
  const currentStreakEl = document.getElementById('current-streak');
  const longestStreakEl = document.getElementById('longest-streak');

  chrome.storage.sync.get(['authCount', 'cafeNickname', 'bodyTemplate'], (result) => {
    if (result.authCount) {
      countInput.value = result.authCount;
    }
    if (result.cafeNickname) {
      nicknameInput.value = result.cafeNickname;
    }
    if (result.bodyTemplate) {
      templateInput.value = result.bodyTemplate;
    } else {
      templateInput.value = '#${authCount} 번째 [${nickname}] 데일리 인증 ${date}\n - ';
    }
  });

  saveBtn.addEventListener('click', () => {
    const authCount = countInput.value;
    const nickname = nicknameInput.value;
    const bodyTemplate = templateInput.value;

    chrome.storage.sync.set({
      authCount: authCount,
      cafeNickname: nickname,
      bodyTemplate: bodyTemplate
    }, () => {
      status.textContent = '✅ 저장이 완료되었습니다!';
      status.classList.add('show');
      
      setTimeout(() => {
        status.classList.remove('show');
      }, 2000);
    });
  });

  // --- 달력 및 스트릭 기능 ---
  const monthYearEl = document.getElementById('month-year');
  const calendarGridEl = document.getElementById('calendar-grid');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  
  let currentDate = new Date();

  /**
   * YYYY-MM-DD 형식의 날짜 문자열을 반환하는 함수
   * @param {Date} date 
   * @returns {string}
   */
  const toDateString = (date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  /**
   * 인증 날짜 배열을 기반으로 현재/최장 연속 인증을 계산합니다.
   * @param {string[]} authDates - YYYY-MM-DD 형식의 인증 날짜 배열
   */
  const calculateStreaks = (authDates) => {
    if (!authDates || authDates.length === 0) {
      return { current: 0, longest: 0 };
    }

    const dates = [...new Set(authDates)].map(d => new Date(d)).sort((a, b) => a - b);
    
    let longestStreak = 0;
    let currentStreak = 0;

    if (dates.length > 0) {
        longestStreak = 1;
        currentStreak = 1;
    }

    for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
            currentStreak++;
        } else {
            currentStreak = 1;
        }
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
        }
    }
    
    // 현재 스트릭이 유효한지 확인 (마지막 인증이 어제 또는 오늘인지)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastAuthDate = dates[dates.length - 1];
    const diffFromToday = (today - lastAuthDate) / (1000 * 60 * 60 * 24);

    if (diffFromToday > 1) {
        currentStreak = 0;
    }

    return { current: currentStreak, longest: longestStreak };
  };

  const renderCalendar = (date) => {
    chrome.storage.sync.get(['authDates', 'lastAuthDate'], (data) => {
      const authDates = data.authDates || [];
      const lastAuthDate = data.lastAuthDate;
      const year = date.getFullYear();
      const month = date.getMonth();

      // --- 스트릭 계산 및 표시 ---
      const streaks = calculateStreaks(authDates);
      currentStreakEl.textContent = `${streaks.current}일`;
      longestStreakEl.textContent = `${streaks.longest}일`;
      // --------------------------

      monthYearEl.textContent = `${year}년 ${month + 1}월`;
      calendarGridEl.innerHTML = '';

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
        
        const cellDate = new Date(year, month, i);
        const dateString = toDateString(cellDate);
        const todayString = toDateString(new Date());

        if (dateString === todayString) {
          dateCell.classList.add('today');
        }

        if (authDates.includes(dateString)) {
          dateCell.classList.add('authenticated');
        }
        
        if (lastAuthDate === dateString) {
          dateCell.classList.add('newly-authenticated');
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
