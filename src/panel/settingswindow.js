//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ScreenNode } from "../ui/screennode.js";
import { ListNode } from "../ui/listnode.js";
import { placeNode, moveNode } from "../ui/layout.js";
import { drawText } from "../game/text.js";
import { Command } from "../game/command.js";
import { beepMove, beepConfirm, beepCancel, beepBlocked } from "../game/beep.js";
import { Colors, UiFontSize, REFERENCE_RESOLUTION_WIDTH, DisplayModeOptions, MonitorColorOptions, CurveLevelOptions } from "../game/constants.js";


//==============================================================================
// 설정. (게임 항목 + 소리, 화면, 진행 지우기, 닫기)
//
// **설정 화면은 이 하나입니다.** 게임이 따로 설정 화면을 만들지 않습니다.
// 게임만의 항목은 `GameModule.createSettingItems()` 로 내면 이 목록 앞에 함께 섭니다.
// 타이틀에서 열든 게임 안에서 열든 같은 화면입니다.
//
// 값은 좌우로 바꿉니다. 확인도 다음 값으로 넘깁니다.
// 진행 지우기는 되돌릴 수 없어서 두 번 눌러야 합니다. (한 번 누르면 항목 이름이 "정말 지우기" 로 바뀝니다)
//==============================================================================


const TITLE_CENTER_Y = 76;
const LIST_TOP_Y = 148;
const LIST_WIDTH = 520;
// 한 번에 보일 줄 수. 게임이 제 항목을 더하면 목록이 길어지므로 여기까지만 보이고 넘깁니다.
const LIST_VISIBLE_ROWS = 10;
const HINT_TEXT = "방향키 고르기, 좌우 바꾸기, 취소 돌아가기";


//==============================================================================
// 볼록 효과 칸에 적을 말.
//
// 볼록 효과는 모니터 안에서만 뜻이 있습니다. 프레임을 끄면 고를 수 없습니다.
//==============================================================================
/**
 * @param { object } settings
 * @returns { string }
 */
function readCurveKey(settings) {
	if (settings.isMonitorFrameEnabled === false) {
		return "unavailable";
	}
	return settings.curveLevel;
}

/**
 * @param { object } settings
 * @returns { string }
 */
function readCurveText(settings) {
	if (settings.isMonitorFrameEnabled === false) {
		return "쓸 수 없음";
	}
	for (const option of CurveLevelOptions) {
		if (option.id === settings.curveLevel) {
			return option.name;
		}
	}
	return CurveLevelOptions[CurveLevelOptions.length - 1].name;
}


export class SettingsWindow extends ScreenNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ListNode } */ #list;
	/** @private @type { boolean } */ #isEraseArmed;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } scene
	 */
	constructor(scene) {
		super(scene, "settingsWindow");
		this.#isEraseArmed = false;
		this.#list = new ListNode();
		this.#list.setName("settings:list");
		this.#list.setTier(UiFontSize.medium);
		placeNode(this.#list, System.Math.round((REFERENCE_RESOLUTION_WIDTH - LIST_WIDTH) * 0.5), LIST_TOP_Y, LIST_WIDTH, 0);
		this.#list.setSelectHandler((itemId) => {
			this.handleItem(itemId, 1);
		});
		this.#list.setChangeHandler((itemId, direction) => {
			this.handleItem(itemId, direction);
		});
		this.addChild(this.#list);
		this.refreshItems();
	}

	//==============================================================================
	// 화면 진입.
	//==============================================================================
	/**
	 * @override
	 */
	onEnter() {
		super.onEnter();
		this.#isEraseArmed = false;
		this.#list.setSelectedIndex(0);
		this.refreshItems();
	}

	//==============================================================================
	// 항목 다시 만들기. (값을 읽어 옵니다)
	//==============================================================================
	refreshItems() {
		const settings = this.getScene().getSettings();
		let monitorColorName = MonitorColorOptions[0].name;
		for (const option of MonitorColorOptions) {
			if (option.id === settings.monitorColors) {
				monitorColorName = option.name;
			}
		}
		let displayModeName = DisplayModeOptions[0].name;
		for (const option of DisplayModeOptions) {
			if (option.id === settings.displayMode) {
				displayModeName = option.name;
			}
		}
		const selectedIndex = this.#list.getSelectedIndex();
		// 게임만의 항목을 앞에 세웁니다. 그 게임이 다루는 것이 먼저 보이는 편이 자연스럽습니다.
		const gameModule = this.getScene().getGameModule();
		const gameItems = gameModule === null ? [] : gameModule.createSettingItems();
		const frameItems = [
			{ id: "sound", valueKey: settings.isSoundEnabled ? "on" : "off", label: "소리", valueText: settings.isSoundEnabled ? "켬" : "끔" },
			{ id: "display", valueKey: settings.displayMode, label: "화면", valueText: displayModeName },
			{ id: "frame", valueKey: settings.isMonitorFrameEnabled === false ? "off" : "on", label: "모니터 프레임", valueText: settings.isMonitorFrameEnabled === false ? "끔" : "켬" },
			{ id: "curve", valueKey: readCurveKey(settings), label: "볼록 효과", valueText: readCurveText(settings) },
			{ id: "colors", valueKey: settings.monitorColors, label: "모니터 색", valueText: monitorColorName },
			{ id: "grid", label: "볼록 확인 격자" },
			{ id: "reset", label: "설정 초기화" },
			{ id: "erase", label: this.#isEraseArmed ? "정말 초기화" : "데이터 초기화" },
			{ id: "close", label: "닫기" },
		];
		// 여러 말을 지원하는 게임은 틀 항목의 이름과 값도 제 말로 바꿔 답합니다.
		if (gameModule !== null) {
			for (const frameItem of frameItems) {
				frameItem.label = gameModule.readSettingLabel(frameItem.id, frameItem.label);
				if (frameItem.valueKey !== undefined) {
					frameItem.valueText = gameModule.readSettingValue(frameItem.id, frameItem.valueKey, frameItem.valueText);
				}
			}
		}
		this.#list.setVisibleRowCount(LIST_VISIBLE_ROWS);
		this.#list.setItems(gameItems.concat(frameItems));
		this.#list.setSelectedIndex(selectedIndex);
		placeNode(this.#list, System.Math.round((REFERENCE_RESOLUTION_WIDTH - LIST_WIDTH) * 0.5), LIST_TOP_Y, LIST_WIDTH, this.#list.readTotalHeight());
	}

	//==============================================================================
	// 항목 처리. (direction 은 좌우, 확인은 1)
	//==============================================================================
	/**
	 * @param { string } itemId
	 * @param { number } direction
	 */
	handleItem(itemId, direction) {
		const scene = this.getScene();
		const settings = scene.getSettings();
		// 게임이 낸 항목이면 게임이 처리합니다.
		const gameModule = scene.getGameModule();
		if (gameModule !== null) {
			const isHandled = gameModule.handleSettingItem(itemId, direction);
			if (isHandled) {
				this.refreshItems();
				return;
			}
		}
		switch (itemId) {
			case "sound": {
				settings.isSoundEnabled = !settings.isSoundEnabled;
				scene.applySettings();
				break;
			}
			case "display": {
				let optionIndex = 0;
				for (let index = 0; index < DisplayModeOptions.length; ++index) {
					if (DisplayModeOptions[index].id === settings.displayMode) {
						optionIndex = index;
					}
				}
				const optionCount = DisplayModeOptions.length;
				optionIndex = (optionIndex + direction + optionCount) % optionCount;
				settings.displayMode = DisplayModeOptions[optionIndex].id;
				scene.applySettings();
				break;
			}
			case "frame": {
				settings.isMonitorFrameEnabled = settings.isMonitorFrameEnabled === false;
				scene.applySettings();
				break;
			}
			case "curve": {
				// 모니터 프레임이 꺼져 있으면 볼록 효과를 쓸 수 없습니다.
				if (settings.isMonitorFrameEnabled === false) {
					break;
				}
				let optionIndex = CurveLevelOptions.length - 1;
				for (let index = 0; index < CurveLevelOptions.length; ++index) {
					if (CurveLevelOptions[index].id === settings.curveLevel) {
						optionIndex = index;
					}
				}
				const optionCount = CurveLevelOptions.length;
				optionIndex = (optionIndex + direction + optionCount) % optionCount;
				settings.curveLevel = CurveLevelOptions[optionIndex].id;
				scene.applySettings();
				break;
			}
			case "grid": {
				// 켬 끔이 아니라 한 번 보여 주는 것입니다. 확인이나 취소를 누르면 되돌아옵니다.
				settings.isTestGridEnabled = true;
				scene.applySettings();
				break;
			}
			case "reset": {
				scene.resetSettings();
				break;
			}
			case "colors": {
				let optionIndex = 0;
				for (let index = 0; index < MonitorColorOptions.length; ++index) {
					if (MonitorColorOptions[index].id === settings.monitorColors) {
						optionIndex = index;
					}
				}
				const optionCount = MonitorColorOptions.length;
				optionIndex = (optionIndex + direction + optionCount) % optionCount;
				settings.monitorColors = MonitorColorOptions[optionIndex].id;
				scene.applySettings();
				break;
			}
			case "erase": {
				if (this.#isEraseArmed) {
					scene.eraseProgress();
					this.#isEraseArmed = false;
				}
				else {
					this.#isEraseArmed = true;
				}
				break;
			}
			case "close": {
				scene.closeSettings();
				break;
			}
			default: {
				break;
			}
		}
		this.refreshItems();
	}

	//==============================================================================
	// 명령 처리.
	//==============================================================================
	/**
	 * @override
	 * @param { string } command
	 */
	handleCommand(command) {
		if (command === Command.cancel || command === Command.menu) {
			beepCancel();
			this.getScene().closeSettings();
			return;
		}
		const wasArmed = this.#isEraseArmed;
		const result = this.#list.handleCommand(command);
		if (result === "move") {
			beepMove();
			// 다른 곳으로 가면 지우기 확인이 풀립니다.
			if (wasArmed) {
				this.#isEraseArmed = false;
				this.refreshItems();
			}
		}
		else if (result === "confirm" || result === "change") {
			beepConfirm();
		}
		else if (result === "blocked") {
			beepBlocked();
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { object } graphic
	 */
	draw(graphic) {
		const isVisible = this.isVisible();
		if (!isVisible) {
			return;
		}
		const offset = this.readEnterOffset();
		const gameModule = this.getScene().getGameModule();
		const titleText = gameModule === null ? "설정" : gameModule.readSettingText("title", "설정");
		drawText(graphic, titleText, REFERENCE_RESOLUTION_WIDTH * 0.5 + offset, TITLE_CENTER_Y, UiFontSize.huge, Colors.textPrimary, "center");
		moveNode(this.#list, System.Math.round((REFERENCE_RESOLUTION_WIDTH - LIST_WIDTH) * 0.5) + offset, LIST_TOP_Y);
		const hintText = gameModule === null ? HINT_TEXT : gameModule.readSettingText("hint", HINT_TEXT);
		this.drawHint(graphic, hintText);
		super.draw(graphic);
	}
}
