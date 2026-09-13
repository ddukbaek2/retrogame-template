//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { getColor } from "../game/palette.js";
import { readRect } from "../game/scratch.js";
import { Colors, REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT } from "../game/constants.js";


//==============================================================================
// 볼록 확인용 체크무늬.
//
// 게임 화면 전체를 격자로 덮어 브라운관의 볼록 효과가 어디를 얼마나 휘게 하는지 눈으로 봅니다.
// 설정에서 켜고 끕니다. (사용자 요청, 2026-09-10)
//
// 가장자리 한 줄은 테두리라 화면 구멍의 끝이 어디인지도 함께 보입니다.
//==============================================================================


// 칸 하나의 크기. (960 과 720 을 모두 나눕니다)
const CELL_SIZE = 48;
// 테두리 굵기.
const BORDER_SIZE = 4;


//==============================================================================
// 체크무늬 그리기.
//==============================================================================
/**
 * @param { object } graphic
 */
export function drawTestGrid(graphic) {
	const columnCount = System.Math.ceil(REFERENCE_RESOLUTION_WIDTH / CELL_SIZE);
	const rowCount = System.Math.ceil(REFERENCE_RESOLUTION_HEIGHT / CELL_SIZE);
	const darkColor = getColor(Colors.background);
	const lightColor = getColor(Colors.textPrimary);
	for (let rowIndex = 0; rowIndex < rowCount; ++rowIndex) {
		for (let columnIndex = 0; columnIndex < columnCount; ++columnIndex) {
			const isLight = (rowIndex + columnIndex) % 2 === 0;
			const cellColor = isLight ? lightColor : darkColor;
			graphic.setFillColor(cellColor);
			const cellRect = readRect(columnIndex * CELL_SIZE, rowIndex * CELL_SIZE, CELL_SIZE, CELL_SIZE);
			graphic.drawRect(cellRect);
		}
	}
	const accentColor = getColor(Colors.accent);
	graphic.setStrokeColor(accentColor);
	const borderRect = readRect(BORDER_SIZE * 0.5, BORDER_SIZE * 0.5,
		REFERENCE_RESOLUTION_WIDTH - BORDER_SIZE, REFERENCE_RESOLUTION_HEIGHT - BORDER_SIZE);
	graphic.drawStrokeRect(borderRect, BORDER_SIZE);
	const centerColor = getColor(Colors.red);
	graphic.setStrokeColor(centerColor);
	const middleX = REFERENCE_RESOLUTION_WIDTH * 0.5;
	const middleY = REFERENCE_RESOLUTION_HEIGHT * 0.5;
	const crossRect = readRect(middleX - CELL_SIZE, middleY - CELL_SIZE, CELL_SIZE * 2, CELL_SIZE * 2);
	graphic.drawStrokeRect(crossRect, BORDER_SIZE);
}
