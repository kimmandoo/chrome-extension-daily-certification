/**
 * popup.html의 스크립트 로직
 * 인증 횟수, 닉네임, 본문 템플릿, 달력 기능을 관리합니다.
 * @version 2.5.0
 * @description - '오늘' 날짜 표시에 유효시간이 적용되던 버그 수정
 * - '오늘' 마커는 실제 날짜를 기준으로, 인증 기록은 유효시간을 기준으로 계산하도록 분리
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 캐싱
  const countInput = document.getElementById('auth-count-input');
  const nicknameInput = document.getElementById('nickname-input');
  const templateInput = document.getElementById('template-input');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  // 유효시간 관련 DOM 요소
  const cutoffHourInput = document.getElementById('cutoff-hour-input');
  const cutoffChangeInfo = document.getElementById('cutoff-change-info');
  const saveCutoffBtn = document.getElementById('save-cutoff-btn');

  // 스트릭 및 달력 관련 DOM 요소
  const currentStreakEl = document.getElementById('current-streak');
  const longestStreakEl = document.getElementById('longest-streak');
  const monthYearEl = document.getElementById('month-year');
  const calendarGridEl = document.getElementById('calendar-grid');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');

  let currentDate = new Date();

  // 초기 데이터 로드 및 UI 설정
  const loadInitialData = async () => {
    const result = await chrome.storage.sync.get([
      'authCount', 'cafeNickname', 'bodyTemplate',
      'authCutoffHour', 'lastCutoffChangeDate'
    ]);

    countInput.value = result.authCount || '';
    nicknameInput.value = result.cafeNickname || '';
    templateInput.value = result.bodyTemplate || '#${authCount} 번째 [${nickname}] 데일리 인증 ${date}\n - ';
    cutoffHourInput.value = result.authCutoffHour !== undefined ? result.authCutoffHour : 2;

    updateCutoffSettingUI(result.lastCutoffChangeDate);
    renderCalendar(currentDate);
  };

  // 상태 메시지 표시 함수
  const showStatusMessage = (message, type = 'success', duration = 2500) => {
    status.textContent = message;
    status.className = `show ${type}`;
    setTimeout(() => {
      status.classList.remove('show');
    }, duration);
  };

  // 일반 설정 저장 버튼 이벤트 리스너
  saveBtn.addEventListener('click', async () => {
    await chrome.storage.sync.set({
      authCount: countInput.value,
      cafeNickname: nicknameInput.value,
      bodyTemplate: templateInput.value,
    });
    showStatusMessage('✅ 설정이 저장되었습니다.');
  });

  // 유효시간 저장 버튼 이벤트 리스너
  saveCutoffBtn.addEventListener('click', async () => {
    const { lastCutoffChangeDate } = await chrome.storage.sync.get('lastCutoffChangeDate');
    const now = new Date();

    if (lastCutoffChangeDate) {
      const lastChange = new Date(lastCutoffChangeDate);
      const daysSinceChange = (now - lastChange) / (1000 * 60 * 60 * 24);
      if (daysSinceChange < 7) {
        showStatusMessage(`❌ 유효시간은 7일마다 변경할 수 있습니다.`, 'error');
        return;
      }
    }

    const newCutoffHour = parseInt(cutoffHourInput.value, 10);
    if (isNaN(newCutoffHour) || newCutoffHour < 0 || newCutoffHour > 6) {
      showStatusMessage(`❌ 유효시간은 0~6 사이의 숫자로 입력해주세요.`, 'error');
      return;
    }

    const newChangeDate = now.toISOString();
    await chrome.storage.sync.set({
      authCutoffHour: newCutoffHour,
      lastCutoffChangeDate: newChangeDate
    });

    showStatusMessage('✅ 유효시간이 저장되었습니다. 7일간 변경할 수 없습니다.');
    updateCutoffSettingUI(newChangeDate);
    renderCalendar(currentDate); // 유효시간 변경 시 달력 즉시 갱신
  });

  // 유효시간 설정 UI 업데이트 함수
  const updateCutoffSettingUI = (lastCutoffChangeDate) => {
    if (!lastCutoffChangeDate) {
      cutoffHourInput.disabled = false;
      saveCutoffBtn.disabled = false;
      cutoffChangeInfo.textContent = '';
      return;
    }

    const lastChange = new Date(lastCutoffChangeDate);
    const now = new Date();
    const daysSinceChange = (now - lastChange) / (1000 * 60 * 60 * 24);

    if (daysSinceChange < 7) {
      cutoffHourInput.disabled = true;
      saveCutoffBtn.disabled = true;
      const nextChangeDate = new Date(lastChange);
      nextChangeDate.setDate(lastChange.getDate() + 7);
      cutoffChangeInfo.textContent = `다음 변경 가능일: ${nextChangeDate.getFullYear()}년 ${nextChangeDate.getMonth() + 1}월 ${nextChangeDate.getDate()}일`;
    } else {
      cutoffHourInput.disabled = false;
      saveCutoffBtn.disabled = false;
      cutoffChangeInfo.textContent = '';
    }
  };

  // 인증의 "실제 날짜"를 계산하는 함수 (유효시간 반영)
  const getEffectiveDate = (date, cutoffHour) => {
    const d = new Date(date);
    if (d.getHours() < cutoffHour) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  };

  // Date 객체를 'YYYY-MM-DD' 형식의 문자열로 변환
  const toDateString = (date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  // 연속 인증일 계산
  const calculateStreaks = (authTimestamps, cutoffHour) => {
    if (!authTimestamps || authTimestamps.length === 0) {
      return { current: 0, longest: 0 };
    }

    const effectiveDateStrings = [...new Set(authTimestamps.map(ts => toDateString(getEffectiveDate(new Date(ts), cutoffHour))))];
    const dates = effectiveDateStrings.map(d => new Date(d)).sort((a, b) => a - b);

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
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    // 현재 스트릭 계산 시에는 유효시간을 반영한 '오늘'을 기준으로 함
    const todayEffective = getEffectiveDate(new Date(), cutoffHour);
    const lastAuthDate = dates[dates.length - 1];
    
    if (!lastAuthDate) { // 인증 기록이 전혀 없을 경우
        return { current: 0, longest: longestStreak };
    }

    const diffFromToday = (todayEffective - lastAuthDate) / (1000 * 60 * 60 * 24);

    if (diffFromToday > 1) {
      currentStreak = 0;
    }

    return { current: currentStreak, longest: longestStreak };
  };

  // 달력 렌더링
  const renderCalendar = async (dateToDisplay) => {
    const data = await chrome.storage.sync.get(['authDates', 'lastAuthDate', 'authCutoffHour']);
    const authTimestamps = data.authDates || [];
    const lastAuthTimestamp = data.lastAuthDate;
    const cutoffHour = data.authCutoffHour !== undefined ? data.authCutoffHour : 2;

    const streaks = calculateStreaks(authTimestamps, cutoffHour);
    currentStreakEl.textContent = `${streaks.current}일`;
    longestStreakEl.textContent = `${streaks.longest}일`;

    const effectiveAuthDateStrings = new Set(authTimestamps.map(ts => toDateString(getEffectiveDate(new Date(ts), cutoffHour))));

    const year = dateToDisplay.getFullYear();
    const month = dateToDisplay.getMonth();
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

    // ======================================================================
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ BUG FIX ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // '오늘' 표시는 실제 날짜를 기준으로 하고, 유효시간 설정과 분리합니다.
    const actualTodayString = toDateString(new Date());
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ BUG FIX ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    // ======================================================================
    
    const lastAuthEffectiveDateString = lastAuthTimestamp ? toDateString(getEffectiveDate(new Date(lastAuthTimestamp), cutoffHour)) : null;

    for (let i = 1; i <= lastDateOfMonth; i++) {
      const dateCell = document.createElement('div');
      dateCell.className = 'calendar-cell';
      dateCell.textContent = i;

      const cellDateString = toDateString(new Date(year, month, i));

      // '오늘' 날짜 표시는 실제 오늘 날짜(actualTodayString)를 기준으로 합니다.
      if (cellDateString === actualTodayString) {
        dateCell.classList.add('today');
      }

      // 인증 기록 표시는 유효시간이 적용된 날짜(effectiveAuthDateStrings)를 기준으로 합니다.
      if (effectiveAuthDateStrings.has(cellDateString)) {
        dateCell.classList.add('authenticated');
      }
      
      if (lastAuthEffectiveDateString === cellDateString) {
        dateCell.classList.add('newly-authenticated');
        chrome.storage.sync.remove('lastAuthDate'); // Flash animation is for one-time view
      }
      calendarGridEl.appendChild(dateCell);
    }
  };

  // 이전/다음 달 버튼 이벤트 리스너
  prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
  });

  nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
  });

  // 초기화 함수 호출
  loadInitialData();
});