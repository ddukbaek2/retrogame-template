//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { GamepadAnalogStickCode, GamepadButtonCode } from "../../libs/vanilla.js/src/core/gamepadmanager.js";
import { InputSource, noteInputSource } from "./inputsource.js";
import { isTypingActive, focusTypingElement } from "./typing.js";
import { REPEAT_DELAY_SECONDS, REPEAT_INTERVAL_SECONDS, STICK_THRESHOLD } from "./constants.js";


//==============================================================================
// 명령. (이 게임의 입력은 이 일곱 가지뿐입니다)
//
// 마우스는 없습니다. 키보드의 방향키 + 확인, 취소, 게임패드의 십자키 + A, B 가 전부입니다.
// 메뉴는 ESC / Start 로도 열립니다. (취소를 더 누를 것이 없을 때도 열립니다)
//==============================================================================
export const Command = System.Object.freeze({
	up: "up",
	down: "down",
	left: "left",
	right: "right",
	confirm: "confirm",
	cancel: "cancel",
	menu: "menu",
});

export const DIRECTION_COMMANDS = System.Object.freeze([Command.up, Command.down, Command.left, Command.right]);

// 반복 타이머에 넣는 한 프레임 시간의 상한. (초)
const REPEAT_TIME_DELTA_LIMIT = 0.05;
// 손가락 조작. (사용자 요청, 2026-09-09, "터치 모드에서는 그냥 터치되게")
// 끌면 그 방향을 누르고 있는 것, 톡 치면 확인, 두 손가락은 취소, 길게 누르면 메뉴입니다.
const TOUCH_DRAG_DISTANCE = 28;
const TOUCH_LONG_PRESS_SECONDS = 0.6;

// 키보드 코드 → 명령.
const KEY_COMMANDS = System.Object.freeze({
	ArrowUp: Command.up,
	KeyW: Command.up,
	ArrowDown: Command.down,
	KeyS: Command.down,
	ArrowLeft: Command.left,
	KeyA: Command.left,
	ArrowRight: Command.right,
	KeyD: Command.right,
	Enter: Command.confirm,
	NumpadEnter: Command.confirm,
	Space: Command.confirm,
	KeyZ: Command.confirm,
	KeyJ: Command.confirm,
	Backspace: Command.cancel,
	KeyX: Command.cancel,
	KeyK: Command.cancel,
	Escape: Command.menu,
});

// 게임패드 단추 → 명령. (W3C 표준 매핑)
const PAD_COMMANDS = System.Object.freeze({
	[GamepadButtonCode.DPAD_UP]: Command.up,
	[GamepadButtonCode.DPAD_DOWN]: Command.down,
	[GamepadButtonCode.DPAD_LEFT]: Command.left,
	[GamepadButtonCode.DPAD_RIGHT]: Command.right,
	[GamepadButtonCode.A_CROSS]: Command.confirm,
	[GamepadButtonCode.B_CIRCLE]: Command.cancel,
	[GamepadButtonCode.X_SQUARE]: Command.cancel,
	[GamepadButtonCode.OPTIONS_MENU]: Command.menu,
});


//==============================================================================
// 명령 읽기.
//
// 키보드와 게임패드의 눌림을 모아 "이번 프레임에 일어난 명령" 목록을 만듭니다.
// 방향은 누르고 있으면 잠시 뒤부터 반복됩니다. 확인, 취소, 메뉴는 누른 순간 한 번입니다.
//==============================================================================
export class CommandReader {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Set<string> } */ #pressedKeyCommands;
	/** @private @type { string[] } */ #queue;
	/** @private @type { object } */ #heldSince;
	/** @private @type { object } */ #repeatTimers;
	/** @private @type { object } */ #padHeld;
	/** @private @type { Function } */ #gestureHandler;
	/** @private @type { boolean } */ #hasGesture;
	/** @private @type { object } */ #touch;
	/** @private @type { Function } */ #tapHandler;
	/** @private @type { Function } */ #touchAreaTest;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		this.#pressedKeyCommands = new Set();
		this.#queue = [];
		this.#heldSince = {};
		this.#repeatTimers = {};
		this.#padHeld = {};
		this.#gestureHandler = null;
		this.#hasGesture = false;
		this.#touch = { isDown: false, startX: 0, startY: 0, startTime: 0, direction: null, maximumCount: 0 };
		this.#tapHandler = null;
		this.#touchAreaTest = null;
		for (const command of DIRECTION_COMMANDS) {
			this.#heldSince[command] = false;
			this.#repeatTimers[command] = 0;
		}
	}

	//==============================================================================
	// 키보드 등록. (엔진의 키 상태와 별개로 누른 순간을 직접 받습니다)
	//==============================================================================
	install() {
		const document = System.document;
		if (document === null || document === undefined) {
			return;
		}
		document.addEventListener("keydown", (keyboardEvent) => {
			noteInputSource(InputSource.keyboard);
			// 글을 치는 동안은 ESC 말고는 명령으로 바꾸지 않습니다. (글자 입력이 브라우저로 가야 합니다)
			if (isTypingActive() && keyboardEvent.code !== "Escape") {
				return;
			}
			const command = KEY_COMMANDS[keyboardEvent.code];
			if (command === undefined) {
				return;
			}
			keyboardEvent.preventDefault();
			if (keyboardEvent.repeat) {
				return;
			}
			this.#pressedKeyCommands.add(keyboardEvent.code);
			this.press(command);
		});
		document.addEventListener("keyup", (keyboardEvent) => {
			const command = KEY_COMMANDS[keyboardEvent.code];
			if (command === undefined) {
				return;
			}
			this.#pressedKeyCommands.delete(keyboardEvent.code);
			this.release(command);
		});
		System.window.addEventListener("blur", () => {
			this.clear();
		});
		document.addEventListener("touchstart", (touchEvent) => {
			this.beginTouch(touchEvent);
		}, { passive: false });
		document.addEventListener("touchmove", (touchEvent) => {
			this.moveTouch(touchEvent);
		}, { passive: false });
		document.addEventListener("touchend", (touchEvent) => {
			this.endTouch(touchEvent);
		}, { passive: false });
		document.addEventListener("touchcancel", () => {
			this.cancelTouch();
		});
	}

	//==============================================================================
	// 톡 친 자리를 먼저 받아 볼 것 등록. (참을 돌려주면 확인을 보내지 않습니다)
	//==============================================================================
	/**
	 * @param { Function } tapHandler (clientX, clientY) => boolean
	 */
	setTapHandler(tapHandler) {
		this.#tapHandler = tapHandler;
	}

	//==============================================================================
	// 손가락을 받을 자리 정하기. (게임 화면 밖을 대면 조작으로 보지 않습니다)
	//
	// 모니터 밖에는 가상 패드가 서 있습니다. 화면 밖을 댄 것까지 조작으로 보면 패드를 누를 때마다
	// 확인이 두 번 들어갑니다. (사용자 지적, 2026-09-13, "터치일 때 게임 화면을 벗어나도 터치가
	// 먹는 게 문제야, 그러다 보니 가상 키패드가 있어도 중복됨")
	//==============================================================================
	/**
	 * @param { Function } touchAreaTest (clientX, clientY) => boolean
	 */
	setTouchAreaTest(touchAreaTest) {
		this.#touchAreaTest = touchAreaTest;
	}

	//==============================================================================
	// 손가락을 댐. (글을 치는 화면이면 자판을 엽니다)
	//==============================================================================
	/**
	 * @param { TouchEvent } touchEvent
	 */
	beginTouch(touchEvent) {
		noteInputSource(InputSource.touch);
		if (isTypingActive()) {
			focusTypingElement();
			return;
		}
		touchEvent.preventDefault();
		const touch = touchEvent.touches[0];
		if (touch === undefined) {
			return;
		}
		if (!this.#hasGesture && this.#gestureHandler !== null) {
			this.#hasGesture = true;
			this.#gestureHandler();
		}
		if (!this.#touch.isDown) {
			// 게임 화면 밖(가상 패드 자리, 모니터 테두리)을 댄 것은 조작으로 보지 않습니다.
			if (this.#touchAreaTest !== null) {
				const isInside = this.#touchAreaTest(touch.clientX, touch.clientY);
				if (!isInside) {
					return;
				}
			}
			this.#touch.isDown = true;
			this.#touch.startX = touch.clientX;
			this.#touch.startY = touch.clientY;
			this.#touch.startTime = System.Date.now();
			this.#touch.direction = null;
			this.#touch.maximumCount = 0;
		}
		this.#touch.maximumCount = System.Math.max(this.#touch.maximumCount, touchEvent.touches.length);
	}

	//==============================================================================
	// 손가락을 끎. (끈 쪽을 누르고 있는 것으로 봅니다)
	//==============================================================================
	/**
	 * @param { TouchEvent } touchEvent
	 */
	moveTouch(touchEvent) {
		if (!this.#touch.isDown || isTypingActive()) {
			return;
		}
		touchEvent.preventDefault();
		const touch = touchEvent.touches[0];
		if (touch === undefined) {
			return;
		}
		const moveX = touch.clientX - this.#touch.startX;
		const moveY = touch.clientY - this.#touch.startY;
		const distanceX = System.Math.abs(moveX);
		const distanceY = System.Math.abs(moveY);
		if (System.Math.max(distanceX, distanceY) < TOUCH_DRAG_DISTANCE) {
			return;
		}
		let direction = Command.left;
		if (distanceX >= distanceY) {
			direction = moveX > 0 ? Command.right : Command.left;
		}
		else {
			direction = moveY > 0 ? Command.down : Command.up;
		}
		if (this.#touch.direction === direction) {
			return;
		}
		if (this.#touch.direction !== null) {
			this.release(this.#touch.direction);
		}
		this.#touch.direction = direction;
		this.press(direction);
	}

	//==============================================================================
	// 손가락을 뗌. (끌었으면 방향을 놓고, 톡 쳤으면 확인, 두 손가락은 취소, 길게는 메뉴)
	//==============================================================================
	/**
	 * @param { TouchEvent } touchEvent
	 */
	endTouch(touchEvent) {
		if (!this.#touch.isDown || isTypingActive()) {
			return;
		}
		if (touchEvent.touches.length > 0) {
			return;
		}
		touchEvent.preventDefault();
		const heldDirection = this.#touch.direction;
		const heldSeconds = (System.Date.now() - this.#touch.startTime) / 1000;
		const fingerCount = this.#touch.maximumCount;
		this.#touch.isDown = false;
		this.#touch.direction = null;
		if (heldDirection !== null) {
			this.release(heldDirection);
			return;
		}
		if (fingerCount >= 2) {
			this.press(Command.cancel);
			return;
		}
		if (heldSeconds >= TOUCH_LONG_PRESS_SECONDS) {
			this.press(Command.menu);
			return;
		}
		if (this.#tapHandler !== null) {
			const isHandled = this.#tapHandler(this.#touch.startX, this.#touch.startY);
			if (isHandled) {
				return;
			}
		}
		this.press(Command.confirm);
	}

	//==============================================================================
	// 손가락 조작 취소. (창이 바뀌는 등)
	//==============================================================================
	cancelTouch() {
		if (this.#touch.direction !== null) {
			this.release(this.#touch.direction);
		}
		this.#touch.isDown = false;
		this.#touch.direction = null;
	}

	//==============================================================================
	// 첫 입력 때 부를 것 등록. (오디오 컨텍스트는 사용자 입력 뒤에만 열립니다)
	//==============================================================================
	/**
	 * @param { Function } gestureHandler
	 */
	setGestureHandler(gestureHandler) {
		this.#gestureHandler = gestureHandler;
	}

	//==============================================================================
	// 패드로 누르고 있는 상태 정하기. (실제 게임패드와 가상 패드가 함께 씁니다)
	//
	// 방향을 누르고 있는 동안 반복이 돌아야 하므로 눌린 상태를 따로 들고 있습니다.
	//==============================================================================
	/**
	 * @param { string } command
	 * @param { boolean } isDown
	 */
	setPadHeld(command, isDown) {
		this.#padHeld[command] = isDown;
	}

	//==============================================================================
	// 누름. (방향은 누른 순간 한 번 + 반복 타이머 시작)
	//==============================================================================
	/**
	 * @param { string } command
	 */
	press(command) {
		if (!this.#hasGesture && this.#gestureHandler !== null) {
			this.#hasGesture = true;
			this.#gestureHandler();
		}
		if (DIRECTION_COMMANDS.indexOf(command) >= 0) {
			if (this.#heldSince[command]) {
				return;
			}
			this.#heldSince[command] = true;
			this.#repeatTimers[command] = REPEAT_DELAY_SECONDS;
		}
		this.#queue.push(command);
	}

	//==============================================================================
	// 뗌.
	//==============================================================================
	/**
	 * @param { string } command
	 */
	release(command) {
		if (DIRECTION_COMMANDS.indexOf(command) >= 0) {
			// 같은 방향을 키보드의 다른 키로 아직 누르고 있으면 유지합니다.
			for (const pressedCode of this.#pressedKeyCommands) {
				if (KEY_COMMANDS[pressedCode] === command) {
					return;
				}
			}
			if (this.#padHeld[command]) {
				return;
			}
			this.#heldSince[command] = false;
		}
	}

	//==============================================================================
	// 지금 누르고 있는지. (실시간 게임이 매 프레임 읽습니다, 키보드, 게임패드 모두)
	//==============================================================================
	/**
	 * @param { string } command
	 * @returns { boolean }
	 */
	isHeld(command) {
		if (this.#heldSince[command] === true) {
			return true;
		}
		if (this.#padHeld[command] === true) {
			return true;
		}
		for (const pressedCode of this.#pressedKeyCommands) {
			if (KEY_COMMANDS[pressedCode] === command) {
				return true;
			}
		}
		return false;
	}

	//==============================================================================
	// 전부 놓음. (창이 바뀌면 눌린 채로 남지 않게, 아직 배분하지 않은 명령도 버립니다)
	//==============================================================================
	clear() {
		this.#queue = [];
		this.#pressedKeyCommands.clear();
		for (const command of DIRECTION_COMMANDS) {
			this.#heldSince[command] = false;
		}
		this.#padHeld = {};
	}

	//==============================================================================
	// 갱신. (게임패드 폴링 + 방향 반복)
	//==============================================================================
	/**
	 * @param { object } engine
	 * @param { number } timeDelta
	 */
	tick(engine, timeDelta) {
		this.pollGamepad(engine);
		// 프레임이 길게 끊겼을 때(창 전환, 로딩) 반복이 몰아서 나가지 않게 시간을 자릅니다.
		const clampedTimeDelta = System.Math.min(timeDelta, REPEAT_TIME_DELTA_LIMIT);
		for (const command of DIRECTION_COMMANDS) {
			if (!this.#heldSince[command]) {
				continue;
			}
			this.#repeatTimers[command] -= clampedTimeDelta;
			if (this.#repeatTimers[command] <= 0) {
				this.#repeatTimers[command] += REPEAT_INTERVAL_SECONDS;
				this.#queue.push(command);
			}
		}
	}

	//==============================================================================
	// 게임패드 상태를 읽어 누름, 뗌으로 바꿉니다. (십자키 + 왼쪽 스틱)
	//==============================================================================
	/**
	 * @param { object } engine
	 */
	pollGamepad(engine) {
		const inputManager = engine.getInputManager();
		const gamepadManager = inputManager.getGamepadManager();
		const connectedCount = gamepadManager.getConnectedGamepadCount();
		const nextHeld = {};
		for (let padIndex = 0; padIndex < connectedCount; ++padIndex) {
			const gamepad = gamepadManager.getConnectedGamepad(padIndex);
			if (gamepad === undefined || gamepad === null) {
				continue;
			}
			const hardwareIndex = gamepad.index;
			const buttonCodes = System.Object.keys(PAD_COMMANDS);
			for (const buttonCodeText of buttonCodes) {
				const buttonCode = System.Number.parseInt(buttonCodeText, 10);
				const isPressed = gamepadManager.isButtonPressed(hardwareIndex, buttonCode);
				if (isPressed) {
					nextHeld[PAD_COMMANDS[buttonCodeText]] = true;
				}
			}
			const axisX = gamepadManager.getAxisValue(hardwareIndex, GamepadAnalogStickCode.LEFT_X);
			const axisY = gamepadManager.getAxisValue(hardwareIndex, GamepadAnalogStickCode.LEFT_Y);
			if (axisX <= -STICK_THRESHOLD) {
				nextHeld[Command.left] = true;
			}
			if (axisX >= STICK_THRESHOLD) {
				nextHeld[Command.right] = true;
			}
			if (axisY <= -STICK_THRESHOLD) {
				nextHeld[Command.up] = true;
			}
			if (axisY >= STICK_THRESHOLD) {
				nextHeld[Command.down] = true;
			}
		}
		const allCommands = System.Object.values(Command);
		for (const command of allCommands) {
			const wasHeld = this.#padHeld[command] === true;
			const isHeld = nextHeld[command] === true;
			if (wasHeld !== isHeld) {
				noteInputSource(InputSource.gamepad);
			}
			if (isHeld && !wasHeld) {
				this.#padHeld[command] = true;
				this.press(command);
			}
			else if (!isHeld && wasHeld) {
				this.#padHeld[command] = false;
				this.release(command);
			}
		}
	}

	//==============================================================================
	// 이번 프레임의 명령 목록 반환. (돌려주고 비웁니다)
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	drainCommands() {
		if (this.#queue.length === 0) {
			return this.#queue;
		}
		const drained = this.#queue;
		this.#queue = [];
		return drained;
	}
}
