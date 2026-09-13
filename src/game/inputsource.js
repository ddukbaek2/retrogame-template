//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 입력 장치 감지. (지금 무엇으로 조작하고 있는지, 마지막으로 들어온 입력의 종류)
//
// 화면 오른쪽 아래의 작은 아이콘이 이것을 보여 줍니다. (src/ui/inputicon.js)
// 키보드, 게임패드는 명령 읽기(src/game/command.js)가 입력을 받을 때 알려 주고,
// 마우스, 터치는 여기서 직접 듣습니다. (게임은 마우스, 터치로 조작하지 않지만, 무엇을 쥐고
// 있는지는 압니다) 쓸 수 있는 장치가 아니라 **쓰고 있는** 장치입니다. (사용자 지시, 2026-09-08)
//==============================================================================
export const InputSource = System.Object.freeze({
	keyboard: "keyboard",
	gamepad: "gamepad",
	touch: "touch",
});

// 마우스가 이만큼(px) 넘게 움직여야 마우스로 봅니다. (창이 흔들릴 때 나는 미세한 이동을 걸러 냅니다)
const MOUSE_MOVE_THRESHOLD = 6;

let currentSource = InputSource.keyboard;
let isInstalled = false;


//==============================================================================
// 지금 쓰는 장치 반환.
//==============================================================================
/**
 * @returns { string } InputSource 의 값.
 */
export function readInputSource() {
	return currentSource;
}


//==============================================================================
// 입력이 들어왔음을 알림. (명령 읽기, 아래의 리스너가 부릅니다)
//==============================================================================
/**
 * @param { string } source InputSource 의 값.
 */
export function noteInputSource(source) {
	currentSource = source;
}


//==============================================================================
// 마우스, 터치 리스너 설치. (한 번만, 처음 값은 화면이 손가락용이면 터치, 아니면 키보드)
//==============================================================================
export function installInputSourceListeners() {
	if (isInstalled) {
		return;
	}
	const document = System.document;
	if (document === null || document === undefined) {
		return;
	}
	isInstalled = true;
	const window = System.window;
	if (window.matchMedia !== undefined) {
		const coarseQuery = window.matchMedia("(pointer: coarse)");
		if (coarseQuery.matches) {
			currentSource = InputSource.touch;
		}
	}
	document.addEventListener("touchstart", () => {
		noteInputSource(InputSource.touch);
	}, { passive: true });
	document.addEventListener("pointerdown", (pointerEvent) => {
		if (pointerEvent.pointerType === "touch" || pointerEvent.pointerType === "pen") {
			noteInputSource(InputSource.touch);
			return;
		}
		noteInputSource(InputSource.keyboard);
	});
	document.addEventListener("mousemove", (mouseEvent) => {
		const movement = System.Math.abs(mouseEvent.movementX) + System.Math.abs(mouseEvent.movementY);
		if (movement < MOUSE_MOVE_THRESHOLD) {
			return;
		}
		noteInputSource(InputSource.keyboard);
	});
	document.addEventListener("wheel", () => {
		noteInputSource(InputSource.keyboard);
	}, { passive: true });
}
