//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { getColor } from "../game/palette.js";
import { readRect } from "../game/scratch.js";
import { InputSource } from "../game/inputsource.js";
import { Colors, REFERENCE_RESOLUTION_WIDTH, HEADER_SIDE_MARGIN, HINT_CENTER_Y } from "../game/constants.js";


//==============================================================================
// 입력 장치 아이콘. (오른쪽 아래, 단색, 도트 비트맵)
//
// 이 게임에서 글자가 아닌 유일한 그림입니다. (사용자 결정, 2026-09-08, "유일하게 아이콘을 하나
// 추가했으면 하는데 현재 터치인지 키보드 + 마우스인지 게임 컨트롤러인지 단색 아이콘으로
// 우측 하단에 조그맣게") 16 × 10 도트를 2 배로 찍어 글자와 같은 도트 크기입니다. 색은 흐린 글자색.
//==============================================================================


// 도트 한 칸의 화면 크기. (갈무리11 × 2 와 같은 배율)
const DOT_SIZE = 2;
const ICON_COLUMNS = 16;
const ICON_ROWS = 10;
// "#" 이 켜진 도트입니다.
const ICON_BITMAPS = System.Object.freeze({
	[InputSource.keyboard]: [
		"................",
		".##############.",
		".#............#.",
		".#.#.#.#.#.#..#.",
		".#............#.",
		".#.#.#.#.#.#..#.",
		".#............#.",
		".#...######...#.",
		".#............#.",
		".##############.",
	],
	[InputSource.gamepad]: [
		"....########....",
		"..############..",
		".##############.",
		".##.########.##.",
		".#...######.#.#.",
		".##.########.##.",
		".##############.",
		".####......####.",
		".###........###.",
		"..#..........#..",
	],
	[InputSource.touch]: [
		"......##........",
		"......##........",
		"......##........",
		"......##.##.##..",
		"..##..##.##.##..",
		"..##..########..",
		"...###########..",
		"....#########...",
		".....#######....",
		"......#####.....",
	],
});


//==============================================================================
// 도트 그림 한 벌 꺼내기. (브라운관 덮개가 모니터 프레임 자리에 얹을 때 씁니다)
//==============================================================================
/**
 * @param { string } source InputSource 의 값.
 * @returns { string[] | undefined }
 */
export function readInputIconBitmap(source) {
	return ICON_BITMAPS[source];
}


//==============================================================================
// 도트 그림의 칸 수.
//==============================================================================
/**
 * @returns { object } { columns, rows }
 */
export function readInputIconSize() {
	return { columns: ICON_COLUMNS, rows: ICON_ROWS };
}


//==============================================================================
// 아이콘 자리. (오른쪽 여백 안쪽, 안내 줄과 세로 가운데를 맞춤)
//==============================================================================
/**
 * @returns { object } { x, y }
 */
export function readInputIconPosition() {
	const width = ICON_COLUMNS * DOT_SIZE;
	const height = ICON_ROWS * DOT_SIZE;
	const x = REFERENCE_RESOLUTION_WIDTH - HEADER_SIDE_MARGIN - width;
	const y = HINT_CENTER_Y - System.Math.round(height * 0.5);
	return { x: x, y: y };
}


//==============================================================================
// 아이콘 출력. (켜진 도트마다 작은 네모 하나)
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } source InputSource 의 값.
 */
export function drawInputIcon(graphic, source) {
	const bitmap = ICON_BITMAPS[source];
	if (bitmap === undefined) {
		return;
	}
	const position = readInputIconPosition();
	const dotColor = getColor(Colors.textDim);
	graphic.setFillColor(dotColor);
	for (let rowIndex = 0; rowIndex < bitmap.length; ++rowIndex) {
		const row = bitmap[rowIndex];
		for (let columnIndex = 0; columnIndex < row.length; ++columnIndex) {
			if (row[columnIndex] !== "#") {
				continue;
			}
			const dotX = position.x + columnIndex * DOT_SIZE;
			const dotY = position.y + rowIndex * DOT_SIZE;
			graphic.drawRect(readRect(dotX, dotY, DOT_SIZE, DOT_SIZE));
		}
	}
}
