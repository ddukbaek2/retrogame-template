//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Command } from "./command.js";
import { noteInputSource, InputSource } from "./inputsource.js";


//==============================================================================
// 가상 게임패드. (손가락으로 노는 기기에서만 모니터 아래에 섭니다)
//
// 모바일에서는 화면을 문질러 노는 것이 어렵습니다. 그래서 모니터와 아주 별개로, 화면 아래에
// 실제 패드처럼 생긴 것을 하나 둡니다. (사용자 지시, 2026-09-13, "모바일 앱만 게임 화면과 별개로
// 모니터 아래에 가상 키패드가 있는 거야", "방향키와 AB 정도", "가운데는 셀렉트 스타트도 넣는 게 좋겠고")
//
// A 가 왼쪽이고 B 가 오른쪽입니다. (사용자 지시) A 는 확인, B 는 취소입니다.
// 셀렉트와 스타트는 자리만 있고 아직 하는 일이 없습니다. (사용자 지시, "일단 기능은 없는 걸로")
//
// 게임 화면 밖의 것입니다. 모니터 그림과 같은 플라스틱 결로,
// 그라데이션 없이 네모와 선만으로 그립니다.
//==============================================================================


// 패드가 설 자리의 높이. (창 높이에 견준 몫, 최소와 최대는 픽셀)
const PAD_HEIGHT_RATIO = 0.34;
const PAD_MINIMUM_HEIGHT = 200;
const PAD_MAXIMUM_HEIGHT = 420;

// 플라스틱과 단추의 색. (모니터 그림과 같은 분위기입니다)
const PLASTIC_COLOR = "#c8c4ac";
const PLASTIC_SHADOW_COLOR = "#8d8a78";
const PLASTIC_LIGHT_COLOR = "#e4e0c8";
const KEY_COLOR = "#3b3a36";
const KEY_PRESSED_COLOR = "#6b6a62";
const KEY_EDGE_COLOR = "#22211e";

// 단추 하나의 됨됨이.
let padCanvas = null;
let padContext = null;
let padButtons = [];
let commandReader = null;
let padPlacement = { left: 0, top: 0, width: 0, height: 0 };
let crossCenterRect = { left: 0, top: 0, width: 0, height: 0 };
let pressedPointers = new Map();
let isPadEnabled = false;


//==============================================================================
// 손가락으로 노는 기기인지. (마우스가 없는 기기에만 패드를 둡니다)
//==============================================================================
/**
 * @returns { boolean }
 */
export function isTouchDevice() {
	const windowObject = System.window;
	if (windowObject === undefined || windowObject === null) {
		return false;
	}
	if (windowObject.matchMedia === undefined) {
		return false;
	}
	const coarseQuery = windowObject.matchMedia("(pointer: coarse)");
	const noHoverQuery = windowObject.matchMedia("(hover: none)");
	return coarseQuery.matches && noHoverQuery.matches;
}


//==============================================================================
// 패드가 먹는 높이. (화면 모드가 모니터 자리를 잡을 때 이만큼 비워 둡니다)
//==============================================================================
/**
 * @param { number } windowHeight
 * @returns { number }
 */
export function readVirtualPadHeight(windowHeight) {
	if (!isPadEnabled) {
		return 0;
	}
	const wanted = System.Math.round(windowHeight * PAD_HEIGHT_RATIO);
	return System.Math.max(PAD_MINIMUM_HEIGHT, System.Math.min(PAD_MAXIMUM_HEIGHT, wanted));
}


//==============================================================================
// 패드 만들기. (손가락 기기가 아니면 아무것도 만들지 않습니다)
//==============================================================================
/**
 * @param { object } reader CommandReader.
 * @returns { boolean } 세웠으면 true.
 */
export function attachVirtualPad(reader) {
	if (!isTouchDevice()) {
		return false;
	}
	const document = System.document;
	if (document === undefined || document === null) {
		return false;
	}
	commandReader = reader;
	padCanvas = document.createElement("canvas");
	padCanvas.id = "virtualPadCanvas";
	padCanvas.style.position = "absolute";
	padCanvas.style.left = "0px";
	padCanvas.style.bottom = "0px";
	padCanvas.style.zIndex = "20";
	padCanvas.style.touchAction = "none";
	padCanvas.style.userSelect = "none";
	document.body.appendChild(padCanvas);
	padContext = padCanvas.getContext("2d");
	isPadEnabled = true;
	installPadEvents();
	return true;
}


//==============================================================================
// 손가락 받기.
//==============================================================================
function installPadEvents() {
	padCanvas.addEventListener("pointerdown", (pointerEvent) => {
		pointerEvent.preventDefault();
		noteInputSource(InputSource.touch);
		padCanvas.setPointerCapture(pointerEvent.pointerId);
		const button = findButtonAt(pointerEvent.offsetX, pointerEvent.offsetY);
		if (button === null) {
			return;
		}
		pressedPointers.set(pointerEvent.pointerId, button.id);
		pressButton(button);
		drawVirtualPad();
	});
	padCanvas.addEventListener("pointermove", (pointerEvent) => {
		if (!pressedPointers.has(pointerEvent.pointerId)) {
			return;
		}
		const button = findButtonAt(pointerEvent.offsetX, pointerEvent.offsetY);
		const heldId = pressedPointers.get(pointerEvent.pointerId);
		const nextId = button === null ? "" : button.id;
		if (nextId === heldId) {
			return;
		}
		// 손가락이 다른 단추로 미끄러지면 앞엣것을 떼고 뒤엣것을 누릅니다.
		const previous = findButtonById(heldId);
		if (previous !== null) {
			releaseButton(previous);
		}
		if (button === null) {
			pressedPointers.delete(pointerEvent.pointerId);
		}
		else {
			pressedPointers.set(pointerEvent.pointerId, button.id);
			pressButton(button);
		}
		drawVirtualPad();
	});
	const endHandler = (pointerEvent) => {
		if (!pressedPointers.has(pointerEvent.pointerId)) {
			return;
		}
		const heldId = pressedPointers.get(pointerEvent.pointerId);
		const button = findButtonById(heldId);
		if (button !== null) {
			releaseButton(button);
		}
		pressedPointers.delete(pointerEvent.pointerId);
		drawVirtualPad();
	};
	padCanvas.addEventListener("pointerup", endHandler);
	padCanvas.addEventListener("pointercancel", endHandler);
	padCanvas.addEventListener("contextmenu", (mouseEvent) => {
		mouseEvent.preventDefault();
	});
}


//==============================================================================
// 단추 누름과 뗌.
//==============================================================================
/**
 * @param { object } button
 */
function pressButton(button) {
	button.isPressed = true;
	if (button.command === "" || commandReader === null) {
		return;
	}
	commandReader.setPadHeld(button.command, true);
	commandReader.press(button.command);
}


/**
 * @param { object } button
 */
function releaseButton(button) {
	button.isPressed = false;
	if (button.command === "" || commandReader === null) {
		return;
	}
	commandReader.setPadHeld(button.command, false);
	commandReader.release(button.command);
}


//==============================================================================
// 그 자리의 단추 찾기.
//==============================================================================
/**
 * @param { number } x
 * @param { number } y
 * @returns { object | null }
 */
function findButtonAt(x, y) {
	for (const button of padButtons) {
		if (x >= button.left && x < button.left + button.width && y >= button.top && y < button.top + button.height) {
			return button;
		}
	}
	return null;
}


/**
 * @param { string } buttonId
 * @returns { object | null }
 */
function findButtonById(buttonId) {
	for (const button of padButtons) {
		if (button.id === buttonId) {
			return button;
		}
	}
	return null;
}


//==============================================================================
// 자리 잡기. (화면 모드가 모니터를 놓은 뒤 남은 아래 칸을 받습니다)
//==============================================================================
/**
 * @param { number } left CSS px.
 * @param { number } top
 * @param { number } width
 * @param { number } height
 */
export function setVirtualPadPlacement(left, top, width, height) {
	if (!isPadEnabled) {
		return;
	}
	padPlacement = { left: left, top: top, width: width, height: height };
	const ratio = System.window.devicePixelRatio === undefined ? 1 : System.window.devicePixelRatio;
	padCanvas.style.left = left + "px";
	padCanvas.style.top = top + "px";
	padCanvas.style.bottom = "auto";
	padCanvas.style.width = width + "px";
	padCanvas.style.height = height + "px";
	padCanvas.width = System.Math.round(width * ratio);
	padCanvas.height = System.Math.round(height * ratio);
	padContext.setTransform(ratio, 0, 0, ratio, 0, 0);
	layoutButtons();
	drawVirtualPad();
}


//==============================================================================
// 단추 자리 재기. (왼쪽에 십자, 오른쪽에 A 와 B, 가운데 아래에 셀렉트와 스타트)
//==============================================================================
function layoutButtons() {
	const width = padPlacement.width;
	const height = padPlacement.height;
	const margin = System.Math.round(System.Math.min(width, height) * 0.06);
	// 십자키. 한 칸의 크기를 높이에서 잽니다.
	const crossCell = System.Math.round(System.Math.min(height * 0.24, width * 0.11));
	const crossCenterX = margin + crossCell * 2;
	const crossCenterY = System.Math.round(height * 0.44);
	// 단추 두 개. 지름은 십자 한 칸보다 조금 큽니다.
	const faceSize = System.Math.round(crossCell * 1.25);
	const faceGap = System.Math.round(faceSize * 0.5);
	const faceRightX = width - margin - faceSize;
	const faceCenterY = crossCenterY;
	// 가운데 두 개.
	const smallWidth = System.Math.round(System.Math.min(width * 0.13, crossCell * 1.6));
	const smallHeight = System.Math.round(crossCell * 0.42);
	const smallGap = System.Math.round(smallWidth * 0.28);
	const smallCenterX = System.Math.round(width * 0.5);
	const smallTop = System.Math.round(height * 0.72);

	crossCenterRect = {
		left: crossCenterX - System.Math.round(crossCell * 0.5),
		top: crossCenterY - System.Math.round(crossCell * 0.5),
		width: crossCell,
		height: crossCell,
	};
	padButtons = [
		{ id: "up", command: Command.up, shape: "cross", label: "",
			left: crossCenterX - System.Math.round(crossCell * 0.5), top: crossCenterY - System.Math.round(crossCell * 1.5),
			width: crossCell, height: crossCell, isPressed: false },
		{ id: "down", command: Command.down, shape: "cross", label: "",
			left: crossCenterX - System.Math.round(crossCell * 0.5), top: crossCenterY + System.Math.round(crossCell * 0.5),
			width: crossCell, height: crossCell, isPressed: false },
		{ id: "left", command: Command.left, shape: "cross", label: "",
			left: crossCenterX - System.Math.round(crossCell * 1.5), top: crossCenterY - System.Math.round(crossCell * 0.5),
			width: crossCell, height: crossCell, isPressed: false },
		{ id: "right", command: Command.right, shape: "cross", label: "",
			left: crossCenterX + System.Math.round(crossCell * 0.5), top: crossCenterY - System.Math.round(crossCell * 0.5),
			width: crossCell, height: crossCell, isPressed: false },
		// A 가 왼쪽, B 가 오른쪽입니다. (사용자 지시, 2026-09-13)
		{ id: "a", command: Command.confirm, shape: "face", label: "A",
			left: faceRightX - faceSize - faceGap, top: faceCenterY - System.Math.round(faceSize * 0.5),
			width: faceSize, height: faceSize, isPressed: false },
		{ id: "b", command: Command.cancel, shape: "face", label: "B",
			left: faceRightX, top: faceCenterY - System.Math.round(faceSize * 0.5),
			width: faceSize, height: faceSize, isPressed: false },
		// 셀렉트와 스타트는 아직 하는 일이 없습니다.
		{ id: "select", command: "", shape: "small", label: "SELECT",
			left: smallCenterX - smallWidth - System.Math.round(smallGap * 0.5), top: smallTop,
			width: smallWidth, height: smallHeight, isPressed: false },
		{ id: "start", command: "", shape: "small", label: "START",
			left: smallCenterX + System.Math.round(smallGap * 0.5), top: smallTop,
			width: smallWidth, height: smallHeight, isPressed: false },
	];
}


//==============================================================================
// 그리기. (그라데이션 없이 네모와 선만 씁니다)
//==============================================================================
export function drawVirtualPad() {
	if (!isPadEnabled || padContext === null) {
		return;
	}
	const width = padPlacement.width;
	const height = padPlacement.height;
	padContext.fillStyle = PLASTIC_COLOR;
	padContext.fillRect(0, 0, width, height);
	// 위쪽에 한 줄 그어 모니터와 나눕니다.
	padContext.fillStyle = PLASTIC_SHADOW_COLOR;
	padContext.fillRect(0, 0, width, 3);
	padContext.fillStyle = PLASTIC_LIGHT_COLOR;
	padContext.fillRect(0, 3, width, 2);

	// 십자의 한가운데를 메워 네 갈래가 한 덩이로 보이게 합니다.
	if (crossCenterRect.width > 0) {
		padContext.fillStyle = KEY_COLOR;
		padContext.fillRect(crossCenterRect.left, crossCenterRect.top, crossCenterRect.width, crossCenterRect.height);
	}
	for (const button of padButtons) {
		drawButton(button);
	}
}


/**
 * @param { object } button
 */
function drawButton(button) {
	const edge = 3;
	padContext.fillStyle = KEY_EDGE_COLOR;
	padContext.fillRect(button.left - edge, button.top - edge, button.width + edge * 2, button.height + edge * 2);
	padContext.fillStyle = button.isPressed ? KEY_PRESSED_COLOR : KEY_COLOR;
	padContext.fillRect(button.left, button.top, button.width, button.height);
	if (button.shape === "cross") {
		drawArrow(button);
		return;
	}
	if (button.label === "") {
		return;
	}
	const fontSize = button.shape === "face" ? System.Math.round(button.height * 0.42) : System.Math.round(button.height * 0.6);
	padContext.fillStyle = PLASTIC_COLOR;
	padContext.font = "700 " + fontSize + "px monospace";
	padContext.textAlign = "center";
	padContext.textBaseline = "middle";
	padContext.fillText(button.label, button.left + button.width * 0.5, button.top + button.height * 0.5 + 1);
}


//==============================================================================
// 십자키의 화살표. (세모를 네모 알갱이로 쌓아 도트처럼 보이게 합니다)
//==============================================================================
/**
 * @param { object } button
 */
function drawArrow(button) {
	const centerX = button.left + button.width * 0.5;
	const centerY = button.top + button.height * 0.5;
	const unit = System.Math.max(2, System.Math.round(button.width * 0.09));
	const steps = 4;
	const half = steps * unit * 0.5;
	padContext.fillStyle = PLASTIC_COLOR;
	for (let step = 0; step < steps; step += 1) {
		// 꼭짓점 쪽이 좁고 밑동으로 갈수록 넓어집니다.
		const spread = (step + 1) * unit;
		if (button.id === "up") {
			padContext.fillRect(System.Math.round(centerX - spread), System.Math.round(centerY - half + step * unit), spread * 2, unit);
		}
		else if (button.id === "down") {
			padContext.fillRect(System.Math.round(centerX - spread), System.Math.round(centerY + half - (step + 1) * unit), spread * 2, unit);
		}
		else if (button.id === "left") {
			padContext.fillRect(System.Math.round(centerX - half + step * unit), System.Math.round(centerY - spread), unit, spread * 2);
		}
		else {
			padContext.fillRect(System.Math.round(centerX + half - (step + 1) * unit), System.Math.round(centerY - spread), unit, spread * 2);
		}
	}
}
