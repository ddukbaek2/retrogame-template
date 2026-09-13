//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ScreenNode } from "../../../ui/screennode.js";
import { drawText } from "../../../game/text.js";
import { Command } from "../../../game/command.js";
import { beepConfirm, beepCancel } from "../../../game/beep.js";
import { Colors, UiFontSize, REFERENCE_RESOLUTION_WIDTH } from "../../../game/constants.js";
import { drawBox } from "../../../ui/box.js";


//==============================================================================
// 보기용 화면. (화면 하나가 어떻게 생겼는지 보여 주는 가장 작은 예)
//
// 화면은 `ScreenNode` 를 물려받고 두 가지만 채우면 섭니다.
//   handleCommand(command)  방향 넷, 확인, 취소, 메뉴가 들어옵니다.
//   draw(graphic)           그립니다. 맨 끝에 super.draw(graphic) 를 부릅니다.
//
// 색은 `Colors` 의 열쇠로만 말합니다. 값을 직접 적지 않습니다. 그래야 편마다의 색과
// 화면의 색 수 설정(1, 2, 4, 8 비트)을 앱이 알아서 맞춥니다.
// 글자 크기도 `UiFontSize` 의 단만 씁니다. 자세한 것은 `docs/UI-규약.md` 입니다.
//==============================================================================


// 글자를 놓는 자리.
const TITLE_CENTER_Y = 200;
const COUNT_CENTER_Y = 320;
const BEST_CENTER_Y = 400;
const HELP_CENTER_Y = 520;
// 네모 하나.
const BOX_LEFT_X = 340;
const BOX_TOP_Y = 270;
const BOX_WIDTH = 408;
const BOX_HEIGHT = 100;


export class PlayScreen extends ScreenNode {
	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } game
	 */
	constructor(game) {
		super(game, "samplePlayScreen");
	}

	//==============================================================================
	// 명령 처리.
	//==============================================================================
	/**
	 * @override
	 * @param { string } command
	 */
	handleCommand(command) {
		const game = this.getScene();
		if (command === Command.confirm) {
			beepConfirm();
			game.countUp();
			return;
		}
		if (command === Command.cancel) {
			// 셈이 남아 있으면 되돌리고, 없으면 게임 목록으로 나갑니다.
			beepCancel();
			const count = game.getCount();
			if (count > 0) {
				game.resetCount();
				return;
			}
			game.exit();
			return;
		}
		if (command === Command.menu) {
			beepConfirm();
			game.openSettings();
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { object } graphic
	 */
	draw(graphic) {
		const isVisible = this.isVisible();
		if (!isVisible) {
			return;
		}
		const game = this.getScene();
		// 화면이 들어올 때 옆에서 밀려 들어옵니다. 그 몫을 모든 자리에 더합니다.
		const offset = this.readEnterOffset();
		const centerX = REFERENCE_RESOLUTION_WIDTH * 0.5 + offset;
		drawText(graphic, game.getName(), centerX, TITLE_CENTER_Y, UiFontSize.title, Colors.textPrimary, "center");
		drawBox(graphic, BOX_LEFT_X + offset, BOX_TOP_Y, BOX_WIDTH, BOX_HEIGHT, Colors.textFaint);
		drawText(graphic, String(game.getCount()), centerX, COUNT_CENTER_Y, UiFontSize.title, Colors.accent, "center");
		drawText(graphic, "가장 많이 " + game.getBest(), centerX, BEST_CENTER_Y, UiFontSize.small, Colors.textDim, "center");
		drawText(graphic, "확인으로 세고, 취소로 되돌립니다.", centerX, HELP_CENTER_Y, UiFontSize.small, Colors.textDim, "center");
		super.draw(graphic);
	}
}
