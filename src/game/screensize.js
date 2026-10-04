//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { REFERENCE_RESOLUTION_WIDTH } from "./constants.js";


//==============================================================================
// 지금 화면 폭. (게임이 그리는 논리 영역의 가로, 세로는 늘 REFERENCE_RESOLUTION_HEIGHT 입니다)
//
// 기본은 기준 폭(4 : 3)입니다. 화면 크기를 와이드로 고르면 창 비율을 따라 넓어집니다. 정하는 것은
// `src/game/devicesize.js` 입니다. 화면 코드는 가로 자리를 이 값으로 셉니다. 가운데는 readScreenWidth() 의
// 절반, 오른쪽 끝은 readScreenWidth() 입니다. 왼쪽 끝은 늘 0 입니다.
//==============================================================================
let screenWidth = REFERENCE_RESOLUTION_WIDTH;


/**
 * @returns { number }
 */
export function readScreenWidth() {
	return screenWidth;
}


/**
 * @param { number } width
 */
export function setScreenWidth(width) {
	screenWidth = width;
}
