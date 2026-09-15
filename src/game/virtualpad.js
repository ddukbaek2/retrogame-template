//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Command } from "./command.js";
import { noteInputSource, InputSource } from "./inputsource.js";


//==============================================================================
// 가상 게임패드. (손가락으로 노는 기기에서만 섭니다)
//
// 모바일에서는 화면을 문질러 노는 것이 어렵습니다. 그래서 모니터와 아주 별개로, 화면 아래에
// 실제 패드처럼 생긴 것을 하나 둡니다. (사용자 지시, 2026-09-13, "모바일 앱만 게임 화면과 별개로
// 모니터 아래에 가상 키패드가 있는 거야", "방향키와 AB 정도", "가운데는 셀렉트 스타트도 넣는 게 좋겠고")
//
// 모드가 둘입니다. (사용자 지시, 2026-09-15, "폰이 세로모드일때만 나오는거고 가로모드일때는
// 좌우로 분리해서 가상키패드가 나와줬으면해", "가로일때는 좌우분리형으로 세로일때는 하나로")
//   - 세로(bottom): 모니터 아래에 한 덩이. 왼쪽 십자, 오른쪽 A 와 B, 가운데 아래 셀렉트와 스타트.
//   - 가로(sides): 좌우 기둥 둘. 왼쪽 기둥에 십자와 셀렉트, 오른쪽 기둥에 A 와 B 와 스타트.
//     기둥은 게임 화면 양옆이라 캔버스도 둘입니다. 한 장으로 창을 덮으면 게임의 터치를 가로챕니다.
//
// A 가 왼쪽이고 B 가 오른쪽입니다. (사용자 지시) A 는 확인, B 는 취소입니다.
// 셀렉트는 지도, 스타트는 메뉴입니다. 키보드의 Shift 와 Enter 와 같습니다. (사용자 지시, 2026-09-15)
//
// 게임 화면 밖의 것입니다. 모니터 그림과 같은 플라스틱 결로,
// 그라데이션 없이 네모와 선만으로 그립니다.
//==============================================================================


// 세로 모드에서 패드가 설 자리의 높이. (창 높이에 견준 몫, 최소와 최대는 픽셀)
const PAD_HEIGHT_RATIO = 0.34;
const PAD_MINIMUM_HEIGHT = 200;
const PAD_MAXIMUM_HEIGHT = 420;
// 가로 모드에서 기둥 하나의 너비. (창 너비에 견준 몫, 최소와 최대는 픽셀)
const PAD_SIDE_RATIO = 0.2;
const PAD_MINIMUM_SIDE = 150;
const PAD_MAXIMUM_SIDE = 320;

// 플라스틱과 단추의 색. (모니터 그림과 같은 분위기입니다)
const PLASTIC_COLOR = "#c8c4ac";
const PLASTIC_SHADOW_COLOR = "#8d8a78";
const PLASTIC_LIGHT_COLOR = "#e4e0c8";
const KEY_COLOR = "#3b3a36";
const KEY_PRESSED_COLOR = "#6b6a62";
const KEY_EDGE_COLOR = "#22211e";

// 패드의 됨됨이. 단추의 자리는 창 좌표(CSS px)입니다. 어느 캔버스에 걸치든 같은 자로 잽니다.
let padPanels = [];
let padButtons = [];
let commandReader = null;
let padMode = "bottom";
let padRects = [];
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
// 패드가 먹는 자리. (화면 모드가 모니터 자리를 잡을 때 이만큼 비워 둡니다)
//
// 창이 세로로 길면 아래를 비우고, 가로로 길면 양옆을 비웁니다.
//==============================================================================
/**
 * @param { number } windowWidth
 * @param { number } windowHeight
 * @returns { object } { bottom, side } 세로 모드면 bottom 만, 가로 모드면 side 만 0 보다 큽니다.
 */
export function readVirtualPadReserve(windowWidth, windowHeight) {
	if (!isPadEnabled) {
		return { bottom: 0, side: 0 };
	}
	if (windowWidth > windowHeight) {
		const wantedSide = System.Math.round(windowWidth * PAD_SIDE_RATIO);
		const side = System.Math.max(PAD_MINIMUM_SIDE, System.Math.min(PAD_MAXIMUM_SIDE, wantedSide));
		return { bottom: 0, side: side };
	}
	const wantedBottom = System.Math.round(windowHeight * PAD_HEIGHT_RATIO);
	const bottom = System.Math.max(PAD_MINIMUM_HEIGHT, System.Math.min(PAD_MAXIMUM_HEIGHT, wantedBottom));
	return { bottom: bottom, side: 0 };
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
	isPadEnabled = true;
	return true;
}


//==============================================================================
// 캔버스 한 장 만들기. (세로면 한 장, 가로면 두 장입니다)
//==============================================================================
/**
 * @param { number } panelIndex
 * @returns { object } { canvas, context, rect }
 */
function createPanel(panelIndex) {
	const document = System.document;
	const canvas = document.createElement("canvas");
	canvas.id = panelIndex === 0 ? "virtualPadCanvas" : "virtualPadCanvas" + panelIndex;
	canvas.style.position = "absolute";
	canvas.style.left = "0px";
	canvas.style.top = "0px";
	canvas.style.zIndex = "20";
	canvas.style.touchAction = "none";
	canvas.style.userSelect = "none";
	document.body.appendChild(canvas);
	const panel = { canvas: canvas, context: canvas.getContext("2d"), rect: { left: 0, top: 0, width: 0, height: 0 } };
	installPanelEvents(panel);
	return panel;
}


//==============================================================================
// 손가락 받기. (캔버스마다 붙입니다. 자리는 창 좌표로 바꿔 셉니다)
//==============================================================================
/**
 * @param { object } panel
 */
function installPanelEvents(panel) {
	const canvas = panel.canvas;
	canvas.addEventListener("pointerdown", (pointerEvent) => {
		pointerEvent.preventDefault();
		noteInputSource(InputSource.touch);
		canvas.setPointerCapture(pointerEvent.pointerId);
		const button = findButtonAt(panel.rect.left + pointerEvent.offsetX, panel.rect.top + pointerEvent.offsetY);
		if (button === null) {
			return;
		}
		pressedPointers.set(pointerEvent.pointerId, button.id);
		pressButton(button);
		drawVirtualPad();
	});
	canvas.addEventListener("pointermove", (pointerEvent) => {
		if (!pressedPointers.has(pointerEvent.pointerId)) {
			return;
		}
		const button = findButtonAt(panel.rect.left + pointerEvent.offsetX, panel.rect.top + pointerEvent.offsetY);
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
	canvas.addEventListener("pointerup", endHandler);
	canvas.addEventListener("pointercancel", endHandler);
	canvas.addEventListener("contextmenu", (mouseEvent) => {
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
// 그 자리의 단추 찾기. (창 좌표)
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
// 자리 잡기. (화면 모드가 모니터를 놓은 뒤 남은 자리를 받습니다)
//
// 세로 모드는 아래 한 칸, 가로 모드는 좌우 기둥 두 칸입니다. 캔버스 수를 칸 수에 맞춥니다.
//==============================================================================
/**
 * @param { string } mode "bottom" 또는 "sides".
 * @param { object[] } rects 칸마다 { left, top, width, height }. (CSS px, 창 좌표)
 */
export function setVirtualPadPlacement(mode, rects) {
	if (!isPadEnabled) {
		return;
	}
	padMode = mode;
	padRects = rects;
	while (padPanels.length < rects.length) {
		padPanels.push(createPanel(padPanels.length));
	}
	while (padPanels.length > rects.length) {
		const removed = padPanels.pop();
		removed.canvas.remove();
	}
	const ratio = System.window.devicePixelRatio === undefined ? 1 : System.window.devicePixelRatio;
	for (let panelIndex = 0; panelIndex < padPanels.length; ++panelIndex) {
		const panel = padPanels[panelIndex];
		const rect = rects[panelIndex];
		panel.rect = rect;
		panel.canvas.style.left = rect.left + "px";
		panel.canvas.style.top = rect.top + "px";
		panel.canvas.style.width = rect.width + "px";
		panel.canvas.style.height = rect.height + "px";
		panel.canvas.width = System.Math.round(rect.width * ratio);
		panel.canvas.height = System.Math.round(rect.height * ratio);
	}
	layoutButtons();
	drawVirtualPad();
}


//==============================================================================
// 단추 하나 놓기. (창 좌표)
//==============================================================================
/**
 * @param { string } id
 * @param { string } command
 * @param { string } shape cross, face, small.
 * @param { string } label
 * @param { number } left
 * @param { number } top
 * @param { number } width
 * @param { number } height
 * @returns { object }
 */
function placeButton(id, command, shape, label, left, top, width, height) {
	return { id: id, command: command, shape: shape, label: label,
		left: System.Math.round(left), top: System.Math.round(top), width: width, height: height, isPressed: false };
}


//==============================================================================
// 십자키 넷 놓기. (한가운데를 중심으로 위아래 좌우)
//==============================================================================
/**
 * @param { number } centerX
 * @param { number } centerY
 * @param { number } crossCell
 * @returns { object[] }
 */
function placeCross(centerX, centerY, crossCell) {
	const half = System.Math.round(crossCell * 0.5);
	crossCenterRect = { left: centerX - half, top: centerY - half, width: crossCell, height: crossCell };
	return [
		placeButton("up", Command.up, "cross", "", centerX - half, centerY - half - crossCell, crossCell, crossCell),
		placeButton("down", Command.down, "cross", "", centerX - half, centerY + half, crossCell, crossCell),
		placeButton("left", Command.left, "cross", "", centerX - half - crossCell, centerY - half, crossCell, crossCell),
		placeButton("right", Command.right, "cross", "", centerX + half, centerY - half, crossCell, crossCell),
	];
}


//==============================================================================
// 단추 자리 재기.
//
// 세로: 왼쪽에 십자, 오른쪽에 A 와 B, 가운데 아래에 셀렉트와 스타트.
// 가로: 왼쪽 기둥에 십자와 셀렉트, 오른쪽 기둥에 A 와 B(비스듬히)와 스타트.
//==============================================================================
function layoutButtons() {
	if (padMode === "sides" && padRects.length >= 2) {
		layoutSideButtons(padRects[0], padRects[1]);
		return;
	}
	if (padRects.length >= 1) {
		layoutBottomButtons(padRects[0]);
	}
}


/**
 * @param { object } rect
 */
function layoutBottomButtons(rect) {
	const width = rect.width;
	const height = rect.height;
	const margin = System.Math.round(System.Math.min(width, height) * 0.06);
	// 십자키. 한 칸의 크기를 높이에서 잽니다.
	const crossCell = System.Math.round(System.Math.min(height * 0.24, width * 0.11));
	const crossCenterX = rect.left + margin + crossCell * 2;
	const crossCenterY = rect.top + System.Math.round(height * 0.44);
	// 단추 두 개. 지름은 십자 한 칸보다 조금 큽니다.
	const faceSize = System.Math.round(crossCell * 1.25);
	const faceGap = System.Math.round(faceSize * 0.5);
	const faceRightX = rect.left + width - margin - faceSize;
	const faceTop = crossCenterY - System.Math.round(faceSize * 0.5);
	// 가운데 두 개.
	const smallWidth = System.Math.round(System.Math.min(width * 0.13, crossCell * 1.6));
	const smallHeight = System.Math.round(crossCell * 0.42);
	const smallGap = System.Math.round(smallWidth * 0.28);
	const smallCenterX = rect.left + System.Math.round(width * 0.5);
	const smallTop = rect.top + System.Math.round(height * 0.72);

	padButtons = placeCross(crossCenterX, crossCenterY, crossCell);
	// A 가 왼쪽, B 가 오른쪽입니다. (사용자 지시, 2026-09-13)
	padButtons.push(placeButton("a", Command.confirm, "face", "A", faceRightX - faceSize - faceGap, faceTop, faceSize, faceSize));
	padButtons.push(placeButton("b", Command.cancel, "face", "B", faceRightX, faceTop, faceSize, faceSize));
	padButtons.push(placeButton("select", Command.select, "small", "SELECT",
		smallCenterX - smallWidth - System.Math.round(smallGap * 0.5), smallTop, smallWidth, smallHeight));
	padButtons.push(placeButton("start", Command.menu, "small", "START",
		smallCenterX + System.Math.round(smallGap * 0.5), smallTop, smallWidth, smallHeight));
}


/**
 * @param { object } leftRect
 * @param { object } rightRect
 */
function layoutSideButtons(leftRect, rightRect) {
	// 십자키 한 칸은 기둥의 너비에서 잽니다. 세 칸이 기둥 안에 여유 있게 들어가야 합니다.
	const crossCell = System.Math.round(System.Math.min(leftRect.width * 0.26, leftRect.height * 0.16));
	const leftCenterX = leftRect.left + System.Math.round(leftRect.width * 0.5);
	const upperCenterY = leftRect.top + System.Math.round(leftRect.height * 0.42);
	// 셀렉트와 스타트는 각 기둥의 아래쪽에 하나씩.
	const smallWidth = System.Math.round(System.Math.min(leftRect.width * 0.72, crossCell * 1.8));
	const smallHeight = System.Math.round(crossCell * 0.42);
	const smallTop = leftRect.top + System.Math.round(leftRect.height * 0.78);
	// A 와 B 는 실제 패드처럼 비스듬히. A 가 왼쪽 아래, B 가 오른쪽 위입니다.
	const faceSize = System.Math.round(crossCell * 1.25);
	const faceLean = System.Math.round(faceSize * 0.14);
	const rightCenterX = rightRect.left + System.Math.round(rightRect.width * 0.5);

	padButtons = placeCross(leftCenterX, upperCenterY, crossCell);
	padButtons.push(placeButton("select", Command.select, "small", "SELECT",
		leftCenterX - System.Math.round(smallWidth * 0.5), smallTop, smallWidth, smallHeight));
	padButtons.push(placeButton("a", Command.confirm, "face", "A",
		rightCenterX - faceSize - faceLean, upperCenterY + faceLean, faceSize, faceSize));
	padButtons.push(placeButton("b", Command.cancel, "face", "B",
		rightCenterX + faceLean, upperCenterY - faceSize - faceLean, faceSize, faceSize));
	padButtons.push(placeButton("start", Command.menu, "small", "START",
		rightCenterX - System.Math.round(smallWidth * 0.5), smallTop, smallWidth, smallHeight));
}


//==============================================================================
// 그리기. (그라데이션 없이 네모와 선만 씁니다. 캔버스마다 제 칸만 그립니다)
//==============================================================================
export function drawVirtualPad() {
	if (!isPadEnabled) {
		return;
	}
	const ratio = System.window.devicePixelRatio === undefined ? 1 : System.window.devicePixelRatio;
	for (let panelIndex = 0; panelIndex < padPanels.length; ++panelIndex) {
		const panel = padPanels[panelIndex];
		const context = panel.context;
		const rect = panel.rect;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.fillStyle = PLASTIC_COLOR;
		context.fillRect(0, 0, rect.width, rect.height);
		// 모니터와 맞닿는 쪽에 한 줄 그어 나눕니다. 세로는 위, 가로는 안쪽입니다.
		if (padMode === "sides") {
			const edgeX = panelIndex === 0 ? rect.width - 5 : 0;
			context.fillStyle = PLASTIC_SHADOW_COLOR;
			context.fillRect(panelIndex === 0 ? edgeX + 2 : edgeX, 0, 3, rect.height);
			context.fillStyle = PLASTIC_LIGHT_COLOR;
			context.fillRect(panelIndex === 0 ? edgeX : edgeX + 3, 0, 2, rect.height);
		}
		else {
			context.fillStyle = PLASTIC_SHADOW_COLOR;
			context.fillRect(0, 0, rect.width, 3);
			context.fillStyle = PLASTIC_LIGHT_COLOR;
			context.fillRect(0, 3, rect.width, 2);
		}
		// 단추는 창 좌표로 놓여 있으니 이 칸의 자리만큼 당겨 그립니다.
		context.translate(-rect.left, -rect.top);
		// 십자의 한가운데를 메워 네 갈래가 한 덩이로 보이게 합니다.
		if (crossCenterRect.width > 0 && isInsideRect(crossCenterRect, rect)) {
			context.fillStyle = KEY_COLOR;
			context.fillRect(crossCenterRect.left, crossCenterRect.top, crossCenterRect.width, crossCenterRect.height);
		}
		for (const button of padButtons) {
			if (isInsideRect(button, rect)) {
				drawButton(context, button);
			}
		}
	}
}


/**
 * @param { object } box { left, top, width, height }
 * @param { object } rect
 * @returns { boolean } 상자의 가운데가 그 칸 안에 있는지.
 */
function isInsideRect(box, rect) {
	const centerX = box.left + box.width * 0.5;
	const centerY = box.top + box.height * 0.5;
	return centerX >= rect.left && centerX < rect.left + rect.width && centerY >= rect.top && centerY < rect.top + rect.height;
}


/**
 * @param { object } context
 * @param { object } button
 */
function drawButton(context, button) {
	const edge = 3;
	context.fillStyle = KEY_EDGE_COLOR;
	context.fillRect(button.left - edge, button.top - edge, button.width + edge * 2, button.height + edge * 2);
	context.fillStyle = button.isPressed ? KEY_PRESSED_COLOR : KEY_COLOR;
	context.fillRect(button.left, button.top, button.width, button.height);
	if (button.shape === "cross") {
		drawArrow(context, button);
		return;
	}
	if (button.label === "") {
		return;
	}
	const fontSize = button.shape === "face" ? System.Math.round(button.height * 0.42) : System.Math.round(button.height * 0.6);
	context.fillStyle = PLASTIC_COLOR;
	context.font = "700 " + fontSize + "px monospace";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(button.label, button.left + button.width * 0.5, button.top + button.height * 0.5 + 1);
}


//==============================================================================
// 십자키의 화살표. (세모를 네모 알갱이로 쌓아 도트처럼 보이게 합니다)
//==============================================================================
/**
 * @param { object } context
 * @param { object } button
 */
function drawArrow(context, button) {
	const centerX = button.left + button.width * 0.5;
	const centerY = button.top + button.height * 0.5;
	const unit = System.Math.max(2, System.Math.round(button.width * 0.09));
	const steps = 4;
	const half = steps * unit * 0.5;
	context.fillStyle = PLASTIC_COLOR;
	for (let step = 0; step < steps; step += 1) {
		// 꼭짓점 쪽이 좁고 밑동으로 갈수록 넓어집니다.
		const spread = (step + 1) * unit;
		if (button.id === "up") {
			context.fillRect(System.Math.round(centerX - spread), System.Math.round(centerY - half + step * unit), spread * 2, unit);
		}
		else if (button.id === "down") {
			context.fillRect(System.Math.round(centerX - spread), System.Math.round(centerY + half - (step + 1) * unit), spread * 2, unit);
		}
		else if (button.id === "left") {
			context.fillRect(System.Math.round(centerX - half + step * unit), System.Math.round(centerY - spread), unit, spread * 2);
		}
		else {
			context.fillRect(System.Math.round(centerX + half - (step + 1) * unit), System.Math.round(centerY - spread), unit, spread * 2);
		}
	}
}
