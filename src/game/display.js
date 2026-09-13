//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { setCrtColorMode } from "./crt.js";
import { createVgaPalette } from "./vgapalette.js";
import { Colors } from "./constants.js";


//==============================================================================
// 표시 장치.
//
// 게임이 쓰겠다고 말한 색을, 지금 설정한 화면 색 수에 맞춰 바꿔 돌려줍니다. 화면 코드는 늘
// `Colors` 의 열쇠만 쓰고, 그 열쇠가 실제로 무슨 색이 되는지는 여기서 정합니다.
//
//   1 비트 (녹색 / 흰색) 은 켜짐과 꺼짐 둘뿐입니다.
//   2 비트 (녹색 / 흰색) 은 단색 브라운관이 내던 네 단입니다. (꺼짐, 약함, 보통, 강함)
//   4 비트 16 색과 8 비트 256 색은 VGA 기본 팔레트에서 가장 가까운 색으로 붙입니다.
//
// 브라운관 필터(`crt.js`)는 이 장치가 낸 그림 위에 유리, 주사선, 모니터 그림을 얹을 뿐,
// 색에는 손대지 않습니다. 그래서 브라운관을 꺼도 색 수는 그대로입니다. (사용자 지시, 2026-09-10)
//==============================================================================


// 단색 브라운관의 형광 색.
const PHOSPHOR_GREEN = [71, 255, 110];
const PHOSPHOR_WHITE = [255, 255, 255];
const PHOSPHOR_RED = [255, 82, 64];
const PHOSPHOR_BLUE = [104, 168, 255];
// 단색 브라운관이 쓰는 인광색. (1 비트는 켜짐과 꺼짐, 2 비트는 네 단)
const MONO_PHOSPHORS = System.Object.freeze({
	green: PHOSPHOR_GREEN,
	white: PHOSPHOR_WHITE,
	red: PHOSPHOR_RED,
	blue: PHOSPHOR_BLUE,
	green2: PHOSPHOR_GREEN,
	white2: PHOSPHOR_WHITE,
});
const ONE_BIT_MODES = System.Object.freeze(["green", "white", "red", "blue"]);
const TWO_BIT_MODES = System.Object.freeze(["green2", "white2"]);
// 1 비트에서 켜짐으로 볼 거리. (0 ~ 255 자로 잰 종이색과의 거리)
const ON_DISTANCE = 31;
// 2 비트에서 색을 모르는 값에 쓸 거리. (아는 색은 아래 표가 단을 정합니다)
const FULL_DISTANCE = 230;

// 2 비트 네 단은 밝기가 아니라 **역할**로 정합니다.
//
// 옛 단색 모니터에서 보통 글자는 중간 밝기였고, 가장 밝은 단은 강조에 쓰는 속성이었습니다.
// 그래서 본문이 중, 흐린 글자가 약, 커서와 강조가 강입니다. (사용자 물음, 2026-09-10)
//   0 꺼짐, 1 약함, 2 보통, 3 강함
const MONO_STEPS = System.Object.freeze({
	[Colors.outside]: 0,
	[Colors.background]: 0,
	[Colors.textFaint]: 1,
	[Colors.textDim]: 1,
	[Colors.textPrimary]: 2,
	[Colors.cyan]: 2,
	[Colors.green]: 2,
	[Colors.magenta]: 2,
	[Colors.orange]: 2,
	[Colors.lime]: 2,
	[Colors.accent]: 3,
	[Colors.red]: 3,
	[Colors.white]: 3,
});
const MONO_STEP_COUNT = 3;

let colorMode = "256";
let paperLevels = [14, 14, 18];
let paletteEntries = null;
const convertCache = new Map();


//==============================================================================
// 색 문자열에서 값 셋 읽기.
//==============================================================================
/**
 * @param { string } colorString "#rrggbb"
 * @returns { number[] } 0 ~ 255 세 값.
 */
function readLevels(colorString) {
	const red = System.parseInt(colorString.slice(1, 3), 16);
	const green = System.parseInt(colorString.slice(3, 5), 16);
	const blue = System.parseInt(colorString.slice(5, 7), 16);
	return [red, green, blue];
}


//==============================================================================
// 값 셋을 색 문자열로.
//==============================================================================
/**
 * @param { number } red 0 ~ 255
 * @param { number } green
 * @param { number } blue
 * @returns { string } "#rrggbb"
 */
function writeColorString(red, green, blue) {
	const packed = (1 << 24) + (red << 16) + (green << 8) + blue;
	const text = packed.toString(16).slice(1);
	return "#" + text;
}


//==============================================================================
// 화면 색 수 두기. (설정 "모니터 색")
//==============================================================================
/**
 * @param { string } mode "green", "white", "green2", "white2", "16", "256"
 */
export function setDisplayColorMode(mode) {
	setCrtColorMode(mode);
	colorMode = mode;
	convertCache.clear();
}


//==============================================================================
// 지금 화면 색 수.
//==============================================================================
/**
 * @returns { string }
 */
export function getDisplayColorMode() {
	return colorMode;
}


//==============================================================================
// 지금 편의 종이색 알림. (단색은 종이에서 얼마나 멀어졌는지로 밝기를 잽니다)
//==============================================================================
/**
 * @param { string } colorString "#rrggbb"
 */
export function setDisplayPaperColor(colorString) {
	paperLevels = readLevels(colorString);
	convertCache.clear();
}


//==============================================================================
// 종이색에서 얼마나 멀어졌는지.
//==============================================================================
/**
 * @param { number[] } levels
 * @returns { number } 0 ~ 441 남짓.
 */
function readPaperDistance(levels) {
	const differenceRed = levels[0] - paperLevels[0];
	const differenceGreen = levels[1] - paperLevels[1];
	const differenceBlue = levels[2] - paperLevels[2];
	const squared = differenceRed * differenceRed + differenceGreen * differenceGreen + differenceBlue * differenceBlue;
	return System.Math.sqrt(squared);
}


//==============================================================================
// 팔레트에서 가장 가까운 색.
//==============================================================================
/**
 * @param { number[] } levels
 * @param { number } colorCount 앞에서부터 몇 색까지 볼지. (16 또는 256)
 * @returns { string } "#rrggbb"
 */
function findNearestPaletteColor(levels, colorCount) {
	if (paletteEntries === null) {
		paletteEntries = createVgaPalette();
	}
	let nearestOffset = 0;
	let nearestDistance = Number.MAX_VALUE;
	for (let index = 0; index < colorCount; ++index) {
		const offset = index * 3;
		const differenceRed = levels[0] - paletteEntries[offset];
		const differenceGreen = levels[1] - paletteEntries[offset + 1];
		const differenceBlue = levels[2] - paletteEntries[offset + 2];
		const distance = differenceRed * differenceRed + differenceGreen * differenceGreen + differenceBlue * differenceBlue;
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestOffset = offset;
		}
	}
	return writeColorString(paletteEntries[nearestOffset], paletteEntries[nearestOffset + 1], paletteEntries[nearestOffset + 2]);
}


//==============================================================================
// 2 비트에서 쓸 단 고르기.
//
// 아는 색이면 역할대로, 모르는 색이면 종이에서 멀어진 만큼으로 정합니다. 모르는 색은
// 가장 밝은 단까지 올라가지 않습니다. 그 단은 강조 자리이기 때문입니다.
//==============================================================================
/**
 * @param { number[] } levels
 * @param { string } roleString
 * @returns { number } 0 부터 3 까지.
 */
function readMonoStep(levels, roleString) {
	const knownStep = MONO_STEPS[roleString];
	if (knownStep !== undefined) {
		return knownStep;
	}
	const distance = readPaperDistance(levels);
	if (distance <= ON_DISTANCE) {
		return 0;
	}
	const ratio = System.Math.min(1, distance / FULL_DISTANCE);
	const step = 1 + System.Math.round(ratio);
	return step;
}


//==============================================================================
// 단색 화면의 밝기 한 단. (형광 색에 밝기를 곱합니다)
//==============================================================================
/**
 * @param { number[] } phosphor
 * @param { number } brightness 0 ~ 1.
 * @returns { string } "#rrggbb"
 */
function writePhosphorColor(phosphor, brightness) {
	const red = System.Math.round(phosphor[0] * brightness);
	const green = System.Math.round(phosphor[1] * brightness);
	const blue = System.Math.round(phosphor[2] * brightness);
	return writeColorString(red, green, blue);
}


//==============================================================================
// 색 하나를 지금 화면에 낼 수 있는 색으로.
//==============================================================================
/**
 * @param { string } colorString "#rrggbb" 편의 되짚기를 마친 값.
 * @param { string } roleString 되짚기 전의 값. (Colors 의 열쇠 노릇을 합니다)
 * @returns { string } "#rrggbb"
 */
export function convertColorString(colorString, roleString) {
	const cacheKey = roleString + ">" + colorString;
	const cachedString = convertCache.get(cacheKey);
	if (cachedString !== undefined) {
		return cachedString;
	}
	const levels = readLevels(colorString);
	let convertedString = colorString;
	if (ONE_BIT_MODES.indexOf(colorMode) >= 0) {
		const phosphor = MONO_PHOSPHORS[colorMode];
		const distance = readPaperDistance(levels);
		const brightness = distance > ON_DISTANCE ? 1 : 0;
		convertedString = writePhosphorColor(phosphor, brightness);
	}
	else if (TWO_BIT_MODES.indexOf(colorMode) >= 0) {
		const phosphor = MONO_PHOSPHORS[colorMode];
		const step = readMonoStep(levels, roleString);
		convertedString = writePhosphorColor(phosphor, step / MONO_STEP_COUNT);
	}
	else if (colorMode === "16") {
		convertedString = findNearestPaletteColor(levels, 16);
	}
	else if (colorMode === "256") {
		convertedString = findNearestPaletteColor(levels, 256);
	}
	convertCache.set(cacheKey, convertedString);
	return convertedString;
}
