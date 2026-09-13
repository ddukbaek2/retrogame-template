//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { getColor } from "./palette.js";
import { UiFontSize } from "./constants.js";


//==============================================================================
// 글자 그리기. (이 게임의 유일한 그림)
//
// 도트 글꼴을 흐리지 않게 찍는 규칙.
//   - 백버퍼가 기준 해상도로 고정이라 글자 텍스처는 늘 1 배로 구워집니다.
//   - 그리는 자리는 정수 픽셀로 맞춥니다. 반 픽셀에 걸치면 텍스처 보간이 번집니다.
//   - 가로 정렬과 세로 가운데는 엔진에 맡기지 않고 여기서 재서 정수로 맞춥니다.
//     (엔진의 middle 베이스라인은 반 픽셀이 될 수 있습니다)
//   - 글자를 늘리거나 줄이지 않습니다. 움직임은 옮기기와 색뿐입니다.
//==============================================================================


// 티어별 세로 가운데 오프셋 캐시. (베이스라인 기준, 한 번 재면 바뀌지 않습니다)
const centerOffsetCache = new Map();
// 폭 측정 캐시. (같은 글을 프레임마다 다시 재지 않습니다)
const widthCache = new Map();
const WIDTH_CACHE_LIMIT = 2048;


//==============================================================================
// 티어 갈아 끼우기. (다른 말로 볼 때 글꼴과 크기를 바꿉니다)
//
// 갈무리에는 한자도 가나도 없어 한국어 밖의 말은 다른 도트 글꼴로 찍어야 합니다.
// 그 글꼴은 설계 크기가 달라 크기도 함께 갈아야 도트가 깨지지 않습니다.
// 열쇠는 `UiFontSize` 의 항목 그 자체이고, 값은 `{ family, size }` 입니다.
// 빈 값을 넣으면 본디 글꼴로 돌아갑니다.
//==============================================================================
let fontOverrides = null;


/**
 * @param { Map | null } table
 */
export function setFontOverrides(table) {
	fontOverrides = table === undefined ? null : table;
	centerOffsetCache.clear();
	widthCache.clear();
}


//==============================================================================
// 폰트 문자열 생성.
//==============================================================================
/**
 * @param { object } tier UiFontSize 의 항목.
 * @returns { string }
 */
export function composeFontString(tier) {
	if (fontOverrides !== null) {
		const replaced = fontOverrides.get(tier);
		if (replaced !== undefined) {
			// 갈아 끼운 글꼴 뒤에 본디 글꼴을 붙입니다. 그 글꼴에 없는 글자(다른 말로 보는 중에 나오는 한글)를
			// 두부로 찍지 않고 갈무리로 찍기 위해서입니다.
			return tier.weight + " " + replaced.size + "px \"" + replaced.family + "\", \"" + tier.family + "\"";
		}
	}
	return tier.weight + " " + tier.size + "px \"" + tier.family + "\"";
}


//==============================================================================
// 티어의 세로 가운데 오프셋 반환. (베이스라인에 더하면 글자 한가운데가 y 에 옵니다)
//==============================================================================
/**
 * @param { object } graphic
 * @param { object } tier
 * @returns { number }
 */
export function readCenterOffset(graphic, tier) {
	const fontString = composeFontString(tier);
	const cachedOffset = centerOffsetCache.get(fontString);
	if (cachedOffset !== undefined) {
		return cachedOffset;
	}
	graphic.setFontString(fontString);
	const textMetrics = graphic.measureText("가A");
	let ascent = textMetrics.fontBoundingBoxAscent;
	if (ascent === undefined) {
		ascent = textMetrics.actualBoundingBoxAscent || tier.size * 0.8;
	}
	let descent = textMetrics.fontBoundingBoxDescent;
	if (descent === undefined) {
		descent = textMetrics.actualBoundingBoxDescent || tier.size * 0.2;
	}
	const centerOffset = System.Math.round((ascent - descent) * 0.5);
	centerOffsetCache.set(fontString, centerOffset);
	return centerOffset;
}


//==============================================================================
// 글 폭 측정. (정수)
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } text
 * @param { object } tier
 * @returns { number }
 */
export function measureTextWidth(graphic, text, tier) {
	const fontString = composeFontString(tier);
	const cacheKey = fontString + "|" + text;
	const cachedWidth = widthCache.get(cacheKey);
	if (cachedWidth !== undefined) {
		return cachedWidth;
	}
	graphic.setFontString(fontString);
	const textMetrics = graphic.measureText(text);
	const width = System.Math.round(textMetrics.width);
	if (widthCache.size >= WIDTH_CACHE_LIMIT) {
		widthCache.clear();
	}
	widthCache.set(cacheKey, width);
	return width;
}


//==============================================================================
// 글자 출력. (세로는 늘 가운데, 가로는 정렬대로, 정수 자리)
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } text
 * @param { number } positionX
 * @param { number } positionY 글자 한가운데의 세로 자리.
 * @param { object } tier UiFontSize 의 항목.
 * @param { string } colorKey Colors 의 값.
 * @param { string } textAlign "left" | "center" | "right"
 */
export function drawText(graphic, text, positionX, positionY, tier, colorKey, textAlign) {
	if (text === "" || text === null || text === undefined) {
		return;
	}
	let leftX = positionX;
	if (textAlign === "center") {
		const width = measureTextWidth(graphic, text, tier);
		leftX = positionX - System.Math.round(width * 0.5);
	}
	else if (textAlign === "right") {
		const width = measureTextWidth(graphic, text, tier);
		leftX = positionX - width;
	}
	const centerOffset = readCenterOffset(graphic, tier);
	const baselineY = System.Math.round(positionY) + centerOffset;
	const fontString = composeFontString(tier);
	const textColor = getColor(colorKey);
	graphic.setFontString(fontString);
	graphic.setTextAlign("left");
	graphic.setTextBaseline("alphabetic");
	graphic.setFillColor(textColor);
	graphic.drawFillText(text, System.Math.round(leftX), baselineY);
}


//==============================================================================
// 칸 한가운데에 글자 하나 출력.
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } glyph
 * @param { number } cellLeftX
 * @param { number } cellTopY
 * @param { number } cellSize
 * @param { object } tier
 * @param { string } colorKey
 */
export function drawGlyphInCell(graphic, glyph, cellLeftX, cellTopY, cellSize, tier, colorKey) {
	const centerX = cellLeftX + System.Math.round(cellSize * 0.5);
	const centerY = cellTopY + System.Math.round(cellSize * 0.5);
	drawText(graphic, glyph, centerX, centerY, tier, colorKey, "center");
}


//==============================================================================
// 여러 줄 출력. (줄 간격은 티어 크기의 배수)
//==============================================================================
/**
 * @param { object } graphic
 * @param { string[] } lines
 * @param { number } positionX
 * @param { number } topCenterY 첫 줄 한가운데의 세로 자리.
 * @param { object } tier
 * @param { string } colorKey
 * @param { string } textAlign
 * @param { number } lineHeight
 */
export function drawLines(graphic, lines, positionX, topCenterY, tier, colorKey, textAlign, lineHeight) {
	let lineY = topCenterY;
	for (const line of lines) {
		drawText(graphic, line, positionX, lineY, tier, colorKey, textAlign);
		lineY += lineHeight;
	}
}


//==============================================================================
// 티어의 줄 높이 반환. (도트 글꼴은 글자 크기의 1.5 배가 편안합니다)
//==============================================================================
/**
 * @param { object } tier
 * @returns { number }
 */
export function readLineHeight(tier) {
	return System.Math.round(tier.size * 1.5);
}


//==============================================================================
// 기본 티어 반환. (다른 파일이 UiFontSize 를 다시 들여오지 않아도 되게)
//==============================================================================
/**
 * @returns { object }
 */
export function readDefaultTier() {
	return UiFontSize.small;
}
