//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { SampleGame } from "../games/sample/samplegame.js";


//==============================================================================
// 게임 목록. (여기에 적은 것이 허브에 섭니다)
//
// 게임 한 편을 더하려면 두 가지만 하면 됩니다.
//   1. `src/games/<id>/<id>game.js` 에 `GameModule` 을 물려받은 클래스를 씁니다.
//   2. 여기에 들여오고 아래 표에 한 줄 더합니다.
//
// 색은 `src/game/identity.js` 에서 편마다 정합니다. 거기에도 한 줄 더해야
// 그 편만의 종이 색과 먹 색을 씁니다.
//
// 자세한 것은 `docs/게임-모듈-규약.md` 를 보십시오.
//==============================================================================
const GAME_FACTORIES = System.Object.freeze([
	(scene) => {
		return new SampleGame(scene);
	},
]);


//==============================================================================
// 게임 모듈 전부 만들기.
//==============================================================================
/**
 * @param { object } scene
 * @returns { object[] }
 */
export function createGameModules(scene) {
	const modules = [];
	for (const factory of GAME_FACTORIES) {
		modules.push(factory(scene));
	}
	return modules;
}
