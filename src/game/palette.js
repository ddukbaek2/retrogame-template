//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../libs/vanilla.js/src/base/color.js";
import { convertColorString } from "./display.js";


//==============================================================================
// 색 캐시.
//
// 엔진의 그리기 함수는 Color 인스턴스를 받습니다. 색 문자열을 매 프레임 파싱하면
// 프레임마다 인스턴스가 새로 생기므로, 한 번 만든 Color 를 문자열 기준으로 캐시합니다.
//==============================================================================
const colorCache = new Map();
// 색 되짚기 표. ({ 원래 값: 새 값 }, 게임에 들어가 있는 동안 그 편의 종이, 먹, 강조색으로 바꿔 칩니다)
let activeRemap = null;


//==============================================================================
// 색 되짚기 표 두기. (null 이면 원래 색)
//==============================================================================
/**
 * @param { object | null } remap
 */
export function setPaletteRemap(remap) {
	activeRemap = remap;
}


//==============================================================================
// 되짚기만 한 색 문자열. (표에 없으면 그대로, 화면 색 수는 거치지 않습니다)
//==============================================================================
/**
 * @param { string } colorString
 * @returns { string }
 */
export function resolveRemapColorString(colorString) {
	if (activeRemap === null) {
		return colorString;
	}
	const remapped = activeRemap[colorString];
	return remapped === undefined ? colorString : remapped;
}


//==============================================================================
// 실제로 화면에 나갈 색 문자열.
//
// 편마다의 되짚기를 한 뒤, 표시 장치가 지금 설정한 색 수(1, 2, 4, 8 비트)에 맞춰
// 낼 수 있는 색으로 바꿉니다. 그리는 쪽은 이 값만 씁니다.
//==============================================================================
/**
 * @param { string } colorString
 * @returns { string }
 */
export function resolveColorString(colorString) {
	const remappedString = resolveRemapColorString(colorString);
	const displayedString = convertColorString(remappedString, colorString);
	return displayedString;
}


//==============================================================================
// 색 문자열 → Color. (캐시)
//==============================================================================
/**
 * @param { string } colorString "#rrggbb" 형식.
 * @returns { Color }
 */
export function getColor(colorString) {
	const resolvedString = resolveColorString(colorString);
	const cachedColor = colorCache.get(resolvedString);
	if (cachedColor !== undefined) {
		return cachedColor;
	}
	const createdColor = Color.createFromHEX(resolvedString);
	colorCache.set(resolvedString, createdColor);
	return createdColor;
}


//==============================================================================
// 투명도를 곁들인 색 반환. (같은 색의 반투명 판을 캐시해 재사용합니다)
//==============================================================================
/**
 * @param { string } colorString "#rrggbb" 형식.
 * @param { number } alpha 0 ~ 1.
 * @returns { Color }
 */
export function getColorWithAlpha(colorString, alpha) {
	// 0.01 단위로 끊어 캐시합니다. (연출 중 매 프레임 미세하게 달라지는 값이 캐시를 부풀리지 않도록)
	const quantizedAlpha = System.Math.round(alpha * 100) / 100;
	const resolvedString = resolveColorString(colorString);
	const cacheKey = resolvedString + "@" + quantizedAlpha;
	const cachedColor = colorCache.get(cacheKey);
	if (cachedColor !== undefined) {
		return cachedColor;
	}
	const baseColor = getColor(colorString);
	const createdColor = new Color(baseColor.red, baseColor.green, baseColor.blue, quantizedAlpha);
	colorCache.set(cacheKey, createdColor);
	return createdColor;
}
