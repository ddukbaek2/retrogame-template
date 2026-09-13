//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 글자 입력. (터미널처럼 글을 치는 편이 씁니다, 사용자 결정, 2026-09-08 "편마다 다르게: 터미널류는 타이핑")
//
// 화면 밖에 숨긴 <input> 하나가 글을 받습니다. 한글 조합(IME)과 모바일 자판까지 브라우저가 다 해 주므로
// 키를 하나씩 모으지 않습니다. 치는 동안 명령 읽기(command.js)는 ESC 말고는 키를 명령으로 바꾸지
// 않습니다. 화면은 매 프레임 readTypedText() 로 지금 글을 읽어 제 방식대로 그립니다.
//
//   beginTyping({ onSubmit, onComplete, history })   한 줄 치기. Enter 면 onSubmit(text), Tab 이면 onComplete(text) → 새 글
//   beginTyping({ multiline: true, onSubmit })        여러 줄 치기(코드). Enter 는 줄 바꿈, Ctrl + Enter 가 onSubmit(text), Tab 은 공백 둘
//   endTyping()                                       치기 끝
//   readTypedText(), setTypedText(text)              지금 글
//   readCaretIndex()                                  글 안의 커서 자리 (여러 줄 편집기가 커서를 그릴 때)
//   isTypingActive()                                  치는 중인지
//==============================================================================


let inputElement = null;
let textareaElement = null;
let activeElement = null;
let isMultiline = false;
let isActive = false;
let submitHandler = null;
let completeHandler = null;
let historyLines = [];
let historyCursor = -1;
let draftBeforeHistory = "";
const HISTORY_LIMIT = 64;


//==============================================================================
// 숨긴 입력 칸 만들기. (한 번만)
//==============================================================================
/**
 * @param { boolean } multiline
 * @returns { HTMLElement | null }
 */
function ensureInputElement(multiline) {
	if (multiline && textareaElement !== null) {
		return textareaElement;
	}
	if (!multiline && inputElement !== null) {
		return inputElement;
	}
	const document = System.document;
	if (document === null || document === undefined) {
		return null;
	}
	const element = document.createElement(multiline ? "textarea" : "input");
	if (!multiline) {
		element.type = "text";
	}
	element.setAttribute("autocomplete", "off");
	element.setAttribute("autocapitalize", "off");
	element.setAttribute("autocorrect", "off");
	element.setAttribute("spellcheck", "false");
	element.setAttribute("aria-hidden", "true");
	element.style.position = "fixed";
	element.style.left = "-9999px";
	element.style.top = "0";
	element.style.width = "1px";
	element.style.height = "1px";
	element.style.opacity = "0";
	element.style.border = "0";
	element.style.padding = "0";
	element.tabIndex = -1;
	document.body.appendChild(element);
	element.addEventListener("keydown", (keyboardEvent) => {
		handleTypingKey(keyboardEvent);
	});
	// 치는 동안 자판이 다른 데로 가면 다음 키에서 되찾습니다.
	document.addEventListener("keydown", () => {
		if (isActive && activeElement !== null && document.activeElement !== activeElement) {
			activeElement.focus();
		}
	});
	if (multiline) {
		textareaElement = element;
	}
	else {
		inputElement = element;
	}
	return element;
}


//==============================================================================
// 여러 줄 치기의 특수 키. (Ctrl + Enter 보냄, Tab 은 공백 둘), 줄 바꿈, 커서 이동은 브라우저가 합니다.
//==============================================================================
/**
 * @param { KeyboardEvent } keyboardEvent
 */
function handleMultilineKey(keyboardEvent) {
	if (keyboardEvent.key === "Enter" && (keyboardEvent.ctrlKey || keyboardEvent.metaKey)) {
		keyboardEvent.preventDefault();
		if (submitHandler !== null) {
			submitHandler(activeElement.value);
		}
		return;
	}
	if (keyboardEvent.key === "Tab") {
		keyboardEvent.preventDefault();
		const element = activeElement;
		const start = element.selectionStart;
		const end = element.selectionEnd;
		element.value = element.value.slice(0, start) + "  " + element.value.slice(end);
		element.selectionStart = start + 2;
		element.selectionEnd = start + 2;
	}
}


//==============================================================================
// 치는 중의 특수 키. (Enter 보냄, Tab 채우기, 상하 이력), 나머지는 브라우저가 글로 만듭니다.
//==============================================================================
/**
 * @param { KeyboardEvent } keyboardEvent
 */
function handleTypingKey(keyboardEvent) {
	if (!isActive || activeElement === null) {
		return;
	}
	if (keyboardEvent.isComposing) {
		return;
	}
	if (isMultiline) {
		handleMultilineKey(keyboardEvent);
		return;
	}
	if (keyboardEvent.key === "Enter") {
		keyboardEvent.preventDefault();
		const text = activeElement.value;
		activeElement.value = "";
		historyCursor = -1;
		draftBeforeHistory = "";
		if (text.trim() !== "") {
			historyLines.push(text);
			if (historyLines.length > HISTORY_LIMIT) {
				historyLines.shift();
			}
		}
		if (submitHandler !== null) {
			submitHandler(text);
		}
		return;
	}
	if (keyboardEvent.key === "Tab") {
		keyboardEvent.preventDefault();
		if (completeHandler !== null) {
			const completed = completeHandler(activeElement.value);
			if (typeof completed === "string") {
				activeElement.value = completed;
			}
		}
		return;
	}
	if (keyboardEvent.key === "ArrowUp" || keyboardEvent.key === "ArrowDown") {
		keyboardEvent.preventDefault();
		if (historyLines.length === 0) {
			return;
		}
		if (historyCursor === -1) {
			draftBeforeHistory = activeElement.value;
			historyCursor = historyLines.length;
		}
		historyCursor += keyboardEvent.key === "ArrowUp" ? -1 : 1;
		if (historyCursor < 0) {
			historyCursor = 0;
		}
		if (historyCursor >= historyLines.length) {
			historyCursor = -1;
			activeElement.value = draftBeforeHistory;
			return;
		}
		activeElement.value = historyLines[historyCursor];
		return;
	}
	if (keyboardEvent.key === "Escape") {
		// ESC 는 명령 읽기가 메뉴로 씁니다. 여기서는 손대지 않습니다.
		return;
	}
}


//==============================================================================
// 치기 시작.
//==============================================================================
/**
 * @param { object } options { onSubmit(text), onComplete(text) → string, history: string[] }
 */
export function beginTyping(options) {
	isMultiline = options !== undefined && options.multiline === true;
	const element = ensureInputElement(isMultiline);
	if (element === null) {
		return;
	}
	activeElement = element;
	isActive = true;
	submitHandler = options !== undefined && options.onSubmit !== undefined ? options.onSubmit : null;
	completeHandler = options !== undefined && options.onComplete !== undefined ? options.onComplete : null;
	historyLines = options !== undefined && options.history !== undefined ? options.history.slice() : [];
	historyCursor = -1;
	draftBeforeHistory = "";
	element.value = options !== undefined && typeof options.initialText === "string" ? options.initialText : "";
	element.focus();
	if (isMultiline) {
		element.selectionStart = element.value.length;
		element.selectionEnd = element.value.length;
	}
}


//==============================================================================
// 치기 끝.
//==============================================================================
export function endTyping() {
	isActive = false;
	submitHandler = null;
	completeHandler = null;
	if (activeElement !== null) {
		activeElement.value = "";
		activeElement.blur();
	}
	activeElement = null;
}


//==============================================================================
// 자판 다시 부르기. (손가락으로 화면을 대면 모바일 자판이 열리게, 사용자 입력 안에서만 됩니다)
//==============================================================================
export function focusTypingElement() {
	if (!isActive || activeElement === null) {
		return;
	}
	activeElement.focus();
}


/** @returns { boolean } */
export function isTypingActive() {
	return isActive;
}


/** @returns { string } */
export function readTypedText() {
	if (!isActive || activeElement === null) {
		return "";
	}
	return activeElement.value;
}


/** @returns { number } 글 안의 커서 자리. (치는 중이 아니면 0) */
export function readCaretIndex() {
	if (!isActive || activeElement === null) {
		return 0;
	}
	return activeElement.selectionStart;
}


/**
 * @param { string } text
 */
export function setTypedText(text) {
	if (activeElement === null) {
		return;
	}
	activeElement.value = text;
}


/** @returns { string[] } 보낸 글의 이력. (오래된 것부터) */
export function readTypingHistory() {
	return historyLines.slice();
}
