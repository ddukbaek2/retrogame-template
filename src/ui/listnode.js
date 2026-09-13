//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { drawText, readLineHeight } from "../game/text.js";
import { approachValue } from "../game/motion.js";
import { readUiElapsedSeconds } from "./uitime.js";
import { Command } from "../game/command.js";
import { Colors, UiFontSize, CURSOR_FOLLOW_RATE, LIST_SELECT_SHIFT, CURSOR_BLINK_PERIOD } from "../game/constants.js";


//==============================================================================
// 세로 목록.
//
// 위아래로 고르고 확인으로 정합니다. 고른 항목은 강조색이 되고 오른쪽으로 밀립니다.
// 왼쪽의 ">" 는 글자 커서입니다. (색으로만 알 수 없는 사람을 위해 글자로도 말합니다)
// 항목에 값(valueText)이 있으면 오른쪽 끝에 적고, 좌우로 바꿀 수 있습니다.
//==============================================================================


// 커서 글자와 항목 사이 틈.
const CURSOR_GAP = 30;
// 열이 둘 이상일 때 값과 다음 열 사이에 두는 여백.
const VALUE_RIGHT_PADDING = 60;


export class ListNode extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #items;
	/** @private @type { number } */ #selectedIndex;
	/** @private @type { number[] } */ #shifts;
	/** @private @type { object } */ #tier;
	/** @private @type { number } */ #lineHeight;
	/** @private @type { string } */ #textAlign;
	/** @private @type { Function } */ #selectHandler;
	/** @private @type { Function } */ #changeHandler;
	/** @private @type { number } */ #columnCount;
	/** @private @type { number } */ #visibleRowCount;
	/** @private @type { boolean } */ #isRowMajor;
	/** @private @type { number } */ #firstVisibleRow;
	/** @private @type { boolean } */ #isFocused;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setPivot(Pivot.topLeft);
		this.setAnchor(Pivot.topLeft);
		this.#items = [];
		this.#selectedIndex = 0;
		this.#shifts = [];
		this.#tier = UiFontSize.small;
		this.#lineHeight = readLineHeight(UiFontSize.small) + 6;
		this.#textAlign = "left";
		this.#selectHandler = null;
		this.#changeHandler = null;
		this.#columnCount = 1;
		this.#visibleRowCount = 0;
		this.#isRowMajor = false;
		this.#firstVisibleRow = 0;
		this.#isFocused = true;
	}

	//==============================================================================
	// 항목 지정. ({ id, label, valueText?, isEnabled? })
	//==============================================================================
	/**
	 * @param { object[] } items
	 */
	setItems(items) {
		this.#items = items;
		this.#shifts = [];
		for (let itemIndex = 0; itemIndex < items.length; ++itemIndex) {
			this.#shifts.push(0);
		}
		if (this.#selectedIndex >= items.length) {
			this.#selectedIndex = items.length > 0 ? items.length - 1 : 0;
		}
	}

	/** @returns { object[] } */
	getItems() {
		return this.#items;
	}

	//==============================================================================
	// 글자 크기 티어 지정. (줄 높이가 따라 바뀝니다)
	//==============================================================================
	/**
	 * @param { object } tier
	 */
	setTier(tier) {
		this.#tier = tier;
		this.#lineHeight = readLineHeight(tier) + 6;
	}

	/** @returns { object } */
	getTier() {
		return this.#tier;
	}

	/** @returns { number } */
	getLineHeight() {
		return this.#lineHeight;
	}

	//==============================================================================
	// 열 수 지정. (둘 이상이면 항목을 열마다 위에서 아래로 채우고, 좌우로 열을 옮깁니다)
	//==============================================================================
	/**
	 * @param { number } columnCount
	 */
	setColumnCount(columnCount) {
		this.#columnCount = System.Math.max(1, columnCount);
	}

	/** @returns { number } */
	getColumnCount() {
		return this.#columnCount;
	}

	//==============================================================================
	// 초점 지정. (화면에 목록이 둘 이상일 때, 초점이 없는 목록은 고른 항목을 밀거나 강조하지 않습니다)
	//==============================================================================
	/**
	 * @param { boolean } isFocused
	 */
	setFocused(isFocused) {
		this.#isFocused = isFocused;
	}

	/** @returns { boolean } */
	isFocused() {
		return this.#isFocused;
	}

	//==============================================================================
	// 한 번에 보일 줄 수 지정. (0 이면 다 보입니다)
	//
	// 화면에 담기는 것보다 항목이 많으면 커서를 따라 다음 쪽으로 넘어갑니다.
	//==============================================================================
	/**
	 * @param { number } visibleRowCount
	 */
	setVisibleRowCount(visibleRowCount) {
		this.#visibleRowCount = System.Math.max(0, visibleRowCount);
	}

	//==============================================================================
	// 열 하나에 들어가는 줄 수. (보일 줄 수를 정해 두었으면 거기까지만)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readRowsPerColumn() {
		const filledRowCount = System.Math.max(1, System.Math.ceil(this.#items.length / this.#columnCount));
		if (this.#visibleRowCount > 0 && filledRowCount > this.#visibleRowCount) {
			return this.#visibleRowCount;
		}
		return filledRowCount;
	}

	//==============================================================================
	// 채우는 차례 지정. (참이면 가로부터 채우고 스크롤은 줄 단위입니다)
	//
	// 열을 몇 개로 못박아 두고 줄이 넘칠 때 쓰는 방식입니다. 항목은 왼쪽에서 오른쪽으로 채우고,
	// 커서가 보이는 줄 밖으로 나가면 그 줄만큼 미끄러집니다. (사용자 지적, 2026-09-10)
	//==============================================================================
	/**
	 * @param { boolean } isRowMajor
	 */
	setRowMajor(isRowMajor) {
		this.#isRowMajor = isRowMajor;
	}

	/** @returns { boolean } */
	isRowMajor() {
		return this.#isRowMajor;
	}

	//==============================================================================
	// 항목이 채우는 줄 수. (보이는 줄 수와 상관없이 다 세었을 때)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readFilledRowCount() {
		return System.Math.max(1, System.Math.ceil(this.#items.length / this.#columnCount));
	}

	//==============================================================================
	// 한 번에 보이는 줄 수.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readVisibleRowCount() {
		const filledRowCount = this.readFilledRowCount();
		if (this.#visibleRowCount > 0 && filledRowCount > this.#visibleRowCount) {
			return this.#visibleRowCount;
		}
		return filledRowCount;
	}

	//==============================================================================
	// 맨 위에 보이는 줄 번호. (고른 항목이 늘 보이게 따라갑니다)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readFirstVisibleRow() {
		const filledRowCount = this.readFilledRowCount();
		const visibleRowCount = this.readVisibleRowCount();
		const maximumFirstRow = System.Math.max(0, filledRowCount - visibleRowCount);
		let firstRow = System.Math.min(this.#firstVisibleRow, maximumFirstRow);
		const selectedRow = this.#isRowMajor
			? System.Math.floor(this.#selectedIndex / this.#columnCount)
			: this.#selectedIndex % System.Math.max(1, visibleRowCount);
		if (selectedRow < firstRow) {
			firstRow = selectedRow;
		}
		if (selectedRow >= firstRow + visibleRowCount) {
			firstRow = selectedRow - visibleRowCount + 1;
		}
		this.#firstVisibleRow = System.Math.max(0, System.Math.min(maximumFirstRow, firstRow));
		return this.#firstVisibleRow;
	}

	//==============================================================================
	// 지금 쪽의 첫 항목 번호. (세로부터 채울 때, 고른 항목이 든 쪽을 보여 줍니다)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readPageStart() {
		const rowsPerColumn = this.readRowsPerColumn();
		const pageSize = rowsPerColumn * this.#columnCount;
		const pageIndex = System.Math.floor(this.#selectedIndex / pageSize);
		return pageIndex * pageSize;
	}

	//==============================================================================
	// 가로 정렬 지정. ("left" | "center")
	//==============================================================================
	/**
	 * @param { string } textAlign
	 */
	setTextAlign(textAlign) {
		this.#textAlign = textAlign;
	}

	//==============================================================================
	// 고른 항목.
	//==============================================================================
	/**
	 * @param { number } selectedIndex
	 */
	setSelectedIndex(selectedIndex) {
		if (this.#items.length === 0) {
			this.#selectedIndex = 0;
			return;
		}
		this.#selectedIndex = System.Math.max(0, System.Math.min(this.#items.length - 1, selectedIndex));
	}

	/** @returns { number } */
	getSelectedIndex() {
		return this.#selectedIndex;
	}

	/** @returns { string } */
	getSelectedId() {
		if (this.#items.length === 0) {
			return null;
		}
		return this.#items[this.#selectedIndex].id;
	}

	//==============================================================================
	// 확인, 값 바꿈 처리기.
	//==============================================================================
	/**
	 * @param { Function } selectHandler (id) => void
	 */
	setSelectHandler(selectHandler) {
		this.#selectHandler = selectHandler;
	}

	/**
	 * @param { Function } changeHandler (id, direction) => void
	 */
	setChangeHandler(changeHandler) {
		this.#changeHandler = changeHandler;
	}

	//==============================================================================
	// 가로부터 채울 때의 움직임.
	//
	// 좌우는 같은 줄 안에서만 옮깁니다. 줄 끝에서 더 가면 "none" 이라 바깥 화면이 초점을 가져갑니다.
	// 위아래는 같은 자리의 윗줄, 아랫줄로 갑니다. 마지막 줄이 짧으면 그 줄의 끝으로 당깁니다.
	//==============================================================================
	/**
	 * @param { string } command
	 * @returns { string }
	 */
	handleRowMajorCommand(command) {
		const itemCount = this.#items.length;
		const columnCount = this.#columnCount;
		const rowIndex = System.Math.floor(this.#selectedIndex / columnCount);
		const columnIndex = this.#selectedIndex - rowIndex * columnCount;
		if (command === Command.left || command === Command.right) {
			const step = command === Command.left ? -1 : 1;
			const nextColumnIndex = columnIndex + step;
			if (nextColumnIndex < 0 || nextColumnIndex >= columnCount) {
				return "none";
			}
			const nextIndex = rowIndex * columnCount + nextColumnIndex;
			if (nextIndex >= itemCount) {
				return "none";
			}
			this.#selectedIndex = nextIndex;
			return "move";
		}
		if (command === Command.up || command === Command.down) {
			const step = command === Command.up ? -1 : 1;
			const rowCount = this.readFilledRowCount();
			const nextRowIndex = rowIndex + step;
			if (nextRowIndex < 0 || nextRowIndex >= rowCount) {
				return "none";
			}
			let nextIndex = nextRowIndex * columnCount + columnIndex;
			if (nextIndex >= itemCount) {
				nextIndex = itemCount - 1;
			}
			this.#selectedIndex = nextIndex;
			return "move";
		}
		const selectedItem = this.#items[this.#selectedIndex];
		const isEnabled = selectedItem.isEnabled !== false;
		if (command === Command.confirm) {
			if (!isEnabled) {
				return "blocked";
			}
			if (this.#selectHandler !== null) {
				this.#selectHandler(selectedItem.id, this.#selectedIndex);
			}
			return "confirm";
		}
		return "none";
	}

	//==============================================================================
	// 명령 처리. ("move" | "confirm" | "blocked" | "change" | "none")
	//==============================================================================
	/**
	 * @param { string } command
	 * @returns { string }
	 */
	handleCommand(command) {
		const itemCount = this.#items.length;
		if (itemCount === 0) {
			return "none";
		}
		if (this.#isRowMajor && this.#columnCount > 1) {
			return this.handleRowMajorCommand(command);
		}
		if (command === Command.up || command === Command.down) {
			const step = command === Command.up ? -1 : 1;
			if (this.#columnCount > 1) {
				// 열 안에서 순환합니다. (마지막 열은 짧을 수 있습니다)
				const rowsPerColumn = this.readRowsPerColumn();
				const columnIndex = System.Math.floor(this.#selectedIndex / rowsPerColumn);
				const columnStart = columnIndex * rowsPerColumn;
				const columnLength = System.Math.min(rowsPerColumn, itemCount - columnStart);
				const rowIndex = this.#selectedIndex - columnStart;
				this.#selectedIndex = columnStart + (rowIndex + step + columnLength) % columnLength;
				return "move";
			}
			this.#selectedIndex = (this.#selectedIndex + step + itemCount) % itemCount;
			return "move";
		}
		if (this.#columnCount > 1 && (command === Command.left || command === Command.right)) {
			// 옆 열로 옮깁니다. 마지막 열은 짧을 수 있으므로 줄을 그 열의 끝으로 당깁니다.
			const rowsPerColumn = this.readRowsPerColumn();
			const columnIndex = System.Math.floor(this.#selectedIndex / rowsPerColumn);
			const rowIndex = this.#selectedIndex - columnIndex * rowsPerColumn;
			const step = command === Command.left ? -1 : 1;
			const nextColumnIndex = columnIndex + step;
			const filledColumnCount = System.Math.ceil(itemCount / rowsPerColumn);
			if (nextColumnIndex < 0 || nextColumnIndex >= filledColumnCount) {
				return "none";
			}
			const nextColumnStart = nextColumnIndex * rowsPerColumn;
			const nextColumnLength = System.Math.min(rowsPerColumn, itemCount - nextColumnStart);
			const nextRowIndex = System.Math.min(rowIndex, nextColumnLength - 1);
			this.#selectedIndex = nextColumnStart + nextRowIndex;
			return "move";
		}
		const selectedItem = this.#items[this.#selectedIndex];
		const isEnabled = selectedItem.isEnabled !== false;
		if (command === Command.confirm) {
			if (!isEnabled) {
				return "blocked";
			}
			if (this.#selectHandler !== null) {
				this.#selectHandler(selectedItem.id);
			}
			return "confirm";
		}
		if (command === Command.left || command === Command.right) {
			if (selectedItem.valueText === undefined || this.#changeHandler === null) {
				return "none";
			}
			if (!isEnabled) {
				return "blocked";
			}
			this.#changeHandler(selectedItem.id, command === Command.left ? -1 : 1);
			return "change";
		}
		return "none";
	}

	//==============================================================================
	// 갱신. (고른 항목이 밀리는 움직임)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		for (let itemIndex = 0; itemIndex < this.#shifts.length; ++itemIndex) {
			const targetShift = (itemIndex === this.#selectedIndex && this.#isFocused) ? LIST_SELECT_SHIFT : 0;
			this.#shifts[itemIndex] = approachValue(this.#shifts[itemIndex], targetShift, CURSOR_FOLLOW_RATE, timeDelta);
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
		const contentSize = this.getContentSize();
		const elapsedSeconds = readUiElapsedSeconds();
		const isCursorShown = (elapsedSeconds % CURSOR_BLINK_PERIOD) < CURSOR_BLINK_PERIOD * 0.62;
		const rowsPerColumn = this.readRowsPerColumn();
		const columnWidth = System.Math.round(contentSize.x / this.#columnCount);
		const visibleRowCount = this.readVisibleRowCount();
		const firstVisibleRow = this.readFirstVisibleRow();
		const pageStart = this.#isRowMajor ? firstVisibleRow * this.#columnCount : this.readPageStart();
		const pageEnd = System.Math.min(this.#items.length, pageStart + visibleRowCount * this.#columnCount);
		for (let itemIndex = pageStart; itemIndex < pageEnd; ++itemIndex) {
			const item = this.#items[itemIndex];
			const isSelected = itemIndex === this.#selectedIndex && this.#isFocused;
			const isEnabled = item.isEnabled !== false;
			const pageOffset = itemIndex - pageStart;
			let columnIndex = System.Math.floor(pageOffset / rowsPerColumn);
			let rowIndex = pageOffset - columnIndex * rowsPerColumn;
			if (this.#isRowMajor) {
				rowIndex = System.Math.floor(pageOffset / this.#columnCount);
				columnIndex = pageOffset - rowIndex * this.#columnCount;
			}
			const columnLeftX = columnIndex * columnWidth;
			const centerY = rowIndex * this.#lineHeight + System.Math.round(this.#lineHeight * 0.5);
			let colorKey = Colors.textPrimary;
			if (!isEnabled) {
				colorKey = Colors.textDim;
			}
			else if (isSelected) {
				colorKey = Colors.accent;
			}
			const shift = System.Math.round(this.#shifts[itemIndex]);
			let labelX = columnLeftX + shift;
			if (this.#textAlign === "center") {
				labelX = columnLeftX + System.Math.round(columnWidth * 0.5) + shift;
			}
			drawText(graphic, item.label, labelX, centerY, this.#tier, colorKey, this.#textAlign);
			if (isSelected && isCursorShown) {
				let cursorX = columnLeftX + shift - CURSOR_GAP;
				if (this.#textAlign === "center") {
					cursorX = labelX - CURSOR_GAP - System.Math.round(this.measureLabelHalfWidth(graphic, item.label));
				}
				drawText(graphic, ">", cursorX, centerY, this.#tier, Colors.accent, "left");
			}
			if (item.valueText !== undefined) {
				const valueColorKey = isSelected ? Colors.cyan : (isEnabled ? Colors.textPrimary : Colors.textDim);
				drawText(graphic, item.valueText, columnLeftX + columnWidth - VALUE_RIGHT_PADDING * (this.#columnCount - 1), centerY, this.#tier, valueColorKey, "right");
			}
		}
		super.draw(graphic);
	}

	//==============================================================================
	// 글의 반 폭. (가운데 정렬일 때 커서 자리)
	//==============================================================================
	/**
	 * @param { object } graphic
	 * @param { string } label
	 * @returns { number }
	 */
	measureLabelHalfWidth(graphic, label) {
		graphic.setFontString(this.#tier.weight + " " + this.#tier.size + "px \"" + this.#tier.family + "\"");
		const textMetrics = graphic.measureText(label);
		return textMetrics.width * 0.5;
	}

	//==============================================================================
	// 그 자리에 있는 항목 번호. (마우스, 손가락이 가리킨 곳, 없으면 -1)
	//==============================================================================
	/**
	 * @param { number } pointX 게임 좌표.
	 * @param { number } pointY 게임 좌표.
	 * @returns { number }
	 */
	findItemIndexAt(pointX, pointY) {
		const itemCount = this.#items.length;
		if (itemCount === 0) {
			return -1;
		}
		const position = this.getLocalPosition();
		const contentSize = this.getContentSize();
		const localX = pointX - position.x;
		const localY = pointY - position.y;
		if (localX < 0 || localX > contentSize.x) {
			return -1;
		}
		const rowsPerColumn = this.readRowsPerColumn();
		const columnWidth = contentSize.x / this.#columnCount;
		const columnIndex = System.Math.floor(localX / columnWidth);
		const rowIndex = System.Math.floor(localY / this.#lineHeight);
		if (rowIndex < 0 || rowIndex >= rowsPerColumn) {
			return -1;
		}
		let itemIndex = this.readPageStart() + columnIndex * rowsPerColumn + rowIndex;
		if (this.#isRowMajor) {
			const firstVisibleRow = this.readFirstVisibleRow();
			itemIndex = (firstVisibleRow + rowIndex) * this.#columnCount + columnIndex;
		}
		if (itemIndex < 0 || itemIndex >= itemCount) {
			return -1;
		}
		return itemIndex;
	}

	//==============================================================================
	// 항목 수만큼의 높이. (열이 여럿이면 열 하나의 높이)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readTotalHeight() {
		const visibleRowCount = this.readVisibleRowCount();
		return visibleRowCount * this.#lineHeight;
	}
}
