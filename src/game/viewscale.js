//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { ViewScaleMode } from "../../libs/vanilla.js/src/core/viewmanager.js";
import { setTextAntialiasEnabled } from "../../libs/vanilla.js/src/core/graphic/textstringtexturecache.js";
import { REFERENCE_RESOLUTION_WIDTH } from "./constants.js";


//==============================================================================
// 도트 고정 배율.
//
// 도트 글꼴이 고르게 보이려면 글자 텍스처가 정확히 1 배로 구워져야 합니다. 엔진은
// 캔버스 픽셀 크기에 맞춰 글자를 굽기 때문에, 캔버스의 백버퍼를 기준 해상도(1280 × 800)로
// 고정합니다. 창이 더 크면 CSS 가 보간 없이(image-rendering: pixelated) 키웁니다.
//
// 캔버스의 CSS 크기는 늘 16:10 입니다. (src/game/devicesize.js 가 맞춥니다) 그래서
// 뷰 스케일 모드는 가로 맞춤이면 충분합니다.
//
// ⚠️ 씬 load() 진입 직후와 resize 마다 부릅니다. 캔버스 CSS 크기가 바뀐 뒤여야 합니다.
//==============================================================================


//==============================================================================
// 백버퍼를 기준 해상도로 고정.
//==============================================================================
/**
 * @param { object } viewManager
 */
export function applyPixelFixedScale(viewManager) {
	// 도트 글꼴 모드. (구운 글자의 안티앨리어싱을 걷어 내고 텍스처를 보간 없이 찍습니다)
	setTextAntialiasEnabled(false);
	const canvasNativeSize = viewManager.getCanvasNativeSize();
	if (canvasNativeSize.x <= 0) {
		return;
	}
	// 백버퍼는 캔버스의 CSS 크기에 이 비율을 곱한 값입니다. 기준 해상도가 나오도록 잡습니다.
	// 창이 기준보다 작으면 1 을 넘어가는데, 엔진이 상한으로만 쓰므로 그때는 줄여 그립니다.
	const maxRenderPixelRatio = REFERENCE_RESOLUTION_WIDTH / canvasNativeSize.x;
	viewManager.setViewScaleMode(ViewScaleMode.stretchWidth);
	viewManager.setMaxRenderPixelRatio(maxRenderPixelRatio);
}
