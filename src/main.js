//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { readRect } from "./game/scratch.js";
import { Vector2 } from "../libs/vanilla.js/src/base/vector2.js";
import { Engine, EngineConfiguration } from "../libs/vanilla.js/src/core/engine.js";
import { Scene } from "../libs/vanilla.js/src/core/scene.js";
import { FontAsset } from "../libs/vanilla.js/src/resource/fontasset.js";
import { applyPixelFixedScale } from "./game/viewscale.js";
import { initializeDisplayModes, selectDisplayMode, refreshDisplayPlacement } from "./game/devicesize.js";
import { getColor, setPaletteRemap, resolveRemapColorString } from "./game/palette.js";
import { setDisplayColorMode, setDisplayPaperColor } from "./game/display.js";
import { CurveLevelOptions, MonitorColorOptions } from "./game/constants.js";
import { buildPaletteRemap } from "./game/identity.js";
import { installInputSourceListeners, readInputSource } from "./game/inputsource.js";
import { drawInputIcon } from "./ui/inputicon.js";
import { drawTestGrid } from "./ui/testgrid.js";
import { attachCrt, applyCrtOptions, isCrtOverlayActive, mapWindowPointToGame, startScreenReveal, advanceScreenReveal } from "./game/crt.js";
import { attachVirtualPad } from "./game/virtualpad.js";
import { drawText, setFontOverrides } from "./game/text.js";
import { CommandReader, Command } from "./game/command.js";
import { openAudio, setSoundEnabled, beepMove } from "./game/beep.js";
import { stopMusic } from "./game/music.js";
import { tickUiTime } from "./ui/uitime.js";
import { readSettings, writeSettings, clearAllGameData, createDefaultSettings } from "./game/savedata.js";
import { createGameModule } from "./game/gameentry.js";
import { TitleScreen } from "./screen/titlescreen.js";
import { SettingsWindow } from "./panel/settingswindow.js";
import {
	GAME_TITLE, Colors, Screen, UiFontSize, FontPaths,
	REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT,
} from "./game/constants.js";


//==============================================================================
// 메인 씬. (게임 모듈 관리 + 화면 라우팅 + 명령 배분)
//
// **한 프로젝트에 게임 한 편입니다.** 씬은 타이틀과 설정을 직접 갖고, 게임의 화면은 게임
// 모듈(src/games/<id>/)이 만들어 씬에 맡깁니다. 화면은 루트 아래의 노드이고 한 번에 하나만
// 켜져 있습니다. 명령(방향, 확인, 취소, 메뉴)은 켜진 화면이 받습니다.
//
//   타이틀 ─ 시작 ─→ 게임의 첫 화면 … ─ 타이틀로 ─→ 타이틀
//   타이틀, 게임 안 ─ 설정 ─→ 설정(소리, 화면, 진행 지우기) ─ 취소 ─→ 돌아감
//
// 어떤 게임을 만드는지는 src/game/gameentry.js 가 정합니다.
//==============================================================================
class GameScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #screens;
	/** @private @type { string } */ #currentScreenKey;
	/** @private @type { string } */ #settingsReturnKey;
	/** @private @type { object } */ #gameModule;
	/** @private @type { object } */ #settings;
	/** @private @type { CommandReader } */ #commandReader;
	/** @private @type { TitleScreen } */ #titleScreen;
	/** @private @type { SettingsWindow } */ #settingsWindow;
	/** @private @type { number } */ #loadedRatio;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#screens = {};
		this.#currentScreenKey = "";
		this.#settingsReturnKey = Screen.title;
		this.#gameModule = null;
		this.#settings = readSettings();
		this.#commandReader = new CommandReader();
		this.#titleScreen = null;
		this.#settingsWindow = null;
		this.#loadedRatio = 0;
	}

	//==============================================================================
	// 비동기 로드. (글꼴 → 게임 모듈 자료 → 화면)
	//==============================================================================
	/**
	 * @override
	 * @param { object } engine
	 */
	async load(engine) {
		await super.load(engine);
		const viewManager = engine.getViewManager();
		applyPixelFixedScale(viewManager);

		let loadedFontCount = 0;
		for (const fontPath of FontPaths) {
			const fontAsset = new FontAsset();
			await fontAsset.loadFont(fontPath.family, fontPath.path, { weight: fontPath.weight });
			loadedFontCount += 1;
			this.#loadedRatio = 0.3 * loadedFontCount / FontPaths.length;
		}

		this.#gameModule = createGameModule(this);
		await this.#gameModule.load();
		this.#loadedRatio = 1;

		const root = this.getRoot();
		this.#titleScreen = new TitleScreen(this);
		this.#settingsWindow = new SettingsWindow(this);
		this.registerScreen(Screen.title, this.#titleScreen);
		this.registerScreen(Screen.settings, this.#settingsWindow);
		const gameScreens = this.#gameModule.createScreens();
		const localKeys = System.Object.keys(gameScreens);
		for (const localKey of localKeys) {
			this.registerScreen(this.#gameModule.getId() + ":" + localKey, gameScreens[localKey]);
		}
		const screenKeys = System.Object.keys(this.#screens);
		for (const screenKey of screenKeys) {
			root.addChild(this.#screens[screenKey]);
		}

		this.#commandReader.install();
		// 손가락으로 노는 기기에는 모니터 아래에 가상 패드가 섭니다. (사용자 지시, 2026-09-13)
		if (attachVirtualPad(this.#commandReader)) {
			// 패드가 서면 모니터가 앉을 자리가 줄어드니 다시 잽니다.
			refreshDisplayPlacement();
		}
		installInputSourceListeners();
		this.#commandReader.setGestureHandler(() => {
			openAudio();
		});
		// 마우스, 손가락이 가리킨 곳을 지금 화면에 알립니다. (목록이 있으면 그 항목을 고릅니다)
		this.#commandReader.setTapHandler((clientX, clientY) => {
			return this.handlePointerAt(clientX, clientY);
		});
		// 손가락은 모니터의 화면 구멍 안을 댔을 때만 조작입니다. 그 밖은 가상 패드의 몫입니다.
		this.#commandReader.setTouchAreaTest((clientX, clientY) => {
			const gamePoint = mapWindowPointToGame(clientX, clientY);
			return gamePoint !== null;
		});
		// 마우스는 왼쪽이 확인, 오른쪽이 취소입니다. (사용자 지시, 2026-09-10)
		System.document.addEventListener("pointerdown", (pointerEvent) => {
			if (pointerEvent.pointerType === "touch" || pointerEvent.pointerType === "pen") {
				return;
			}
			openAudio();
			if (pointerEvent.button === 2) {
				this.#commandReader.press(Command.cancel);
				return;
			}
			this.handlePointerAt(pointerEvent.clientX, pointerEvent.clientY);
		});
		// F9 와 F10 이 모니터 색을 앞뒤로 돌립니다. 설정 창을 거치지 않고 그 자리에서 바뀝니다.
		// (사용자 요청, 2026-09-10, 앞뒤로 나눈 것은 2026-09-13)
		System.document.addEventListener("keydown", (keyboardEvent) => {
			if (keyboardEvent.code !== "F9" && keyboardEvent.code !== "F10") {
				return;
			}
			keyboardEvent.preventDefault();
			this.cycleMonitorColor(keyboardEvent.code === "F9" ? -1 : 1);
		});
		System.document.addEventListener("contextmenu", (contextEvent) => {
			contextEvent.preventDefault();
		});
		setSoundEnabled(this.#settings.isSoundEnabled);

		this.changeScreen(Screen.title);
	}

	//==============================================================================
	// 화면 등록. (같은 이름이면 나중 것이 이깁니다, 게임끼리는 접두사로 갈립니다)
	//==============================================================================
	/**
	 * @param { string } screenKey
	 * @param { object } screen
	 */
	registerScreen(screenKey, screen) {
		this.#screens[screenKey] = screen;
	}

	//==============================================================================
	// 로딩 중 출력. (바탕만, 글꼴이 오기 전에는 글자를 찍지 않습니다)
	//==============================================================================
	/**
	 * @override
	 * @param { object } graphic
	 */
	drawOnLoad(graphic) {
		const engine = this.getEngine();
		if (engine === null || engine === undefined) {
			return;
		}
		const viewManager = engine.getViewManager();
		this.drawOutsideAndView(graphic, viewManager);
		if (this.#loadedRatio >= 0.3) {
			drawText(graphic, "불러오는 중", REFERENCE_RESOLUTION_WIDTH * 0.5, REFERENCE_RESOLUTION_HEIGHT * 0.5, UiFontSize.small, Colors.textDim, "center");
		}
	}

	//==============================================================================
	// 게임 화면 밖과 안을 칠함. (창 비율이 기준과 다르면 남는 자리를 검게, 바탕은 종이입니다)
	//==============================================================================
	/**
	 * @param { object } graphic
	 * @param { object } viewManager
	 */
	drawOutsideAndView(graphic, viewManager) {
		viewManager.applyCanvasNativeRect(graphic);
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const outsideColor = getColor(Colors.outside);
		graphic.setFillColor(outsideColor);
		graphic.drawRect(readRect(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		viewManager.applyViewRect(graphic);
		const viewSize = viewManager.getViewSize();
		const backgroundColor = getColor(Colors.background);
		graphic.setFillColor(backgroundColor);
		graphic.drawRect(readRect(0, 0, viewSize.x, viewSize.y));
	}

	//==============================================================================
	// 화면 전환. (켜진 화면은 하나뿐입니다)
	//==============================================================================
	/**
	 * @param { string } screenKey
	 */
	changeScreen(screenKey) {
		const screen = this.#screens[screenKey];
		if (screen === undefined) {
			console.error("[main] 없는 화면입니다: " + screenKey);
			return;
		}
		const previousScreen = this.#screens[this.#currentScreenKey];
		if (previousScreen !== undefined) {
			previousScreen.onLeave();
		}
		const screenKeys = System.Object.keys(this.#screens);
		for (const otherKey of screenKeys) {
			this.#screens[otherKey].setActive(otherKey === screenKey);
		}
		this.#currentScreenKey = screenKey;
		this.#commandReader.clear();
		screen.onEnter();
	}

	//==============================================================================
	// 지금 화면 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getCurrentScreen() {
		const currentScreen = this.#screens[this.#currentScreenKey];
		if (currentScreen === undefined) {
			return null;
		}
		return currentScreen;
	}

	/** @returns { string } */
	getCurrentScreenKey() {
		return this.#currentScreenKey;
	}

	//==============================================================================
	// 게임 모듈. (이 프로젝트가 만드는 게임 한 편입니다)
	//==============================================================================
	/** @returns { object } */
	getGameModule() {
		return this.#gameModule;
	}

	//==============================================================================
	// 길 찾기. (타이틀, 게임, 설정)
	//==============================================================================
	goTitle() {
		stopMusic();
		setPaletteRemap(null);
		// 게임이 제 말에 맞춰 갈아 끼운 글꼴도 함께 되돌립니다. 타이틀은 늘 본디 글꼴입니다.
		setFontOverrides(null);
		setDisplayPaperColor(resolveRemapColorString(Colors.background));
		this.changeScreen(Screen.title);
	}

	//==============================================================================
	// 게임 시작. (타이틀에서 확인을 누르면 옵니다)
	//==============================================================================
	enterGame() {
		const gameModule = this.#gameModule;
		if (gameModule === null) {
			return;
		}
		const palette = gameModule.getPalette();
		setPaletteRemap(palette === null ? null : buildPaletteRemap(palette));
		setDisplayPaperColor(resolveRemapColorString(Colors.background));
		gameModule.onEnter();
		this.changeScreen(gameModule.getId() + ":" + gameModule.getEntryKey());
		// 게임에 들어설 때는 옛날식으로 화면이 점 무늬로 차오릅니다.
		startScreenReveal();
	}

	openSettings() {
		this.#settingsReturnKey = this.#currentScreenKey;
		this.changeScreen(Screen.settings);
	}

	closeSettings() {
		this.changeScreen(this.#settingsReturnKey);
	}

	//==============================================================================
	// 설정.
	//==============================================================================
	/** @returns { object } */
	getSettings() {
		return this.#settings;
	}

	//==============================================================================
	// 명령을 지금 누르고 있는지. (실시간 게임이 매 프레임 읽습니다)
	//==============================================================================
	/**
	 * @param { string } command
	 * @returns { boolean }
	 */
	isCommandHeld(command) {
		const isHeld = this.#commandReader.isHeld(command);
		return isHeld;
	}

	//==============================================================================
	// 가리킨 곳 처리. (창 좌표 → 게임 좌표 → 지금 화면)
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 * @returns { boolean } 화면이 받았는지.
	 */
	handlePointerAt(clientX, clientY) {
		const screen = this.getCurrentScreen();
		if (screen === null) {
			return false;
		}
		const point = mapWindowPointToGame(clientX, clientY);
		if (point === null) {
			return false;
		}
		const result = screen.handlePointerPress(point.x, point.y);
		if (result === "confirm") {
			screen.handleCommand(Command.confirm);
			return true;
		}
		if (result === "select") {
			beepMove();
			return true;
		}
		return false;
	}

	applySettings() {
		writeSettings(this.#settings);
		setSoundEnabled(this.#settings.isSoundEnabled);
		setDisplayColorMode(this.#settings.monitorColors === undefined ? "256" : this.#settings.monitorColors);
		// 볼록 효과는 모니터 안에서만 뜻이 있습니다. 프레임을 끄면 같이 꺼집니다. (사용자 지시, 2026-09-10)
		const isFrameShown = this.#settings.isMonitorFrameEnabled !== false;
		const curveScale = isFrameShown ? readCurveScale(this.#settings.curveLevel) : 0;
		applyCrtOptions(isFrameShown, curveScale);
		// 프레임을 켜고 끈 뒤에 캔버스 크기를 다시 잡습니다. (덮개가 보여 주면 기준 크기 그대로 둡니다)
		selectDisplayMode(this.#settings.displayMode);
	}

	//==============================================================================
	// 모니터 색을 앞뒤로 돌리기. (F9 가 앞, F10 이 뒤, 끝에 이르면 반대쪽 끝으로 돌아옵니다)
	//==============================================================================
	/**
	 * @param { number } direction
	 */
	cycleMonitorColor(direction) {
		let optionIndex = 0;
		for (let index = 0; index < MonitorColorOptions.length; ++index) {
			if (MonitorColorOptions[index].id === this.#settings.monitorColors) {
				optionIndex = index;
			}
		}
		const optionCount = MonitorColorOptions.length;
		const step = direction === undefined ? 1 : direction;
		optionIndex = (optionIndex + step + optionCount) % optionCount;
		this.#settings.monitorColors = MonitorColorOptions[optionIndex].id;
		this.applySettings();
		beepMove();
	}

	resetSettings() {
		const defaultSettings = createDefaultSettings();
		const settingKeys = System.Object.keys(defaultSettings);
		for (const settingKey of settingKeys) {
			this.#settings[settingKey] = defaultSettings[settingKey];
		}
		this.applySettings();
	}

	eraseProgress() {
		clearAllGameData();
		if (this.#gameModule !== null) {
			this.#gameModule.onProgressErased();
		}
	}

	//==============================================================================
	// 갱신. (명령 읽기 → 켜진 화면에 넘김)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		tickUiTime(timeDelta);
		advanceScreenReveal(timeDelta);
		const engine = this.getEngine();
		this.#commandReader.tick(engine, timeDelta);
		const commands = this.#commandReader.drainCommands();
		for (const command of commands) {
			// 볼록 확인 격자를 켠 동안에는 화면이 덮이므로, 확인이나 취소 한 번으로 되돌립니다.
			if (this.#settings.isTestGridEnabled === true) {
				if (command === Command.confirm || command === Command.cancel || command === Command.menu) {
					this.#settings.isTestGridEnabled = false;
					this.applySettings();
					continue;
				}
			}
			const currentScreen = this.getCurrentScreen();
			if (currentScreen === null) {
				break;
			}
			currentScreen.handleCommand(command);
		}
		super.tick(timeDelta);
	}

	//==============================================================================
	// 창 크기 변화.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } canvasNativeSize
	 */
	resize(canvasNativeSize) {
		super.resize(canvasNativeSize);
		const engine = this.getEngine();
		if (engine === null || engine === undefined) {
			return;
		}
		const viewManager = engine.getViewManager();
		applyPixelFixedScale(viewManager);
	}

	//==============================================================================
	// 출력. (바탕 → 노드 트리)
	//==============================================================================
	/**
	 * @override
	 * @param { object } graphic
	 */
	draw(graphic) {
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		this.drawOutsideAndView(graphic, viewManager);
		super.draw(graphic);
		// 볼록 효과를 눈으로 재는 체크무늬. (설정에서 켤 때만)
		if (this.#settings.isTestGridEnabled === true) {
			drawTestGrid(graphic);
		}
		// 지금 쓰는 입력 장치 아이콘. 평소에는 덮개가 모니터 프레임 자리에 얹으므로,
		// 덮개를 못 쓰는 자리에서만 게임 화면 오른쪽 아래에 그립니다.
		if (!isCrtOverlayActive()) {
			const inputSource = readInputSource();
			drawInputIcon(graphic, inputSource);
		}
	}
}


//==============================================================================
// 볼록 세기 값 읽기. (모르는 값이면 가장 센 것)
//==============================================================================
/**
 * @param { string } levelId
 * @returns { number } 0 부터 1 까지.
 */
function readCurveScale(levelId) {
	for (const option of CurveLevelOptions) {
		if (option.id === levelId) {
			return option.scale;
		}
	}
	return 1;
}


//==============================================================================
// 엔진 기동. (가로 전용 1280 x 800, 스팀덱)
//==============================================================================
const engineConfiguration = new EngineConfiguration();
// 엔진이 계속 들고 있는 값이라 빌린 벡터를 주면 안 됩니다.
engineConfiguration.referenceResolutionSize = Vector2.create(REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT);
engineConfiguration.useStatistics = false;
// 브라운관 필터가 게임 캔버스의 그림을 읽어 씁니다. 그래서 프레임이 끝난 뒤에도 남겨 둡니다.
engineConfiguration.preserveDrawingBuffer = true;
const engine = new Engine(engineConfiguration);
System.document.title = GAME_TITLE;
const scene = new GameScene();
engine.run(scene);
// 검증 스크립트(헤드리스 크롬)가 씬의 노드를 읽을 수 있게 엔진을 페이지에 둡니다.
System.window.engine = engine;

// 화면 모드. (설정에 저장된 것, PageUp / PageDown 으로 개발 확인용 순환)
const startupSettings = readSettings();
const gameCanvas = engine.getViewManager().getCanvas();
attachCrt(gameCanvas, REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT);
setDisplayPaperColor(Colors.background);
setDisplayColorMode(startupSettings.monitorColors === undefined ? "256" : startupSettings.monitorColors);
const isStartupFrameShown = startupSettings.isMonitorFrameEnabled !== false;
applyCrtOptions(isStartupFrameShown, isStartupFrameShown ? readCurveScale(startupSettings.curveLevel) : 0);
initializeDisplayModes(engine, startupSettings.displayMode);
