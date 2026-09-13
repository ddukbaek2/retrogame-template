//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../../libs/vanilla.js/src/base/rect.js";
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";


//==============================================================================
// 그리기용 임시 값 객체.
//
// 엔진의 그리기 함수는 Rect, Vector2 를 인자로 받고 **그 자리에서 값을 읽어 정점 버퍼에
// 옮겨 적습니다.** 그러니 프레임마다 새 객체를 만들 이유가 없습니다. 여기서는 미리 만들어
// 둔 객체를 돌려 가며 빌려 줍니다. (이전에는 매 프레임 수천 개를 만들었고, 그것이 CPU 를 먹었습니다)
//
// 규칙.
//   - 빌린 객체는 **그리기 함수에 넘기는 동안만** 씁니다. 저장하지 않습니다.
//   - 고리를 돌려 가며 빌려 주므로, 한 번에 살아 있는 값이 고리 크기보다 적으면 서로 겹치지 않습니다.
//     **빌린 객체를 들고 있는 채로 긴 반복문에서 또 빌리면 덮어써집니다.** 그런 자리에서는 값을 숫자로 옮겨 둡니다.
//     (대화 창의 격자 무늬 120 개가 박스 사각형을 덮어써 글자가 한 자씩 줄바꿈된 적이 있습니다)
//   - 저장해 둘 값(캐시, 노드 자리, 연출 자료)은 여전히 `Rect.create` / `Vector2.create` 로 만듭니다.
//==============================================================================
const RECT_RING_SIZE = 512;
const VECTOR_RING_SIZE = 1024;

const rectRing = [];
const vectorRing = [];
for (let rectIndex = 0; rectIndex < RECT_RING_SIZE; ++rectIndex) {
	rectRing.push(Rect.create(0, 0, 0, 0));
}
for (let vectorIndex = 0; vectorIndex < VECTOR_RING_SIZE; ++vectorIndex) {
	vectorRing.push(Vector2.create(0, 0));
}
let rectCursor = 0;
let vectorCursor = 0;


//==============================================================================
// 임시 Rect 빌리기.
//==============================================================================
/**
 * @param { number } leftX
 * @param { number } topY
 * @param { number } width
 * @param { number } height
 * @returns { Rect }
 */
export function readRect(leftX, topY, width, height) {
	const rect = rectRing[rectCursor];
	rectCursor = (rectCursor + 1) % RECT_RING_SIZE;
	const position = rect.position;
	const size = rect.size;
	position.x = leftX;
	position.y = topY;
	size.x = width;
	size.y = height;
	return rect;
}


//==============================================================================
// 임시 Vector2 빌리기.
//==============================================================================
/**
 * @param { number } x
 * @param { number } y
 * @returns { Vector2 }
 */
export function readVector(x, y) {
	const vector = vectorRing[vectorCursor];
	vectorCursor = (vectorCursor + 1) % VECTOR_RING_SIZE;
	vector.x = x;
	vector.y = y;
	return vector;
}
