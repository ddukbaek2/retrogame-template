//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ScreenNode } from "../ui/screennode.js";
import { ListNode } from "../ui/listnode.js";
import { placeNode, moveNode } from "../ui/layout.js";
import { drawText } from "../game/text.js";
import { Command } from "../game/command.js";
import { beepMove, beepConfirm } from "../game/beep.js";
import { readUiElapsedSeconds } from "../ui/uitime.js";
import { Colors, UiFontSize, GAME_TITLE, REFERENCE_RESOLUTION_WIDTH } from "../game/constants.js";
import { isMaskImageLoaded, drawMaskImage } from "../game/sprite.js";


//==============================================================================
// 타이틀 화면. (제목 + 시작, 설정)
//
// 제목은 아주 천천히 위아래로 숨을 쉽니다. 그림이 없으니 글자가 곧 키 비주얼입니다.
//==============================================================================


const TITLE_CENTER_Y = 270;
const LIST_TOP_Y = 423;
const LIST_WIDTH = 240;
// 제목 숨쉬기. (픽셀, 초)
const BREATH_HEIGHT = 4;
const BREATH_PERIOD = 3.2;
const HINT_TEXT = "방향키 고르기, 확인 정하기";
// 제목 그림을 세울 높이. 도트가 깨지지 않게 정수 배로만 키웁니다.
const TITLE_IMAGE_HEIGHT = 128;
// 제목 그림을 들고 있는 이름. 씬이 이 이름으로 받아 둡니다.
export const TITLE_IMAGE_NAME = "title";


export class TitleScreen extends ScreenNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ListNode } */ #list;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } scene
	 */
	constructor(scene) {
		super(scene, "titleScreen");
		this.#list = new ListNode();
		this.#list.setName("title:list");
		this.#list.setTier(UiFontSize.medium);
		this.#list.setTextAlign("center");
		this.#list.setItems([
			{ id: "start", label: "시작" },
			{ id: "settings", label: "설정" },
		]);
		placeNode(this.#list, System.Math.round((REFERENCE_RESOLUTION_WIDTH - LIST_WIDTH) * 0.5), LIST_TOP_Y, LIST_WIDTH, this.#list.readTotalHeight());
		this.#list.setSelectHandler((itemId) => {
			if (itemId === "start") {
				scene.enterGame();
			}
			else if (itemId === "settings") {
				scene.openSettings();
			}
		});
		this.addChild(this.#list);
	}

	//==============================================================================
	// 화면 진입.
	//==============================================================================
	/**
	 * @override
	 */
	onEnter() {
		super.onEnter();
		this.#list.setSelectedIndex(0);
	}

	//==============================================================================
	// 명령 처리.
	//==============================================================================
	/**
	 * @override
	 * @param { string } command
	 */
	handleCommand(command) {
		// 타이틀에서는 START 도 고른 것을 정합니다. "PRESS START" 의 관례입니다. (사용자 지시, 2026-09-15)
		const effectiveCommand = command === Command.menu ? Command.confirm : command;
		const result = this.#list.handleCommand(effectiveCommand);
		if (result === "move") {
			beepMove();
		}
		else if (result === "confirm") {
			beepConfirm();
		}
	}

	//==============================================================================
	// 출력. (제목 → 목록)
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
		const breath = System.Math.round(System.Math.sin(readUiElapsedSeconds() * System.Math.PI * 2 / BREATH_PERIOD) * BREATH_HEIGHT);
		// 게임이 제목 그림을 냈으면 그것을 세웁니다. 없으면 이름을 글자로 씁니다.
		if (isMaskImageLoaded(TITLE_IMAGE_NAME)) {
			drawMaskImage(graphic, TITLE_IMAGE_NAME, REFERENCE_RESOLUTION_WIDTH * 0.5 + offset,
				TITLE_CENTER_Y + breath, TITLE_IMAGE_HEIGHT, Colors.textPrimary);
		}
		else {
			drawText(graphic, GAME_TITLE, REFERENCE_RESOLUTION_WIDTH * 0.5 + offset, TITLE_CENTER_Y + breath, UiFontSize.title, Colors.textPrimary, "center");
		}
		moveNode(this.#list, System.Math.round((REFERENCE_RESOLUTION_WIDTH - LIST_WIDTH) * 0.5) + offset, LIST_TOP_Y);
		this.drawHint(graphic, HINT_TEXT);
		super.draw(graphic);
	}
}
