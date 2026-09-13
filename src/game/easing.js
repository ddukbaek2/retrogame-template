//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 이징 함수 모음. (진행도 0~1 을 받아 보간값을 돌려줍니다, 연출 전용)
//
// 선형 보간만 쓰면 연출이 밋밋해 묻힙니다. 등장은 빠르게 꽂히고(감속) 퇴장은
// 서서히 가속되게 해야 "빡" 하고 꽂히는 느낌이 납니다.
//==============================================================================


//==============================================================================
// 진행도 정규화. (0~1 범위로 자릅니다)
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
function normalizeRatio(ratio) {
	if (ratio < 0) {
		return 0;
	}
	if (ratio > 1) {
		return 1;
	}
	return ratio;
}


//==============================================================================
// 되튕김 감속. (목표를 살짝 지나쳤다가 돌아옵니다, 펀치 연출용)
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
export function easeOutBack(ratio) {
	const normalizedRatio = normalizeRatio(ratio);
	const overshoot = 1.9;
	const scaledOvershoot = overshoot + 1;
	const inverseRatio = normalizedRatio - 1;
	const easedValue = 1 + scaledOvershoot * inverseRatio * inverseRatio * inverseRatio + overshoot * inverseRatio * inverseRatio;
	return easedValue;
}


//==============================================================================
// 지수 감속. (시작하자마자 거의 도달하고 끝에서 미세하게 붙습니다)
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
export function easeOutExpo(ratio) {
	const normalizedRatio = normalizeRatio(ratio);
	if (normalizedRatio >= 1) {
		return 1;
	}
	const easedValue = 1 - System.Math.pow(2, -10 * normalizedRatio);
	return easedValue;
}


//==============================================================================
// 삼차 감속.
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
export function easeOutCubic(ratio) {
	const normalizedRatio = normalizeRatio(ratio);
	const inverseRatio = 1 - normalizedRatio;
	const easedValue = 1 - inverseRatio * inverseRatio * inverseRatio;
	return easedValue;
}


//==============================================================================
// 삼차 가속. (퇴장 연출용, 천천히 빠지다 급격히 사라집니다)
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
export function easeInCubic(ratio) {
	const normalizedRatio = normalizeRatio(ratio);
	const easedValue = normalizedRatio * normalizedRatio * normalizedRatio;
	return easedValue;
}


//==============================================================================
// 양끝이 부드러운 곡선. (시작도 끝도 미끄러지듯)
//
// 되튕기지 않고 흐르는 움직임의 기본. 셰이프가 변형될 때 이걸 씁니다.
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
export function easeInOutCubic(ratio) {
	if (ratio < 0.5) {
		return 4 * ratio * ratio * ratio;
	}
	const shifted = -2 * ratio + 2;
	return 1 - (shifted * shifted * shifted) / 2;
}


//==============================================================================
// 끝이 아주 길게 늘어지는 곡선.
//
// 처음에 빠르게 나갔다가 마지막에 한참 미끄러집니다. 되튕김 없이도 힘이 실립니다.
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
export function easeOutQuint(ratio) {
	const shifted = 1 - ratio;
	return 1 - shifted * shifted * shifted * shifted * shifted;
}


//==============================================================================
// 양끝이 아주 부드러운 곡선.
//==============================================================================
/**
 * @param { number } ratio
 * @returns { number }
 */
export function easeInOutQuint(ratio) {
	if (ratio < 0.5) {
		return 16 * ratio * ratio * ratio * ratio * ratio;
	}
	const shifted = -2 * ratio + 2;
	return 1 - (shifted * shifted * shifted * shifted * shifted) / 2;
}
