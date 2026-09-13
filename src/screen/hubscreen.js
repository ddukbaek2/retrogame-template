//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ScreenNode } from "../ui/screennode.js";
import { ListNode } from "../ui/listnode.js";
import { placeNode, moveNode } from "../ui/layout.js";
import { drawText, measureTextWidth } from "../game/text.js";
import { Command } from "../game/command.js";
import { beepMove, beepConfirm, beepCancel, beepBlocked } from "../game/beep.js";
import { GAME_KIND_ORDER } from "../game/identity.js";
import { Colors, UiFontSize, GAME_TITLE, REFERENCE_RESOLUTION_WIDTH } from "../game/constants.js";
import { getColor } from "../game/palette.js";
import { readRect } from "../game/scratch.js";


//==============================================================================
// 게임 목록. (허브, 게임 한 편을 골라 들어갑니다)
//
// 갈래 셋으로 나눕니다. 왼쪽에 갈래 열(아케이드, 본격, 소품, src/game/identity.js 의 kind),
// 오른쪽에 고른 갈래의 게임들이 여러 열로. 갈래 열에서 상하로 갈래를 바꾸고
// 오른쪽(또는 확인)으로 게임 쪽에 초점을 옮깁니다. 게임 쪽 첫 열에서 왼쪽이면 갈래 열로 돌아옵니다.
// 고른 게임의 한 줄 설명이 아래에 나옵니다. 취소는 타이틀로.
//==============================================================================


const LIST_TOP_Y = 99;
const KIND_LEFT_X = 45;
const KIND_WIDTH = 165;
const GAME_LEFT_X = 280;
const GAME_WIDTH = 624;
// 한 열에 다 담기면 한 열입니다. 열은 위에서 아래로 채우고 다 차면 다음 열로 넘어갑니다.
const COLUMN_COUNT_MINIMUM = 1;
const COLUMN_COUNT_MAXIMUM = 3;
// 갈래 열과 게임 열을 가르는 세로 선.
const DIVIDER_X = 224;
const DIVIDER_WIDTH = 2;
const LIST_BOTTOM_LIMIT_Y = 600;
// 설명은 두 줄까지 접습니다. 첫 줄이 위, 둘째 줄이 아래입니다.
const DESCRIBE_FIRST_Y = 622;
const DESCRIBE_LINE_HEIGHT = 26;
const DESCRIBE_SIDE_MARGIN = 56;
const HINT_TEXT = "상하 고르기, 좌우 갈래와 게임 오가기, 확인 들어가기, 취소 타이틀로";
// 초점이 있는 쪽. (0 = 갈래 열, 1 = 게임)
const FOCUS_KIND = 0;
const FOCUS_GAME = 1;


//==============================================================================
// 낱말 사이에서 줄 접기.
//
// 화면이 고정 크기(960 × 720)라 접는 자리는 늘 같습니다. 글자를 줄여 쓰거나 끝을 자르지 않고,
// 넘치면 다음 줄로 내립니다. (사용자 지적, 2026-09-10, "말이 길면 개행 처리를 해야 되는데 …이 나오고 있음")
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } text
 * @param { number } limitWidth
 * @param { number } fontTier
 * @returns { string[] }
 */
function foldText(graphic, text, limitWidth, fontTier) {
	const words = text.split(" ");
	const lines = [];
	let currentLine = "";
	for (let wordIndex = 0; wordIndex < words.length; ++wordIndex) {
		const word = words[wordIndex];
		const joinedLine = currentLine === "" ? word : currentLine + " " + word;
		const joinedWidth = measureTextWidth(graphic, joinedLine, fontTier);
		if (joinedWidth <= limitWidth || currentLine === "") {
			currentLine = joinedLine;
		}
		else {
			lines.push(currentLine);
			currentLine = word;
		}
	}
	if (currentLine !== "") {
		lines.push(currentLine);
	}
	return lines;
}


export class HubScreen extends ScreenNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ListNode } */ #kindList;
	/** @private @type { ListNode } */ #gameList;
	/** @private @type { number } */ #focusedListIndex;
	/** @private @type { object } */ #gamesByKind;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } scene
	 */
	constructor(scene) {
		super(scene, "hubScreen");
		this.#kindList = new ListNode();
		this.#kindList.setName("hub:kindList");
		this.#kindList.setTier(UiFontSize.small);
		this.#kindList.setColumnCount(1);
		placeNode(this.#kindList, KIND_LEFT_X, LIST_TOP_Y, KIND_WIDTH, 0);
		this.#kindList.setSelectHandler(() => {
			this.focusList(FOCUS_GAME);
		});
		this.#gameList = new ListNode();
		this.#gameList.setName("hub:gameList");
		this.#gameList.setTier(UiFontSize.small);
		this.#gameList.setColumnCount(COLUMN_COUNT_MINIMUM);
		placeNode(this.#gameList, GAME_LEFT_X, LIST_TOP_Y, GAME_WIDTH, 0);
		this.#gameList.setSelectHandler((itemId) => {
			scene.enterGame(itemId);
		});
		this.#focusedListIndex = FOCUS_KIND;
		this.#gamesByKind = {};
		this.addChild(this.#kindList);
		this.addChild(this.#gameList);
	}

	//==============================================================================
	// 화면 진입. (게임 목록을 다시 만듭니다)
	//==============================================================================
	/**
	 * @override
	 */
	onEnter() {
		super.onEnter();
		this.refreshItems();
	}

	//==============================================================================
	// 항목 다시 만들기. (갈래마다 게임을 나눠 담고, 갈래 열과 고른 갈래의 게임 열을 채웁니다)
	//==============================================================================
	refreshItems() {
		const modules = this.getScene().getGameModules();
		this.#gamesByKind = {};
		for (const kindEntry of GAME_KIND_ORDER) {
			this.#gamesByKind[kindEntry.kind] = [];
		}
		for (const module of modules) {
			const kind = module.getKind();
			if (this.#gamesByKind[kind] === undefined) {
				this.#gamesByKind[kind] = [];
			}
			this.#gamesByKind[kind].push({ id: module.getId(), label: module.getName() });
		}
		const kindItems = [];
		for (const kindEntry of GAME_KIND_ORDER) {
			const games = this.#gamesByKind[kindEntry.kind];
			if (games.length === 0) {
				continue;
			}
			kindItems.push({ id: kindEntry.kind, label: kindEntry.label, valueText: System.String(games.length) });
		}
		const kindSelectedIndex = this.#kindList.getSelectedIndex();
		this.#kindList.setItems(kindItems);
		this.#kindList.setSelectedIndex(kindSelectedIndex);
		placeNode(this.#kindList, KIND_LEFT_X, LIST_TOP_Y, KIND_WIDTH, this.#kindList.readTotalHeight());
		this.refreshGameItems();
		this.applyFocus();
	}

	//==============================================================================
	// 고른 갈래의 게임 열 채우기. (열 수는 편 수와 남은 높이로)
	//==============================================================================
	refreshGameItems() {
		const kindId = this.#kindList.getSelectedId();
		const games = kindId === null ? [] : this.#gamesByKind[kindId];
		const gameItems = games === undefined ? [] : games;
		const lineHeight = this.#gameList.getLineHeight();
		const availableHeight = LIST_BOTTOM_LIMIT_Y - LIST_TOP_Y;
		const rowLimit = System.Math.max(1, System.Math.floor(availableHeight / lineHeight));
		const neededColumnCount = System.Math.ceil(gameItems.length / rowLimit);
		const columnCount = System.Math.min(COLUMN_COUNT_MAXIMUM, System.Math.max(COLUMN_COUNT_MINIMUM, neededColumnCount));
		const gameSelectedIndex = this.#gameList.getSelectedIndex();
		this.#gameList.setColumnCount(columnCount);
		// 네 열에도 다 담기지 않으면 커서를 따라 다음 쪽으로 넘어갑니다.
		this.#gameList.setVisibleRowCount(rowLimit);
		// 열을 못박아 두었으니 가로부터 채우고 스크롤은 줄 단위입니다.
		this.#gameList.setRowMajor(true);
		this.#gameList.setItems(gameItems);
		this.#gameList.setSelectedIndex(gameSelectedIndex);
		placeNode(this.#gameList, GAME_LEFT_X, LIST_TOP_Y, GAME_WIDTH, this.#gameList.readTotalHeight());
	}

	//==============================================================================
	// 초점.
	//==============================================================================
	/**
	 * @param { number } listIndex FOCUS_KIND | FOCUS_GAME
	 */
	focusList(listIndex) {
		this.#focusedListIndex = listIndex;
		this.applyFocus();
	}

	applyFocus() {
		this.#kindList.setFocused(this.#focusedListIndex === FOCUS_KIND);
		this.#gameList.setFocused(this.#focusedListIndex === FOCUS_GAME);
	}

	//==============================================================================
	// 고른 게임을 미리 맞춰 둠. (게임에서 나올 때, 검증 스크립트)
	//==============================================================================
	/**
	 * @param { string } gameId
	 */
	selectGame(gameId) {
		const kindItems = this.#kindList.getItems();
		for (let kindIndex = 0; kindIndex < kindItems.length; ++kindIndex) {
			const games = this.#gamesByKind[kindItems[kindIndex].id];
			for (let gameIndex = 0; gameIndex < games.length; ++gameIndex) {
				if (games[gameIndex].id === gameId) {
					this.#kindList.setSelectedIndex(kindIndex);
					this.refreshGameItems();
					this.#gameList.setSelectedIndex(gameIndex);
					this.focusList(FOCUS_GAME);
					return;
				}
			}
		}
	}

	/** @returns { string } 지금 고른 게임 id. (없으면 null) */
	getSelectedGameId() {
		const selectedId = this.#gameList.getSelectedId();
		return selectedId;
	}

	/** @returns { number } 고른 갈래 안에서의 순번. */
	getSelectedIndex() {
		return this.#gameList.getSelectedIndex();
	}

	/** @returns { number } 게임 열의 열 수. */
	getColumnCount() {
		const columnCount = this.#gameList.getColumnCount();
		return columnCount;
	}

	//==============================================================================
	// 게임 열에서 고른 항목의 열 번호. (첫 열에서 왼쪽이면 갈래 열로)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readGameColumnIndex() {
		const rowsPerColumn = this.#gameList.readRowsPerColumn();
		const selectedIndex = this.#gameList.getSelectedIndex();
		return System.Math.floor(selectedIndex / rowsPerColumn);
	}

	//==============================================================================
	// 가리킨 곳 처리. (갈래 열이면 그 갈래로, 게임 열이면 그 게임으로)
	//==============================================================================
	/**
	 * @override
	 * @param { number } pointX
	 * @param { number } pointY
	 * @returns { string }
	 */
	handlePointerPress(pointX, pointY) {
		const kindIndex = this.#kindList.findItemIndexAt(pointX, pointY);
		if (kindIndex >= 0) {
			const beforeIndex = this.#kindList.getSelectedIndex();
			this.#kindList.setSelectedIndex(kindIndex);
			this.focusList(FOCUS_KIND);
			if (kindIndex !== beforeIndex) {
				this.#gameList.setSelectedIndex(0);
				this.refreshGameItems();
			}
			return "select";
		}
		const gameIndex = this.#gameList.findItemIndexAt(pointX, pointY);
		if (gameIndex >= 0) {
			this.#gameList.setSelectedIndex(gameIndex);
			this.focusList(FOCUS_GAME);
			return "confirm";
		}
		return "none";
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
			this.getScene().goTitle();
			return;
		}
		if (this.#focusedListIndex === FOCUS_KIND) {
			if (command === Command.right) {
				const gameItems = this.#gameList.getItems();
				if (gameItems.length === 0) {
					beepBlocked();
					return;
				}
				this.focusList(FOCUS_GAME);
				beepMove();
				return;
			}
			if (command === Command.left) {
				return;
			}
			const beforeIndex = this.#kindList.getSelectedIndex();
			const result = this.#kindList.handleCommand(command);
			if (result === "move") {
				beepMove();
				if (this.#kindList.getSelectedIndex() !== beforeIndex) {
					this.#gameList.setSelectedIndex(0);
					this.refreshGameItems();
				}
			}
			else if (result === "confirm") {
				beepConfirm();
			}
			return;
		}
		if (command === Command.left && this.readGameColumnIndex() === 0) {
			this.focusList(FOCUS_KIND);
			beepMove();
			return;
		}
		const result = this.#gameList.handleCommand(command);
		if (result === "move") {
			beepMove();
		}
		else if (result === "confirm") {
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
		const modules = this.getScene().getGameModules();
		this.drawHeader(graphic, GAME_TITLE, "게임 " + modules.length);
		moveNode(this.#kindList, KIND_LEFT_X + offset, LIST_TOP_Y);
		moveNode(this.#gameList, GAME_LEFT_X + offset, LIST_TOP_Y);
		// 갈래 열과 게임 열을 가르는 세로 선.
		const dividerColor = getColor(Colors.textFaint);
		graphic.setFillColor(dividerColor);
		const dividerRect = readRect(DIVIDER_X + offset, LIST_TOP_Y, DIVIDER_WIDTH, LIST_BOTTOM_LIMIT_Y - LIST_TOP_Y);
		graphic.drawRect(dividerRect);
		const selectedGameId = this.getSelectedGameId();
		const selectedModule = selectedGameId === null ? null : this.getScene().findGameModule(selectedGameId);
		if (selectedModule !== null) {
			// 설명이 길면 낱말 사이에서 접어 두 줄로 놓습니다. (줄여 쓰거나 끝을 자르지 않습니다)
			const describeText = selectedModule.getDescribe();
			const describeLimit = REFERENCE_RESOLUTION_WIDTH - DESCRIBE_SIDE_MARGIN * 2;
			const describeLines = foldText(graphic, describeText, describeLimit, UiFontSize.small);
			for (let lineIndex = 0; lineIndex < describeLines.length; ++lineIndex) {
				const lineY = DESCRIBE_FIRST_Y + lineIndex * DESCRIBE_LINE_HEIGHT;
				drawText(graphic, describeLines[lineIndex], REFERENCE_RESOLUTION_WIDTH * 0.5 + offset, lineY, UiFontSize.small, Colors.textDim, "center");
			}
		}
		this.drawHint(graphic, HINT_TEXT);
		super.draw(graphic);
	}
}
