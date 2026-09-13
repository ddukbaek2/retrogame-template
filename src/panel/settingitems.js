//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { DisplayModeOptions, MonitorColorOptions, CurveLevelOptions } from "../game/constants.js";


//==============================================================================
// 설정 항목. (앱 전체의 설정을 만들고 고치는 한 곳)
//
// **설정은 하나입니다. 화면만 둘입니다.**
//   타이틀에서는 `src/panel/settingswindow.js` 가 전체 화면 창으로 보여 주고,
//   게임 안에서는 그 게임의 메뉴 칸 안에 같은 항목이 섭니다.
// 어느 쪽에서 고치든 같은 값이고, 항목을 여기서 한 번만 적습니다.
// (사용자 지시, 2026-09-14, "타이틀설정과 게임설정이 분리된건 기존 노그래픽게임영향이니 그것도 합쳐놔",
//  "게임안에서도 바깥설정 디자인을 쓰네")
//
// 게임만의 항목은 `GameModule.createSettingItems()` 가 냅니다. 그것을 이 항목 앞에 세웁니다.
//==============================================================================


//==============================================================================
// 볼록 효과 칸의 값 열쇠. (모니터 프레임을 끄면 고를 수 없습니다)
//==============================================================================
/**
 * @param { object } settings
 * @returns { string }
 */
export function readCurveKey(settings) {
	if (settings.isMonitorFrameEnabled === false) {
		return "unavailable";
	}
	return settings.curveLevel;
}


//==============================================================================
// 볼록 효과 칸에 적을 말.
//==============================================================================
/**
 * @param { object } settings
 * @returns { string }
 */
export function readCurveText(settings) {
	if (settings.isMonitorFrameEnabled === false) {
		return "쓸 수 없음";
	}
	for (const option of CurveLevelOptions) {
		if (option.id === settings.curveLevel) {
			return option.name;
		}
	}
	return CurveLevelOptions[CurveLevelOptions.length - 1].name;
}


//==============================================================================
// 표에서 이름 찾기.
//==============================================================================
/**
 * @param { Array } options
 * @param { string } id
 * @returns { string }
 */
function readOptionName(options, id) {
	for (const option of options) {
		if (option.id === id) {
			return option.name;
		}
	}
	return options[0].name;
}


//==============================================================================
// 앱 설정 항목 만들기.
//
// `isEraseArmed` 는 데이터 초기화를 한 번 눌러 둔 상태입니다. 되돌릴 수 없어서 두 번 눌러야 합니다.
// `closeLabel` 은 화면마다 다릅니다. 창이면 "닫기", 게임 메뉴 안이면 그 게임이 쓰는 말입니다.
//==============================================================================
/**
 * @param { object } settings
 * @param { boolean } isEraseArmed
 * @returns { Array }
 */
export function createFrameSettingItems(settings, isEraseArmed) {
	const displayModeName = readOptionName(DisplayModeOptions, settings.displayMode);
	const monitorColorName = readOptionName(MonitorColorOptions, settings.monitorColors);
	// 소리는 효과음과 배경음을 따로 끕니다. (사용자 지시, 2026-09-14, "소리도 배경음 효과음 이렇게 나누고")
	// 색 수는 값이 전부 비트 수라 **색상 비트**라고 부릅니다. 이름과 값이 곰바로 이어집니다.
	const isMusicOn = settings.isMusicEnabled !== false;
	return [
		{ id: "sound", valueKey: settings.isSoundEnabled ? "on" : "off", label: "효과음", valueText: settings.isSoundEnabled ? "켬" : "끔" },
		{ id: "music", valueKey: isMusicOn ? "on" : "off", label: "배경음", valueText: isMusicOn ? "켬" : "끔" },
		{ id: "display", valueKey: settings.displayMode, label: "화면 크기", valueText: displayModeName },
		{ id: "frame", valueKey: settings.isMonitorFrameEnabled === false ? "off" : "on", label: "모니터 프레임", valueText: settings.isMonitorFrameEnabled === false ? "끔" : "켬" },
		{ id: "curve", valueKey: readCurveKey(settings), label: "볼록 효과", valueText: readCurveText(settings) },
		{ id: "grid", label: "볼록 확인 격자" },
		{ id: "colors", valueKey: settings.monitorColors, label: "색상 비트", valueText: monitorColorName },
		{ id: "reset", label: "설정 초기화" },
		{ id: "erase", label: isEraseArmed ? "정말 초기화" : "데이터 초기화" },
	];
}


//==============================================================================
// 여러 말을 지원하는 게임이 있으면 이름과 값을 그 말로 바꿉니다.
//==============================================================================
/**
 * @param { Array } items
 * @param { object } gameModule
 */
export function applyGameLabels(items, gameModule) {
	if (gameModule === null || gameModule === undefined) {
		return;
	}
	for (const item of items) {
		item.label = gameModule.readSettingLabel(item.id, item.label);
		if (item.valueKey !== undefined) {
			item.valueText = gameModule.readSettingValue(item.id, item.valueKey, item.valueText);
		}
	}
}


//==============================================================================
// 앱 설정 항목 고치기.
//
// 데이터 초기화만 화면이 상태를 들고 있어야 해서 `eraseState` 로 주고받습니다.
// `{ isArmed: boolean }` 하나를 넘기면 여기서 고쳐 돌려줍니다.
//==============================================================================
/**
 * @param { object } scene
 * @param { string } itemId
 * @param { number } direction
 * @param { object } eraseState
 * @returns { boolean } 이 자리에서 처리했으면 true.
 */
export function handleFrameSettingItem(scene, itemId, direction, eraseState) {
	const settings = scene.getSettings();
	switch (itemId) {
		case "sound": {
			settings.isSoundEnabled = !settings.isSoundEnabled;
			scene.applySettings();
			return true;
		}
		case "music": {
			settings.isMusicEnabled = settings.isMusicEnabled === false;
			scene.applySettings();
			return true;
		}
		case "display": {
			let optionIndex = 0;
			for (let index = 0; index < DisplayModeOptions.length; ++index) {
				if (DisplayModeOptions[index].id === settings.displayMode) {
					optionIndex = index;
				}
			}
			const optionCount = DisplayModeOptions.length;
			optionIndex = (optionIndex + direction + optionCount) % optionCount;
			settings.displayMode = DisplayModeOptions[optionIndex].id;
			scene.applySettings();
			return true;
		}
		case "frame": {
			settings.isMonitorFrameEnabled = settings.isMonitorFrameEnabled === false;
			scene.applySettings();
			return true;
		}
		case "curve": {
			// 모니터 프레임이 꺼져 있으면 볼록 효과를 쓸 수 없습니다.
			if (settings.isMonitorFrameEnabled === false) {
				return true;
			}
			let optionIndex = CurveLevelOptions.length - 1;
			for (let index = 0; index < CurveLevelOptions.length; ++index) {
				if (CurveLevelOptions[index].id === settings.curveLevel) {
					optionIndex = index;
				}
			}
			const optionCount = CurveLevelOptions.length;
			optionIndex = (optionIndex + direction + optionCount) % optionCount;
			settings.curveLevel = CurveLevelOptions[optionIndex].id;
			scene.applySettings();
			return true;
		}
		case "colors": {
			let optionIndex = 0;
			for (let index = 0; index < MonitorColorOptions.length; ++index) {
				if (MonitorColorOptions[index].id === settings.monitorColors) {
					optionIndex = index;
				}
			}
			const optionCount = MonitorColorOptions.length;
			optionIndex = (optionIndex + direction + optionCount) % optionCount;
			settings.monitorColors = MonitorColorOptions[optionIndex].id;
			scene.applySettings();
			return true;
		}
		case "grid": {
			// 켬 끔이 아니라 한 번 보여 주는 것입니다. 확인이나 취소를 누르면 되돌아옵니다.
			settings.isTestGridEnabled = true;
			scene.applySettings();
			return true;
		}
		case "reset": {
			scene.resetSettings();
			return true;
		}
		case "erase": {
			if (eraseState.isArmed) {
				scene.eraseProgress();
				eraseState.isArmed = false;
			}
			else {
				eraseState.isArmed = true;
			}
			return true;
		}
		default: {
			return false;
		}
	}
}
