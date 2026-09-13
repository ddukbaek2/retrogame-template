//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { getColor } from "../game/palette.js";
import { readRect } from "../game/scratch.js";
import { drawText, measureTextWidth } from "../game/text.js";
import { Colors } from "../game/constants.js";


//==============================================================================
// 영역 상자.
//
// 도스 시절 화면은 테두리 선으로 영역을 나누고, 제목을 그 선 위에 한 줄로 얹었습니다.
// 좁은 화면을 한 줄도 버리지 않고 쓰는 방식입니다. (사용자 지시, 2026-09-10)
//==============================================================================


// 테두리 굵기.
const BORDER_SIZE = 2;
// 제목 좌우로 비워 두는 자리. (선이 글자에 닿지 않게)
const TITLE_PADDING = 8;
// 제목이 선에서 들어와 앉는 자리.
const TITLE_INSET = 20;


//==============================================================================
// 상자 안을 종이색으로 채우기. (뒤가 비치면 안에 든 글이 읽히지 않습니다)
//==============================================================================
/**
 * @param { object } graphic
 * @param { number } left
 * @param { number } top
 * @param { number } width
 * @param { number } height
 */
function fillBoxInside(graphic, left, top, width, height) {
	const paperColor = getColor(Colors.background);
	graphic.setFillColor(paperColor);
	const insideRect = readRect(left, top, width, height);
	graphic.drawRect(insideRect);
}


//==============================================================================
// 테두리만 있는 상자.
//==============================================================================
/**
 * @param { object } graphic
 * @param { number } left
 * @param { number } top
 * @param { number } width
 * @param { number } height
 * @param { string } colorKey
 */
export function drawBox(graphic, left, top, width, height, colorKey) {
	fillBoxInside(graphic, left, top, width, height);
	const borderColor = getColor(colorKey);
	graphic.setStrokeColor(borderColor);
	const half = BORDER_SIZE * 0.5;
	const boxRect = readRect(left + half, top + half, width - BORDER_SIZE, height - BORDER_SIZE);
	graphic.drawStrokeRect(boxRect, BORDER_SIZE);
}


//==============================================================================
// 제목을 테두리 선 위에 얹은 상자.
//
// 제목 자리만큼 위 선을 비우고 그 자리에 글자를 놓습니다.
//==============================================================================
/**
 * @param { object } graphic
 * @param { number } left
 * @param { number } top
 * @param { number } width
 * @param { number } height
 * @param { string } titleText
 * @param { number } titleTier UiFontSize 의 값.
 * @param { string } borderColorKey
 * @param { string } titleColorKey
 */
export function drawTitledBox(graphic, left, top, width, height, titleText, titleTier, borderColorKey, titleColorKey) {
	fillBoxInside(graphic, left, top, width, height);
	const borderColor = getColor(borderColorKey);
	graphic.setFillColor(borderColor);
	const titleWidth = measureTextWidth(graphic, titleText, titleTier);
	const gapLeft = left + TITLE_INSET - TITLE_PADDING;
	const gapRight = gapLeft + titleWidth + TITLE_PADDING * 2;
	// 위 선. 제목 자리는 비웁니다.
	const leftTopRect = readRect(left, top, System.Math.max(0, gapLeft - left), BORDER_SIZE);
	graphic.drawRect(leftTopRect);
	const rightTopRect = readRect(gapRight, top, System.Math.max(0, left + width - gapRight), BORDER_SIZE);
	graphic.drawRect(rightTopRect);
	// 아래 선.
	const bottomRect = readRect(left, top + height - BORDER_SIZE, width, BORDER_SIZE);
	graphic.drawRect(bottomRect);
	// 좌우 선.
	const leftRect = readRect(left, top, BORDER_SIZE, height);
	graphic.drawRect(leftRect);
	const rightRect = readRect(left + width - BORDER_SIZE, top, BORDER_SIZE, height);
	graphic.drawRect(rightRect);
	drawText(graphic, titleText, left + TITLE_INSET, top, titleTier, titleColorKey, "left");
}
