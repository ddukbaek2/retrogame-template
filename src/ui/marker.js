//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { getColor } from "../game/palette.js";
import { readRect } from "../game/scratch.js";


//==============================================================================
// 표식 사각형.
//
// 판에서 빈 칸이나 작은 알갱이를 나타낼 때 글자(온점)를 찍지 않고 사각형을 그립니다.
// (사용자 지시, 2026-09-10, "게임판에서 쓰는 글자건 뭐건 다 없애, 필요하면 그냥 사각형을 쓰는 게 맞고
// 어줍잖게 텍스트로 이상한 온점 찍지 말라고")
//
// 자리는 한가운데를 줍니다. 크기는 홀수여도 되게 반올림해서 정수 픽셀에 맞춥니다.
//==============================================================================


//==============================================================================
// 채운 사각형 하나.
//==============================================================================
/**
 * @param { object } graphic
 * @param { number } centerX
 * @param { number } centerY
 * @param { number } size 한 변의 길이.
 * @param { string } colorKey Colors 의 열쇠.
 */
export function drawMarker(graphic, centerX, centerY, size, colorKey) {
	const markerColor = getColor(colorKey);
	graphic.setFillColor(markerColor);
	const left = System.Math.round(centerX - size * 0.5);
	const top = System.Math.round(centerY - size * 0.5);
	const markerRect = readRect(left, top, size, size);
	graphic.drawRect(markerRect);
}


//==============================================================================
// 테두리만 있는 사각형 하나. (차 있음과 비어 있음을 가를 때)
//==============================================================================
/**
 * @param { object } graphic
 * @param { number } centerX
 * @param { number } centerY
 * @param { number } size
 * @param { number } lineWidth
 * @param { string } colorKey
 */
export function drawMarkerOutline(graphic, centerX, centerY, size, lineWidth, colorKey) {
	const markerColor = getColor(colorKey);
	graphic.setStrokeColor(markerColor);
	const left = System.Math.round(centerX - size * 0.5);
	const top = System.Math.round(centerY - size * 0.5);
	const markerRect = readRect(left, top, size, size);
	graphic.drawStrokeRect(markerRect, lineWidth);
}
