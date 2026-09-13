//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Colors } from "./constants.js";


//==============================================================================
// 게임의 색.
//
// 이 게임만의 종이 색, 먹 색, 강조색입니다. 앱이 게임에 들어갈 때 `Colors` 의 값을 이것으로
// 바꿔 칩니다. (`src/game/palette.js` 의 되짚기) 화면 코드는 그대로 `Colors` 의 열쇠만 씁니다.
//
// 흐린 글자와 옅은 글자는 먹을 종이에 섞어 만들고, 정보와 완료와 오류 색은 종이의 밝기를 보고
// 밝은 계열과 어두운 계열 가운데 고릅니다. 필요하면 `info` `ok` `bad` 를 직접 적어도 됩니다.
//==============================================================================
const GAME_PALETTE = System.Object.freeze({
	paper: "#0d1220",
	ink: "#e6ecff",
	accent: "#ffd23f",
});


// 종이가 어두울 때의 정보, 완료, 오류 색. (기본 Colors 와 같습니다)
const DARK_PAPER_SIGNALS = System.Object.freeze({ info: Colors.cyan, ok: Colors.green, bad: Colors.red });
// 종이가 밝을 때의 정보, 완료, 오류 색.
const LIGHT_PAPER_SIGNALS = System.Object.freeze({ info: "#0b6bcb", ok: "#1e8a3c", bad: "#c8102e" });
// 먹을 종이에 섞는 비율. (흐린 글자, 옅은 글자)
const DIM_MIX_RATIO = 0.55;
const FAINT_MIX_RATIO = 0.25;
// 이 밝기(0 ~ 1)를 넘으면 밝은 종이로 봅니다.
const LIGHT_PAPER_LUMINANCE = 0.5;


//==============================================================================
// 게임의 색 반환.
//==============================================================================
/**
 * @returns { object } { paper, ink, accent }
 */
export function readGameIdentity() {
	return GAME_PALETTE;
}


//==============================================================================
// 색 문자열 → [r, g, b]. ("#rrggbb")
//==============================================================================
/**
 * @param { string } colorString
 * @returns { number[] }
 */
function parseColor(colorString) {
	const red = System.parseInt(colorString.slice(1, 3), 16);
	const green = System.parseInt(colorString.slice(3, 5), 16);
	const blue = System.parseInt(colorString.slice(5, 7), 16);
	return [red, green, blue];
}


//==============================================================================
// [r, g, b] → 색 문자열.
//==============================================================================
/**
 * @param { number[] } channels
 * @returns { string }
 */
function formatColor(channels) {
	let colorString = "#";
	for (const channel of channels) {
		const clamped = System.Math.max(0, System.Math.min(255, System.Math.round(channel)));
		const hexText = clamped.toString(16);
		colorString += hexText.length < 2 ? "0" + hexText : hexText;
	}
	return colorString;
}


//==============================================================================
// 두 색 섞기. (ratio 가 1 이면 앞 색)
//==============================================================================
/**
 * @param { string } frontColor
 * @param { string } backColor
 * @param { number } ratio
 * @returns { string }
 */
export function mixColors(frontColor, backColor, ratio) {
	const front = parseColor(frontColor);
	const back = parseColor(backColor);
	const mixed = [];
	for (let channelIndex = 0; channelIndex < 3; ++channelIndex) {
		mixed.push(back[channelIndex] + (front[channelIndex] - back[channelIndex]) * ratio);
	}
	return formatColor(mixed);
}


//==============================================================================
// 색의 밝기. (0 ~ 1)
//==============================================================================
/**
 * @param { string } colorString
 * @returns { number }
 */
export function readLuminance(colorString) {
	const channels = parseColor(colorString);
	return (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722) / 255;
}


//==============================================================================
// 정체성 → Colors 되짚기 표. ({ 원래 값: 새 값 })
//==============================================================================
/**
 * @param { object } identity { paper, ink, accent, info?, ok?, bad? }
 * @returns { object }
 */
export function buildPaletteRemap(identity) {
	const paperLuminance = readLuminance(identity.paper);
	const signals = paperLuminance > LIGHT_PAPER_LUMINANCE ? LIGHT_PAPER_SIGNALS : DARK_PAPER_SIGNALS;
	const remap = {};
	remap[Colors.background] = identity.paper;
	remap[Colors.textPrimary] = identity.ink;
	remap[Colors.textDim] = mixColors(identity.ink, identity.paper, DIM_MIX_RATIO);
	remap[Colors.textFaint] = mixColors(identity.ink, identity.paper, FAINT_MIX_RATIO);
	remap[Colors.accent] = identity.accent;
	remap[Colors.cyan] = identity.info !== undefined ? identity.info : signals.info;
	remap[Colors.green] = identity.ok !== undefined ? identity.ok : signals.ok;
	remap[Colors.red] = identity.bad !== undefined ? identity.bad : signals.bad;
	return remap;
}
