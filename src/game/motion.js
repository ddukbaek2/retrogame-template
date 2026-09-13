//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 움직임 보조.
//
// 이 게임은 상태 변화를 옅어지는 것으로 말하지 않습니다. 커지고 작아지고 밀리고
// 도는 것으로만 말합니다. 그래서 "지금 값이 목표 값을 얼마나 따라잡았는가" 를
// 다루는 계산이 화면 곳곳에서 쓰입니다.
//
// 지수 감쇠로 따라가면 프레임 수와 무관하게 같은 속도로 붙고, 목표가 도중에
// 바뀌어도 튀지 않습니다. (마우스가 버튼 위를 스칠 때 특히 중요합니다)
//==============================================================================


//==============================================================================
// 목표 값으로 지수 감쇠하며 따라간 값 반환.
//==============================================================================
/**
 * @param { number } currentValue
 * @param { number } targetValue
 * @param { number } followRate 클수록 빠르게 붙습니다.
 * @param { number } timeDelta
 * @returns { number }
 */
export function approachValue(currentValue, targetValue, followRate, timeDelta) {
	const difference = targetValue - currentValue;
	const absoluteDifference = difference < 0 ? -difference : difference;
	if (absoluteDifference < 0.001) {
		return targetValue;
	}
	const followRatio = 1 - System.Math.exp(-followRate * timeDelta);
	return currentValue + difference * followRatio;
}
