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
import { Colors, UiFontSize, REFERENCE_RESOLUTION_WIDTH } from "../game/constants.js";
import { createFrameSettingItems, applyGameLabels, handleFrameSettingItem } from "./settingitems.js";


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
		const scene = this.getScene();
		const settings = scene.getSettings();
		const selectedIndex = this.#list.getSelectedIndex();
		// 앱 설정(소리, 화면, 모니터)이 먼저이고 그 게임만의 항목이 뒤에 섭니다.
		// 어느 게임을 열든 앞쪽이 같은 자리에 있어야 손이 기억합니다.
		// (사용자 지시, 2026-09-14, "소리 진동 화면 뭐 이런 순서가 맞는데 왜 게임내용 설정이 더 위에가있냐")
		const gameModule = scene.getGameModule();
		const gameItems = gameModule === null ? [] : gameModule.createSettingItems();
		const frameItems = createFrameSettingItems(settings, this.#isEraseArmed);
		applyGameLabels(frameItems, gameModule);
		const closeItem = { id: "close", label: "닫기" };
		applyGameLabels([closeItem], gameModule);
		this.#list.setVisibleRowCount(LIST_VISIBLE_ROWS);
		this.#list.setItems(frameItems.concat(gameItems, [closeItem]));
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
		if (itemId === "close") {
			scene.closeSettings();
			return;
		}
		const eraseState = { isArmed: this.#isEraseArmed };
		handleFrameSettingItem(scene, itemId, direction, eraseState);
		this.#isEraseArmed = eraseState.isArmed;
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
