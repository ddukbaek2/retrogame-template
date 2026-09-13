//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Colors } from "./constants.js";


//==============================================================================
// 게임 정체성. (편마다 제 종이 색, 먹 색, 강조색)
//
// 그림이 없는 게임이라 편끼리 갈라 보이게 하는 것은 종이 색과 먹 색뿐입니다. 편마다 셋을
// 정해 두면 앱이 그 편에 들어갈 때 Colors 의 값을 바꿔 칩니다. (src/game/palette.js 의 되짚기)
// 흐린 글자, 옅은 글자는 먹을 종이에 섞어 만들고, 정보, 완료, 오류 색은 종이의 밝기에 따라
// 밝은 계열, 어두운 계열을 고릅니다.
//
// 표는 앱이 편끼리 색이 겹치지 않게 한 자리에서 정합니다. 편은 GameModule.getPalette() 로
// 제 것을 돌려받습니다(덮어써도 됩니다).
//==============================================================================
const GAME_IDENTITIES = System.Object.freeze({
	// 편마다 한 줄입니다. `kind` 는 허브의 갈래, 나머지는 그 편의 색입니다.
	// info, ok, bad 는 적지 않으면 종이 밝기에서 자동으로 나옵니다.
	sample: { kind: "full", paper: "#0d1220", ink: "#e6ecff", accent: "#ffd23f" },
});

// 편의 갈래. 허브가 이 순서로 나눠 보여 줍니다.
//   done  , 완료: 다 만들어 손볼 것이 남지 않은 편.
//   full  , 본격: 제 구성, 제 조작 방식을 가진 한 편의 게임.
//   arcade, 아케이드: 실시간으로 도는 편.
//   light , 소품: 짧고 가벼운 편.
//   fresh , 신규: 막 손대기 시작한 편.
export const GameKind = System.Object.freeze({
	// 다 만들어 손볼 것이 남지 않은 편입니다. 맨 위에 섭니다. (사용자 지시, 2026-09-13)
	done: "done",
	arcade: "arcade",
	full: "full",
	light: "light",
	fresh: "fresh",
});

// 갈래의 차례와 화면 이름.
export const GAME_KIND_ORDER = System.Object.freeze([
	{ kind: GameKind.done, label: "완료" },
	{ kind: GameKind.full, label: "진행중" },
	{ kind: GameKind.light, label: "중단" },
	{ kind: GameKind.fresh, label: "신규" },
]);

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
// 편의 정체성 반환. (없으면 null)
//==============================================================================
/**
 * @param { string } gameId
 * @returns { object | null } { paper, ink, accent }
 */
export function readGameIdentity(gameId) {
	const identity = GAME_IDENTITIES[gameId];
	if (identity === undefined) {
		return null;
	}
	return identity;
}


//==============================================================================
// 편의 갈래 반환. (표에 없거나 kind 가 없으면 소품)
//==============================================================================
/**
 * @param { string } gameId
 * @returns { string } GameKind 의 값.
 */
export function readGameKind(gameId) {
	const identity = GAME_IDENTITIES[gameId];
	if (identity === undefined || identity.kind === undefined) {
		return GameKind.light;
	}
	return identity.kind;
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
