//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { applyPixelFixedScale } from "./viewscale.js";
import { syncCrtCanvas, isCrtOverlayActive, setCrtMonitorPlacement, setCrtSourceSize } from "./crt.js";
import { readVirtualPadReserve, setVirtualPadPlacement } from "./virtualpad.js";
import { readScreenWidth, setScreenWidth } from "./screensize.js";
import { REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT, WINDOW_REFERENCE_WIDTH, WINDOW_REFERENCE_HEIGHT, WIDE_MAXIMUM_ASPECT } from "./constants.js";


//==============================================================================
// 화면 모드.
//
// 캔버스의 CSS 크기를 늘 16:10 으로 맞춥니다. 남는 자리는 검게 둡니다.
//
//   창 맞춤  , 비율을 지킨 채 창을 꽉 채웁니다. 배율이 정수가 아니면 도트 크기가 조금 고르지 않습니다. (기본)
//   정수 배율, 1 배, 2 배, 3 배처럼 정수 배율만 씁니다. 도트가 완벽하게 고릅니다. 대신 여백이 남습니다.
//   와이드  , 4 : 3 을 벗어납니다. 그리는 폭을 창 비율대로 넓혀(세로 720 은 그대로) 창을 꽉 채웁니다.
//             기준 폭(4 : 3)보다 좁아지지 않고 WIDE_MAXIMUM_ASPECT 보다 넓어지지 않습니다. 모니터 프레임은 쓰지 않습니다.
//   1280 × 800, 기준 해상도 그대로입니다. (개발 확인용)
//   640 × 400 , 절반입니다. (개발 확인용)
//
// 설정 창은 앞의 셋만 고릅니다. PageUp / PageDown 은 개발 확인용으로 다섯을 순환합니다.
//==============================================================================
const DISPLAY_MODES = [
	{ id: "fit", width: REFERENCE_RESOLUTION_WIDTH, height: REFERENCE_RESOLUTION_HEIGHT, fitWindow: true, isInteger: false },
	{ id: "integer", width: REFERENCE_RESOLUTION_WIDTH, height: REFERENCE_RESOLUTION_HEIGHT, fitWindow: true, isInteger: true },
	{ id: "wide", width: REFERENCE_RESOLUTION_WIDTH, height: REFERENCE_RESOLUTION_HEIGHT, fitWindow: true, isInteger: false },
	{ id: "native", width: REFERENCE_RESOLUTION_WIDTH, height: REFERENCE_RESOLUTION_HEIGHT, fitWindow: false, isInteger: false },
	{ id: "half", width: REFERENCE_RESOLUTION_WIDTH / 2, height: REFERENCE_RESOLUTION_HEIGHT / 2, fitWindow: false, isInteger: false },
];

let targetEngine = null;
let currentModeIndex = 0;


//==============================================================================
// 단축키 등록과 첫 적용.
//==============================================================================
/**
 * @param { object } engine
 * @param { string } displayModeId 설정에 저장된 화면 모드.
 */
export function initializeDisplayModes(engine, displayModeId) {
	const document = System.document;
	if (document === null || document === undefined) {
		return;
	}
	targetEngine = engine;
	currentModeIndex = findModeIndex(displayModeId);
	applyDisplayMode(currentModeIndex);

	document.addEventListener("keydown", (keyboardEvent) => {
		if (keyboardEvent.code === "PageUp") {
			changeDisplayMode(1);
			return;
		}
		if (keyboardEvent.code === "PageDown") {
			changeDisplayMode(-1);
		}
	});
	System.window.addEventListener("resize", () => {
		applyDisplayMode(currentModeIndex);
	});
}


//==============================================================================
// 식별자로 모드 찾기. (없으면 0)
//==============================================================================
/**
 * @param { string } displayModeId
 * @returns { number }
 */
function findModeIndex(displayModeId) {
	for (let modeIndex = 0; modeIndex < DISPLAY_MODES.length; ++modeIndex) {
		if (DISPLAY_MODES[modeIndex].id === displayModeId) {
			return modeIndex;
		}
	}
	return 0;
}


//==============================================================================
// 설정에서 고른 모드 적용.
//==============================================================================
/**
 * @param { string } displayModeId
 */
export function selectDisplayMode(displayModeId) {
	currentModeIndex = findModeIndex(displayModeId);
	applyDisplayMode(currentModeIndex);
}


//==============================================================================
// 모드 순환. (개발 확인용)
//==============================================================================
/**
 * @param { number } step
 */
export function changeDisplayMode(step) {
	const modeCount = DISPLAY_MODES.length;
	currentModeIndex = (currentModeIndex + step + modeCount) % modeCount;
	applyDisplayMode(currentModeIndex);
}


//==============================================================================
// 지금 모드로 다시 재기. (창 크기가 아니라 화면을 이루는 것이 바뀌었을 때)
//==============================================================================
export function refreshDisplayPlacement() {
	applyDisplayMode(currentModeIndex);
}


//==============================================================================
// 게임 화면 자리 잡기. (화면 모드대로 1280 × 800 을 재어 브라운관 필터에도 넘깁니다)
//==============================================================================
/**
 * @param { object } displayMode
 * @param { number } availableWidth
 * @param { number } availableHeight
 * @param { number } originLeft 쓸 수 있는 자리가 창 왼쪽에서 얼마나 떨어져 시작하는지. (가로 모드의 가상 패드 기둥)
 * @returns { object } 창 안에 놓인 게임 화면의 자리와 크기입니다. (CSS px)
 */
function placeGameScreen(displayMode, availableWidth, availableHeight, originLeft) {
	let baseWidth = displayMode.id === "half" ? WINDOW_REFERENCE_WIDTH / 2 : WINDOW_REFERENCE_WIDTH;
	let baseHeight = displayMode.id === "half" ? WINDOW_REFERENCE_HEIGHT / 2 : WINDOW_REFERENCE_HEIGHT;
	if (displayMode.id === "wide") {
		// 와이드는 모니터 그림이 없으므로 게임 화면이 곧 브라운관 화면입니다. 그 비율 그대로 창에 맞춥니다.
		baseWidth = readScreenWidth();
		baseHeight = REFERENCE_RESOLUTION_HEIGHT;
	}
	let monitorWidth = baseWidth;
	let monitorHeight = baseHeight;
	if (displayMode.fitWindow) {
		const widthScale = availableWidth / baseWidth;
		const heightScale = availableHeight / baseHeight;
		let deviceScale = System.Math.min(widthScale, heightScale);
		if (displayMode.isInteger) {
			if (deviceScale >= 1) {
				deviceScale = System.Math.floor(deviceScale);
			}
			else {
				deviceScale = 1 / System.Math.ceil(1 / deviceScale);
			}
		}
		monitorWidth = System.Math.round(baseWidth * deviceScale);
		monitorHeight = System.Math.round(baseHeight * deviceScale);
	}
	const monitorLeft = originLeft + System.Math.round((availableWidth - monitorWidth) * 0.5);
	const monitorTop = System.Math.round((availableHeight - monitorHeight) * 0.5);
	setCrtMonitorPlacement(monitorLeft, monitorTop, monitorWidth, monitorHeight);
	return { left: monitorLeft, top: monitorTop, width: monitorWidth, height: monitorHeight };
}


//==============================================================================
// 모드 적용. (캔버스 CSS 크기 → 백버퍼 고정 → 엔진 resize)
//==============================================================================
/**
 * @param { number } modeIndex
 */
export function applyDisplayMode(modeIndex) {
	if (targetEngine === null) {
		return;
	}
	const displayMode = DISPLAY_MODES[modeIndex];
	const viewManager = targetEngine.getViewManager();
	const canvas = viewManager.getCanvas();
	if (canvas === null || canvas === undefined) {
		return;
	}

	// 손가락으로 노는 기기에서는 가상 패드가 서므로 그만큼 덜어 낸 자리에 모니터를 놓습니다.
	// 세로면 아래에 한 덩이, 가로면 좌우 기둥으로 갈라 섭니다.
	// (사용자 지시, 2026-09-13, "모바일 앱만 게임 화면과 별개로 모니터 아래에 가상 키패드가 있는 거야",
	// 2026-09-15, "폰이 세로모드일때만 나오는거고 가로모드일때는 좌우로 분리해서 가상키패드가 나와줬으면해")
	const windowWidth = System.window.innerWidth;
	const windowHeight = System.window.innerHeight;
	const padReserve = readVirtualPadReserve(windowWidth, windowHeight);
	const availableWidth = windowWidth - padReserve.side * 2;
	const availableHeight = windowHeight - padReserve.bottom;
	// 그리는 폭을 먼저 정합니다. 와이드만 창 비율을 따르고 나머지는 기준 폭(4 : 3)입니다.
	applyScreenWidth(viewManager, readModeScreenWidth(displayMode, availableWidth, availableHeight));
	// 화면은 세 겹입니다. 창(브라우저) 안에 게임 화면(1280 × 800)이 놓이고, 그 안에 브라운관 화면(960 × 720)이 놓입니다.
	// 화면 모드가 재는 것은 늘 가운데의 게임 화면이고, 그 바깥은 검은 띠입니다.
	const gameScreenRect = placeGameScreen(displayMode, availableWidth, availableHeight, padReserve.side);
	if (padReserve.bottom > 0) {
		setVirtualPadPlacement("bottom", [{ left: 0, top: availableHeight, width: windowWidth, height: padReserve.bottom }]);
	}
	else if (padReserve.side > 0) {
		setVirtualPadPlacement("sides", [
			{ left: 0, top: 0, width: padReserve.side, height: windowHeight },
			{ left: windowWidth - padReserve.side, top: 0, width: padReserve.side, height: windowHeight },
		]);
	}
	canvas.style.position = "absolute";
	canvas.style.imageRendering = "pixelated";
	const isMonitorShown = isCrtOverlayActive();
	const sourceWidth = readScreenWidth();
	if (isMonitorShown) {
		// 브라운관을 켜면 이 캔버스는 보이지 않고 덮개가 대신 보여 줍니다. 그러니 기준 크기 그대로 두어 1 : 1 로 그립니다.
		canvas.style.width = sourceWidth + "px";
		canvas.style.height = REFERENCE_RESOLUTION_HEIGHT + "px";
		canvas.style.left = "0px";
		canvas.style.top = "0px";
	}
	else {
		// 브라운관을 끄면 모니터 테두리가 없어진 만큼만 화면이 커집니다. 비율(4 : 3)은 그대로라 좌우에 검은 띠가 남습니다.
		// (와이드는 그리는 폭이 창 비율을 따르므로 띠가 남지 않습니다)
		const widthScale = gameScreenRect.width / sourceWidth;
		const heightScale = gameScreenRect.height / REFERENCE_RESOLUTION_HEIGHT;
		const screenScale = System.Math.min(widthScale, heightScale);
		const screenWidth = System.Math.round(sourceWidth * screenScale);
		const screenHeight = System.Math.round(REFERENCE_RESOLUTION_HEIGHT * screenScale);
		const screenLeft = gameScreenRect.left + (gameScreenRect.width - screenWidth) * 0.5;
		const screenTop = gameScreenRect.top + (gameScreenRect.height - screenHeight) * 0.5;
		canvas.style.width = screenWidth + "px";
		canvas.style.height = screenHeight + "px";
		canvas.style.left = System.Math.round(screenLeft) + "px";
		canvas.style.top = System.Math.round(screenTop) + "px";
	}

	// CSS 크기가 바뀌었으니 백버퍼 배율을 다시 잡고 엔진에 알립니다.
	targetEngine.resize();
	applyPixelFixedScale(viewManager);
	targetEngine.resize();
	syncCrtCanvas();
}


//==============================================================================
// 그 모드의 그리는 폭. (와이드만 창 비율을 따르고 나머지는 기준 폭)
//
// 와이드는 세로 720 을 두고 가로를 창 비율만큼 넓힙니다. 기준 폭(4 : 3)보다 좁은 창에서는 기준 폭을 쓰고
// (위아래에 띠), WIDE_MAXIMUM_ASPECT 보다 넓은 창에서는 그 비율에서 멈춥니다. (좌우에 띠)
//==============================================================================
/**
 * @param { object } displayMode
 * @param { number } availableWidth
 * @param { number } availableHeight
 * @returns { number }
 */
function readModeScreenWidth(displayMode, availableWidth, availableHeight) {
	if (displayMode.id !== "wide" || availableWidth <= 0 || availableHeight <= 0) {
		return REFERENCE_RESOLUTION_WIDTH;
	}
	const maximumWidth = System.Math.round(REFERENCE_RESOLUTION_HEIGHT * WIDE_MAXIMUM_ASPECT);
	const windowWidth = System.Math.round(REFERENCE_RESOLUTION_HEIGHT * availableWidth / availableHeight);
	return System.Math.max(REFERENCE_RESOLUTION_WIDTH, System.Math.min(maximumWidth, windowWidth));
}


//==============================================================================
// 그리는 폭 바꾸기. (엔진의 기준 해상도, 브라운관 필터의 원본 크기, 화면 코드가 읽는 폭을 함께)
//==============================================================================
/**
 * @param { object } viewManager
 * @param { number } width
 */
function applyScreenWidth(viewManager, width) {
	const currentWidth = readScreenWidth();
	if (width === currentWidth) {
		return;
	}
	setScreenWidth(width);
	const referenceResolutionSize = Vector2.create(width, REFERENCE_RESOLUTION_HEIGHT);
	viewManager.applyReferenceResolutionSize(referenceResolutionSize);
	setCrtSourceSize(width, REFERENCE_RESOLUTION_HEIGHT);
}
