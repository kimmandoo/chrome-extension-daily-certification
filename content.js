/**
 * 네이버 카페 익스텐션 메인 로직
 * 1. 글쓰기 페이지에서 '데일리 인증' 게시판일 때만 템플릿 불러오기 기능
 * 2. 글 등록 완료 후 인증 완료 모달 표시 기능
 *
 * @version 2.3.0
 * @description - 인증 시 날짜만이 아닌 전체 타임스탬프(ISO)를 저장하도록 변경
 * - 팝업에서 저장한 본문 템플릿을 불러와 적용하도록 수정
 * - MutationObserver를 사용하여 게시판 변경을 실시간으로 감지
 * - async/await를 사용한 비동기 로직 개선
 * - 코드 구조화 및 가독성 향상
 */

// ===================================================================================
// 유틸리티 함수 및 상수 정의
// ===================================================================================

const SELECTORS = {
  EDITOR_CONTAINER: '#SmartEditor .se-container',
  SUBMIT_BUTTON: '.WritingHeader .BaseButton--skinGreen',
  TITLE_TEXTAREA: '.FlexableTextArea .textarea_input',
  BOARD_SELECTOR_CONTAINER: '.FormSelectBox.menu_candidates_selectbox',
  BOARD_SELECTOR_BUTTON: '.FormSelectButton',
};

/**
 * Chrome Storage API를 async/await와 함께 사용하기 위한 래퍼 함수
 * @param {string | string[] | object} keys 
 * @returns {Promise<object>}
 */
const getStorageData = (keys) => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => resolve(result));
  });
};

/**
 * Chrome Storage API를 async/await와 함께 사용하기 위한 래퍼 함수
 * @param {object} items 
 * @returns {Promise<void>}
 */
const setStorageData = (items) => {
  return new Promise((resolve) => {
    chrome.storage.sync.set(items, () => resolve());
  });
};


// ===================================================================================
// 메인 로직 실행 (IIFE - 즉시 실행 함수)
// ===================================================================================

(async function main() {
  // 글쓰기 페이지('/articles/write')가 아니면 실행 중단
  if (!window.location.href.includes('/articles/write')) {
    return;
  }

  // 글쓰기 UI 요소가 렌더링될 때까지 대기
  const elements = await waitForElements([
    SELECTORS.EDITOR_CONTAINER,
    SELECTORS.SUBMIT_BUTTON,
    SELECTORS.TITLE_TEXTAREA,
    SELECTORS.BOARD_SELECTOR_CONTAINER,
    SELECTORS.BOARD_SELECTOR_BUTTON,
  ]);

  if (!elements) {
    console.error('글쓰기 에디터의 필수 요소를 찾을 수 없습니다.');
    return;
  }
  
  const { 
    [SELECTORS.EDITOR_CONTAINER]: editorContainer,
    [SELECTORS.SUBMIT_BUTTON]: submitButton,
    [SELECTORS.TITLE_TEXTAREA]: titleTextarea,
    [SELECTORS.BOARD_SELECTOR_CONTAINER]: boardContainer,
    [SELECTORS.BOARD_SELECTOR_BUTTON]: boardButton,
  } = elements;

  // 이벤트 리스너 등록
  setupEventListeners(editorContainer, submitButton, titleTextarea, boardContainer, boardButton);
})();


/**
 * 지정된 셀렉터의 모든 요소가 DOM에 나타날 때까지 기다립니다.
 * @param {string[]} selectors - 기다릴 요소의 셀렉터 배열
 * @param {number} timeout - 최대 대기 시간 (ms)
 * @returns {Promise<Object<string, HTMLElement>|null>} 셀렉터와 해당 요소를 매핑한 객체 또는 타임아웃 시 null
 */
function waitForElements(selectors, timeout = 10000) {
  return new Promise((resolve) => {
    const intervalTime = 200;
    let elapsedTime = 0;

    const interval = setInterval(() => {
      const foundElements = {};
      const allFound = selectors.every(selector => {
        const el = document.querySelector(selector);
        if (el) {
          foundElements[selector] = el;
          return true;
        }
        return false;
      });

      if (allFound) {
        clearInterval(interval);
        resolve(foundElements);
      } else {
        elapsedTime += intervalTime;
        if (elapsedTime >= timeout) {
          clearInterval(interval);
          resolve(null);
        }
      }
    }, intervalTime);
  });
}

/**
 * 글쓰기 페이지의 주요 요소들에 이벤트 리스너를 설정합니다.
 * @param {HTMLElement} editorContainer 
 * @param {HTMLElement} submitButton 
 * @param {HTMLElement} titleTextarea 
 * @param {HTMLElement} boardContainer - 게시판 선택 드롭다운 컨테이너
 * @param {HTMLElement} boardButton - 현재 선택된 게시판을 표시하는 버튼
 */
function setupEventListeners(editorContainer, submitButton, titleTextarea, boardContainer, boardButton) {
  // '등록' 버튼 클릭 리스너는 항상 활성화
  submitButton.addEventListener('click', () => handleSubmit(titleTextarea));

  /**
   * 현재 선택된 게시판을 확인하고, '데일리 인증' 게시판일 경우에만
   * 에디터에 템플릿 모달을 띄우는 클릭 리스너를 추가/제거합니다.
   */
  const checkBoardAndManageListener = () => {
    const selectedBoardName = boardButton.textContent.trim();
    
    // 이전에 추가했을 수 있는 리스너를 우선 제거하여 중복 실행 방지
    editorContainer.removeEventListener('click', handleEditorFirstClick);

    if (selectedBoardName === '데일리 인증') {
      // '데일리 인증' 게시판일 때만, 최초 1회 클릭 리스너를 추가
      editorContainer.addEventListener('click', handleEditorFirstClick, { once: true });
    }
  };

  // 1. 페이지 로드 시 최초 한 번 실행
  checkBoardAndManageListener();

  // 2. MutationObserver를 사용하여 게시판 선택 변경 감지
  const observer = new MutationObserver(() => {
    // 게시판 이름이 표시되는 버튼의 내용이 변경될 때마다 리스너 재설정
    checkBoardAndManageListener();
  });

  // boardContainer의 자식 요소나 텍스트 내용이 변경될 때 observer가 실행됨
  observer.observe(boardContainer, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/**
 * 에디터 최초 클릭 이벤트를 처리합니다. (데일리 인증 게시판에서만 호출됨)
 */
async function handleEditorFirstClick() {
  const { authCount, cafeNickname } = await getStorageData(['authCount', 'cafeNickname']);
  if (cafeNickname && authCount) {
    showTemplateModal(document, authCount, cafeNickname);
  }
}

/**
 * '등록' 버튼 클릭 이벤트를 처리합니다.
 * @param {HTMLTextAreaElement} titleTextarea 
 */
async function handleSubmit(titleTextarea) {
  const title = titleTextarea.value || '';
  
  // 제목에 인증 관련 키워드가 있는지 확인
  if (title.includes('[#') && title.includes('데일리인증')) {
    const { authCount = 0, authDates = [] } = await getStorageData(['authCount', 'authDates']);
    
    const newCount = parseInt(authCount, 10) + 1;
    const submissionTimestamp = new Date().toISOString();
    
    // 중복 저장을 방지하기 위해 Set을 사용 (실제로는 거의 발생하지 않음)
    const updatedAuthDates = new Set(authDates);
    updatedAuthDates.add(submissionTimestamp);

    // 페이지 이동 후 애니메이션을 보여주기 위한 플래그 설정
    await setStorageData({ 
      authCount: newCount, 
      authDates: Array.from(updatedAuthDates), // 다시 배열로 변환하여 저장
      lastAuthDate: submissionTimestamp, // 타임스탬프로 저장
      showAuthAnimation: true 
    });
  }
}

// ===================================================================================
// UI 관련 함수
// ===================================================================================

/**
 * 템플릿을 불러올지 묻는 확인 모달을 표시합니다.
 * @param {Document} doc - 모달을 추가할 document 객체
 * @param {number} authCount - 현재 인증 횟수
 * @param {string} nickname - 사용자 닉네임
 */
function showTemplateModal(doc, authCount, nickname) {
  // 기존 모달 제거
  const existingModal = doc.getElementById('template-loader-modal');
  if (existingModal) existingModal.remove();

  // 오버레이 생성
  const overlay = doc.createElement('div');
  overlay.id = 'template-loader-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: '2147483646',
    opacity: '0', transition: 'opacity 0.3s ease-in-out'
  });

  // 모달 컨테이너 생성
  const modal = doc.createElement('div');
  modal.id = 'template-loader-modal';
  Object.assign(modal.style, {
    position: 'fixed', top: '50%', left: '50%', padding: '28px 32px',
    backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    zIndex: '2147483647', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '18px',
    opacity: '0', transform: 'translate(-50%, -60%)', transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out'
  });

  // 메시지
  const message = doc.createElement('p');
  message.textContent = '저장된 템플릿을 불러오시겠습니까?';
  Object.assign(message.style, {
    margin: '0', fontSize: '18px', fontWeight: '600', color: '#333'
  });

  // 버튼 그룹
  const buttonWrapper = doc.createElement('div');
  Object.assign(buttonWrapper.style, {
    display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '10px'
  });

  // '불러오기' 버튼
  const loadButton = createModalButton('✅ 불러오기', '#03C75A', 'white');
  
  // '취소' 버튼
  const cancelButton = createModalButton('❌ 취소', '#f1f3f5', '#495057');
  
  // 모달 닫기 함수
  const closeModal = () => {
      overlay.style.opacity = '0';
      modal.style.opacity = '0';
      modal.style.transform = 'translate(-50%, -60%)';
      setTimeout(() => { 
        overlay.remove(); 
        modal.remove(); 
      }, 300);
  };

  // '불러오기' 버튼 클릭 이벤트 (async/await 적용)
  loadButton.addEventListener('click', async () => {
    await applyTemplate(doc, authCount, nickname); // 비동기 함수 호출 대기
    closeModal();
  });

  // 취소 및 오버레이 클릭 이벤트
  cancelButton.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  // 요소 조립
  buttonWrapper.appendChild(cancelButton);
  buttonWrapper.appendChild(loadButton);
  modal.appendChild(message);
  modal.appendChild(buttonWrapper);
  doc.body.appendChild(overlay);
  doc.body.appendChild(modal);

  // 모달 애니메이션 시작
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%)';
  });
}

/**
 * 모달에 사용될 버튼을 생성합니다.
 * @param {string} text - 버튼 텍스트
 * @param {string} bgColor - 배경색
 * @param {string} textColor - 글자색
 * @returns {HTMLButtonElement}
 */
function createModalButton(text, bgColor, textColor) {
    const button = document.createElement('button');
    button.textContent = text;
    Object.assign(button.style, {
        padding: '12px 22px', backgroundColor: bgColor, color: textColor, border: 'none',
        borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold',
        transition: 'all 0.2s ease'
    });
    
    const hoverBgColor = bgColor === '#03C75A' ? '#02b350' : '#e9ecef';
    button.onmouseover = () => { button.style.backgroundColor = hoverBgColor; button.style.transform = 'scale(1.03)'; };
    button.onmouseout = () => { button.style.backgroundColor = bgColor; button.style.transform = 'scale(1)'; };
    
    return button;
}

/**
 * 제목과 본문에 템플릿을 적용합니다. (비동기로 변경)
 * @param {Document} doc 
 * @param {number} authCount 
 * @param {string} nickname 
 */
async function applyTemplate(doc, authCount, nickname) {
  // 1. 제목 템플릿 적용 (변경 없음)
  const titleTextarea = doc.querySelector(SELECTORS.TITLE_TEXTAREA);

  const today = new Date();
  const yy = today.getFullYear().toString().slice(-2);
  const mm = (today.getMonth() + 1).toString().padStart(2, '0');
  const dd = today.getDate().toString().padStart(2, '0');
  const date = `${yy}${mm}${dd}`;

  if (titleTextarea) {
    const newTitle = `[#${authCount} ${nickname}] 데일리인증 ${date}`;
    titleTextarea.value = newTitle;
    titleTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 2. 저장된 본문 템플릿 불러와서 클립보드에 복사
  // 스토리지에서 사용자가 저장한 템플릿을 가져옵니다.
  const { bodyTemplate: userTemplate } = await getStorageData(['bodyTemplate']);
  
  // 기본 템플릿 문자열을 정의합니다.
  const defaultTemplate = '#${authCount} 번째 [${nickname}] 데일리 인증 ${date}\n - ';
  
  // 사용자가 저장한 템플릿이 있으면 그것을 사용하고, 없으면 기본 템플릿을 사용합니다.
  // .replace()를 사용해 플레이스홀더(${authCount}, ${nickname})를 실제 값으로 치환합니다.
  const finalTemplate = (userTemplate || defaultTemplate)
    .replace(/\$\{authCount\}/g, authCount)
    .replace(/\$\{date\}/g, date)
    .replace(/\$\{nickname\}/g, nickname);

  // 최종적으로 만들어진 템플릿을 클립보드에 복사하고 알림을 표시합니다.
  navigator.clipboard.writeText(finalTemplate).then(() => {
    showClipboardNotification(doc, '✅ 본문 템플릿이 복사되었습니다. <strong>Ctrl+V</strong>로 붙여넣으세요!');
  }).catch(err => {
    console.error('클립보드 복사 실패:', err);
    // 대체 수단 (구형 브라우저 호환)
    const tempTextArea = doc.createElement('textarea');
    tempTextArea.value = finalTemplate;
    doc.body.appendChild(tempTextArea);
    tempTextArea.select();
    doc.execCommand('copy');
    doc.body.removeChild(tempTextArea);
    showClipboardNotification(doc, '✅ 본문 템플릿이 복사되었습니다. <strong>Ctrl+V</strong>로 붙여넣으세요!');
  });
}

/**
 * 사용자에게 클립보드 복사 완료 알림을 띄웁니다.
 * @param {Document} doc 
 * @param {string} messageHTML - 알림에 표시될 HTML 메시지
 */
function showClipboardNotification(doc, messageHTML) {
    const notification = doc.createElement('div');
    Object.assign(notification.style, {
        position: 'fixed', bottom: '-60px', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.75)', color: 'white', padding: '12px 22px',
        borderRadius: '25px', zIndex: '2147483647', fontSize: '15px', fontWeight: 'bold',
        transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'
    });
    notification.innerHTML = messageHTML;
    doc.body.appendChild(notification);

    setTimeout(() => { notification.style.bottom = '30px'; }, 100);
    setTimeout(() => {
        notification.style.bottom = '-60px';
        setTimeout(() => { notification.remove(); }, 400);
    }, 3000);
}