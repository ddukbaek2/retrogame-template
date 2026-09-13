//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { placeNode } from "./layout.js";
import { drawText } from "../game/text.js";
import { easeOutCubic } from "../game/easing.js";
import { Colors, UiFontSize, REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT, ENTER_SHIFT, ENTER_SECONDS, HEADER_CENTER_Y, HEADER_SIDE_MARGIN, HINT_CENTER_Y } from "../game/constants.js";


//==============================================================================
// 화면 바탕.
//
// 화면은 전부 이 노드를 상속합니다. 화면 하나만 켜져 있고, 명령은 켜진 화면이 받습니다.
// 화면에 들어올 때 글자들이 오른쪽에서 살짝 밀려 들어옵니다. (readEnterOffset)
//==============================================================================



export class ScreenNode extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #scene;
	/** @private @type { number } */ #enterTimer;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } scene
	 * @param { string } name
	 */
	constructor(scene, name) {
		super();
		this.setName(name);
		placeNode(this, 0, 0, REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT);
		this.#scene = scene;
		this.#enterTimer = ENTER_SECONDS;
	}

	/** @returns { object } */
	getScene() {
		return this.#scene;
	}

	//==============================================================================
	// 화면 진입. (파생 화면은 super.onEnter() 를 부릅니다)
	//==============================================================================
	onEnter() {
		this.#enterTimer = 0;
	}

	//==============================================================================
	// 들어오는 연출 건너뛰기. (같은 자리에서 속만 갈아 끼울 때)
	//
	// 메뉴에서 항목을 옮기면 화면이 바뀌지만 눈에는 오른쪽 칸의 속만 바뀝니다.
	// 그때마다 밀려 들어오는 연출을 다시 틀면 화면 전체가 흔들립니다.
	// (사용자 지적, 2026-09-13, "메뉴에서 항목 바뀔 때마다 전체가 매번 흔들리는데")
	//==============================================================================
	skipEnterMotion() {
		this.#enterTimer = ENTER_SECONDS;
	}

	//==============================================================================
	// 화면을 벗어남.
	//==============================================================================
	onLeave() {

	}

	//==============================================================================
	// 명령 처리. (파생 화면이 채웁니다)
	//==============================================================================
	/**
	 * @param { string } command
	 */
	handleCommand(command) {

	}

	//==============================================================================
	// 들어오는 움직임의 가로 오프셋. (0 이 제자리)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readEnterOffset() {
		const ratio = easeOutCubic(System.Math.min(1, this.#enterTimer / ENTER_SECONDS));
		return System.Math.round(ENTER_SHIFT * (1 - ratio));
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#enterTimer += timeDelta;
	}

	//==============================================================================
	// 가리킨 곳 처리. (마우스, 손가락, 화면 안의 목록에서 그 자리의 항목을 고릅니다)
	//
	// 돌려주는 값: "confirm" 고른 뒤 확인까지, "select" 고르기만, "none" 목록이 없음.
	//==============================================================================
	/**
	 * @param { number } pointX
	 * @param { number } pointY
	 * @returns { string }
	 */
	handlePointerPress(pointX, pointY) {
		const children = this.getChildren();
		for (const child of children) {
			if (typeof child.findItemIndexAt !== "function") {
				continue;
			}
			const itemIndex = child.findItemIndexAt(pointX, pointY);
			if (itemIndex < 0) {
				continue;
			}
			child.setSelectedIndex(itemIndex);
			return "confirm";
		}
		return "none";
	}

	//==============================================================================
	// 아래 안내 줄.
	//
	// 이제 그리지 않습니다. (사용자 지시, 2026-09-10, "방향키 고르기, 확인 정하기, 취소 이어하기
	// 이런 문구 없애 버려") 화면마다 부르는 자리가 삼백 곳이 넘어 자리를 남겨 두고 여기서 막습니다.
	//==============================================================================
	/**
	 * @param { object } graphic
	 * @param { string } hintText
	 */
	drawHint(graphic, hintText) {
	}

	//==============================================================================
	// 머리글. (왼쪽, 오른쪽)
	//==============================================================================
	/**
	 * @param { object } graphic
	 * @param { string } leftText
	 * @param { string } rightText
	 */
	drawHeader(graphic, leftText, rightText) {
		const offset = this.readEnterOffset();
		if (leftText !== "") {
			drawText(graphic, leftText, HEADER_SIDE_MARGIN + offset, HEADER_CENTER_Y, UiFontSize.small, Colors.textDim, "left");
		}
		if (rightText !== "") {
			drawText(graphic, rightText, REFERENCE_RESOLUTION_WIDTH - HEADER_SIDE_MARGIN + offset, HEADER_CENTER_Y, UiFontSize.small, Colors.textDim, "right");
		}
	}
}
