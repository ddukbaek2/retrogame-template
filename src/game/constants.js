//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 게임 제목.
//==============================================================================
export const GAME_TITLE = "No Graphic Game";


//==============================================================================
// 기준 해상도. (게임이 그리는 논리 영역, 브라운관 모니터의 화면 구멍)
//
// 창은 스팀덱 1280 × 800 이고, 그 안에 옛 브라운관 모니터 그림(assets/monitor/bezel.png)이 꽉 차며
// 화면 구멍이 960 × 720(VGA 640 × 480 의 1.5 배, 베젤 양옆 160, 위아래 40)입니다. 게임은 이 크기의 백버퍼에 1 : 1 로 그리고, src/game/crt.js 가 볼록하게 휘어 보여 줍니다.
// (사용자 결정, 2026-09-08, "1280 × 800 안에 브라운관 모니터 이미지가 있고 그 가운데 화면 영역에 게임을 뿌려라")
//==============================================================================
export const REFERENCE_RESOLUTION_WIDTH = 960;
export const REFERENCE_RESOLUTION_HEIGHT = 720;
// 창(스팀덱) 크기와 베젤.
export const WINDOW_REFERENCE_WIDTH = 1280;
export const WINDOW_REFERENCE_HEIGHT = 800;
export const MONITOR_BEZEL_X = 160;
export const MONITOR_BEZEL_Y = 40;


//==============================================================================
// 색상 값.
//
// 화면에는 글자와 바탕뿐입니다. 상태는 색과 움직임으로만 말합니다.
//
// ⚠️ 뜻이 다른 색은 값도 달라야 합니다. (열쇠가 값이라 겹치면 가를 수 없습니다)
//==============================================================================
export const Colors = System.Object.freeze({
	// 게임 화면 밖과 바탕. (바탕은 종이입니다, 화면에서 유일하게 글자가 아닌 것)
	outside: "#000000",
	background: "#0e0e12",

	// 글자.
	textPrimary: "#f2f0e6",
	textDim: "#5e5e6c",
	textFaint: "#2f2f3a",

	// 강조. (커서, 고른 것, 날개)
	accent: "#ffd23f",
	// 목표, 정보.
	cyan: "#4fe0ff",
	// 완료, 맞음.
	green: "#7cff5c",
	// 막힘, 오류.
	red: "#ff4d5a",
	// 조각 색. (끼우기, 조각마다 다른 색)
	magenta: "#ff5ad6",
	orange: "#ff9a3c",
	lime: "#c8ff5a",
	white: "#ffffff",
});

// 조각, 층에 차례로 주는 색. (끼우기)
export const PIECE_COLOR_KEYS = System.Object.freeze([Colors.cyan, Colors.magenta, Colors.orange, Colors.lime, Colors.green]);


//==============================================================================
// 글꼴. (갈무리, SIL OFL)
//
// **기본은 갈무리9 하나입니다.** 갈무리11 은 획이 시원해 요즘 픽셀 폰트 느낌이 나고, 옛 PC 화면의 결에서
// 벗어납니다. 더 큰 글자가 필요하면 갈무리9 를 키워 씁니다.
//
// 도트 글꼴은 **em 격자의 정수 배**로만 씁니다. 글꼴 이름의 숫자(9)는 글자가 실제로 차지하는 칸 수이고,
// em 은 그보다 한 칸 넓습니다. 갈무리9 는 10 칸입니다. (em 1000 에 좌표 격자가 100 이라 재 보면 그렇습니다)
// 그래서 쓸 수 있는 크기는 20, 30, 40, 60, 90 입니다. 18px 로 쓰면 한 칸이 1.8px 이 되어 획이 들쭉날쭉해집니다.
// 다른 도트 글꼴을 더할 때도 이름이 아니라 em 격자를 재어 맞춥니다.
//
// **같은 패밀리에 굵기가 다른 파일을 올릴 때는 `weight` 를 반드시 줍니다.** 주지 않으면 둘 다 normal 로
// 등록되어 나중 것이 앞 것을 덮어씁니다. (엔진의 `FontAsset.loadFont` 가 그 값을 FontFace 서술자로 넘깁니다)
//==============================================================================
export const FontFamily = System.Object.freeze({
	galmuri9: "Galmuri9",
});

export const FontPaths = System.Object.freeze([
	{ family: FontFamily.galmuri9, path: "./assets/fonts/Galmuri9.woff2", weight: "400" },
]);

// 글자 크기 티어. (화면 코드에 크기 리터럴을 쓰지 않습니다, 이 티어만 씁니다)
export const UiFontSize = System.Object.freeze({
	// 안내, 각주. (10 칸 × 2)
	tiny: { family: FontFamily.galmuri9, size: 20, weight: "400" },
	// 목록, 이름표. (10 칸 × 2) 각주와 크기가 같습니다. 다음 단이 30 인데 목록에 쓰기에 너무 큽니다.
	// 둘은 크기가 아니라 색과 자리로 갈립니다.
	small: { family: FontFamily.galmuri9, size: 20, weight: "400" },
	// 판의 글자, 본문. (10 칸 × 3)
	medium: { family: FontFamily.galmuri9, size: 30, weight: "400" },
	// 큰 판의 글자, 표제. (10 칸 × 4)
	large: { family: FontFamily.galmuri9, size: 40, weight: "400" },
	// 완료 표시. (10 칸 × 6)
	huge: { family: FontFamily.galmuri9, size: 60, weight: "400" },
	// 타이틀 제목. (10 칸 × 9)
	title: { family: FontFamily.galmuri9, size: 90, weight: "400" },
});


//==============================================================================
// 모니터 색 모드. (브라운관 필터의 색 줄이기, 설정에서 고릅니다)
//==============================================================================
// 볼록 효과의 세기. (기준 휘어짐에 곱합니다)
export const CurveLevelOptions = System.Object.freeze([
	{ id: "off", name: "꺼짐", scale: 0 },
	{ id: "low", name: "약하게", scale: 0.34 },
	{ id: "medium", name: "보통", scale: 0.67 },
	{ id: "high", name: "강하게", scale: 1 },
]);

export const MonitorColorOptions = System.Object.freeze([
	{ id: "green", name: "1 비트, 녹색" },
	{ id: "white", name: "1 비트, 흰색" },
	{ id: "red", name: "1 비트, 적색" },
	{ id: "blue", name: "1 비트, 청색" },
	{ id: "green2", name: "2 비트, 녹색" },
	{ id: "white2", name: "2 비트, 흰색" },
	{ id: "16", name: "4 비트, 16 색" },
	{ id: "256", name: "8 비트, 256 색" },
]);


//==============================================================================
// 화면 식별자.
//==============================================================================
export const Screen = System.Object.freeze({
	title: "title",
	hub: "hub",
	settings: "settings",
});


//==============================================================================
// 판(격자) 배치.
//
// 판의 글자는 정사각형 칸에 하나씩 놓입니다. 칸 크기는 글자 크기 티어와 짝입니다.
//==============================================================================
export const CELL_SIZE_MEDIUM = 48;
export const CELL_SIZE_LARGE = 64;
// 판이 이 칸 수를 넘으면 한 단계 작은 글자를 씁니다.
export const LARGE_CELL_MAXIMUM_COLUMNS = 7;
export const LARGE_CELL_MAXIMUM_ROWS = 5;
// 빈칸에 찍는 글자.
export const BLANK_GLYPH = "·";


//==============================================================================
// 자료 경로. (런타임은 읽기만 합니다. 만드는 것은 tools/ 의 도구가 맡습니다)
//==============================================================================
export const LEVEL_TABLE_PATH = "./assets/data/puzzle/levels.json";


//==============================================================================
// 화면 공통 자리. (머리글, 아래 안내 줄)
//==============================================================================
// 볼록 효과가 가장자리 한가운데를 이만큼 가립니다. 글자는 이 안쪽에 둡니다.
// (오버스캔으로 화면 구멍을 꽉 채우는 대가입니다. src/game/crt.js)
export const SAFE_MARGIN = 40;
export const HEADER_CENTER_Y = SAFE_MARGIN + 18;
export const HEADER_SIDE_MARGIN = SAFE_MARGIN + 12;
export const HINT_CENTER_Y = REFERENCE_RESOLUTION_HEIGHT - SAFE_MARGIN - 18;


//==============================================================================
// 움직임. (초, 따라가는 빠르기)
//==============================================================================
// 글자가 제자리를 따라가는 빠르기. (클수록 빨리 붙습니다)
export const LETTER_FOLLOW_RATE = 18;
// 커서, 목록 항목이 따라가는 빠르기.
export const CURSOR_FOLLOW_RATE = 22;
// 막혔을 때 흔들리는 시간과 거리.
export const SHAKE_SECONDS = 0.28;
export const SHAKE_DISTANCE = 6;
// 완료 연출 시간.
export const CLEAR_BOUNCE_SECONDS = 0.9;
export const CLEAR_BOUNCE_HEIGHT = 14;
// 커서가 숨쉬는 주기. (초)
export const CURSOR_BLINK_PERIOD = 0.9;
// 목록에서 고른 항목이 오른쪽으로 밀리는 거리.
export const LIST_SELECT_SHIFT = 16;
// 화면이 들어올 때 글자가 오는 거리와 시간.
export const ENTER_SHIFT = 40;
export const ENTER_SECONDS = 0.35;


//==============================================================================
// 입력. (방향키 자동 반복)
//==============================================================================
export const REPEAT_DELAY_SECONDS = 0.26;
export const REPEAT_INTERVAL_SECONDS = 0.085;
export const STICK_THRESHOLD = 0.55;


//==============================================================================
// 저장. (브라우저 localStorage, 게임마다 제 이름으로)
//==============================================================================
export const GAME_STORAGE_PREFIX = "nographic:game:";
export const SETTINGS_STORAGE_KEY = "nographic:settings";

// 화면 모드 선택지.
export const DisplayModeOptions = System.Object.freeze([
	{ id: "fit", name: "창 맞춤" },
	{ id: "integer", name: "정수 배율" },
]);
