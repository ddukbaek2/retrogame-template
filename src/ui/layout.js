//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Rect } from "../../libs/vanilla.js/src/base/rect.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";


//==============================================================================
// 노드 배치.
//
// 이 게임의 UI 는 전부 왼쪽 위를 기준으로 놓습니다. 노드의 기준점(pivot)과 앵커를
// 왼쪽 위로 두면 localPosition 이 곧 부모 안에서의 왼쪽 위 자리가 되어, 지금까지
// 자리 계산에 쓰던 Rect 값을 그대로 옮겨 놓을 수 있습니다.
//==============================================================================


//==============================================================================
// 노드를 부모 안의 자리에 놓습니다.
//==============================================================================
/**
 * @param { WorldNode } node
 * @param { number } leftX
 * @param { number } topY
 * @param { number } width
 * @param { number } height
 */
export function placeNode(node, leftX, topY, width, height) {
	node.setPivot(Pivot.topLeft);
	node.setAnchor(Pivot.topLeft);
	node.setLocalPosition(Vector2.create(leftX, topY));
	node.setContentSize(Vector2.create(width, height));
}


//==============================================================================
// 노드를 Rect 자리에 놓습니다.
//==============================================================================
/**
 * @param { WorldNode } node
 * @param { Rect } rect
 */
export function placeNodeAtRect(node, rect) {
	placeNode(node, rect.position.x, rect.position.y, rect.size.x, rect.size.y);
}


//==============================================================================
// 노드의 자리만 옮깁니다. (크기는 그대로)
//==============================================================================
/**
 * @param { WorldNode } node
 * @param { number } leftX
 * @param { number } topY
 */
export function moveNode(node, leftX, topY) {
	node.setLocalPosition(Vector2.create(leftX, topY));
}


//==============================================================================
// 노드 안에서의 제 영역 반환. (왼쪽 위가 0, 0)
//==============================================================================
/**
 * @param { WorldNode } node
 * @returns { Rect }
 */
export function readLocalRect(node) {
	const contentSize = node.getContentSize();
	return Rect.create(0, 0, contentSize.x, contentSize.y);
}


//==============================================================================
// 노드가 화면의 어디에 놓여 있는지 반환. (왼쪽 위 기준점, 배율 1 기준)
//==============================================================================
/**
 * @param { WorldNode } node
 * @returns { Rect }
 */
export function readWorldRect(node) {
	const worldPosition = node.getPosition();
	const contentSize = node.getContentSize();
	return Rect.create(worldPosition.x, worldPosition.y, contentSize.x, contentSize.y);
}


//==============================================================================
// 자식을 담기만 하는 빈 노드 생성.
//==============================================================================
/**
 * @param { string } name
 * @param { number } leftX
 * @param { number } topY
 * @param { number } width
 * @param { number } height
 * @returns { WorldNode }
 */
export function createContainerNode(name, leftX, topY, width, height) {
	const containerNode = new WorldNode();
	containerNode.setName(name);
	placeNode(containerNode, leftX, topY, width, height);
	return containerNode;
}
