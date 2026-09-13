//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { GAME_STORAGE_PREFIX, SETTINGS_STORAGE_KEY } from "./constants.js";


//==============================================================================
// 진행, 설정. (브라우저 localStorage, 없거나 막혀 있으면 조용히 실패합니다)
//
// 게임마다 제 이름으로 진행을 저장합니다. ("nographic:game:<id>", JSON 으로 적을 수 있는 값)
// 게임 한 편의 진행은 그 편이 제 꼴로 담습니다. (readGameData / writeGameData)
// 설정은 소리와 화면 모드이고 게임 전체가 함께 씁니다.
//==============================================================================


//==============================================================================
// localStorage 반환. (없으면 null)
//==============================================================================
/**
 * @returns { object }
 */
function readStorage() {
	try {
		const storage = System.window.localStorage;
		return storage !== undefined && storage !== null ? storage : null;
	}
	catch (error) {
		console.error(error);
		return null;
	}
}


//==============================================================================
// 게임 진행 읽기. (없으면 기본값, 기본값 객체에 저장된 값을 덮어 돌려줍니다)
//==============================================================================
/**
 * @param { string } gameId
 * @param { object } defaultData
 * @returns { object }
 */
export function readGameData(gameId, defaultData) {
	const storage = readStorage();
	if (storage === null) {
		return defaultData;
	}
	try {
		const savedText = storage.getItem(GAME_STORAGE_PREFIX + gameId);
		if (savedText === null || savedText === undefined) {
			return defaultData;
		}
		const savedData = System.JSON.parse(savedText);
		if (savedData === null || typeof savedData !== "object") {
			return defaultData;
		}
		return System.Object.assign(defaultData, savedData);
	}
	catch (error) {
		console.error(error);
		return defaultData;
	}
}


//==============================================================================
// 게임 진행 쓰기.
//==============================================================================
/**
 * @param { string } gameId
 * @param { object } data
 */
export function writeGameData(gameId, data) {
	const storage = readStorage();
	if (storage === null) {
		return;
	}
	try {
		storage.setItem(GAME_STORAGE_PREFIX + gameId, System.JSON.stringify(data));
	}
	catch (error) {
		console.error(error);
	}
}


//==============================================================================
// 모든 게임의 진행 지우기. (설정의 "진행 지우기")
//==============================================================================
export function clearAllGameData() {
	const storage = readStorage();
	if (storage === null) {
		return;
	}
	try {
		const removingKeys = [];
		for (let keyIndex = 0; keyIndex < storage.length; ++keyIndex) {
			const key = storage.key(keyIndex);
			if (key !== null && key.indexOf(GAME_STORAGE_PREFIX) === 0) {
				removingKeys.push(key);
			}
		}
		for (const key of removingKeys) {
			storage.removeItem(key);
		}
	}
	catch (error) {
		console.error(error);
	}
}



//==============================================================================
// 설정 기본값.
//==============================================================================
/**
 * @returns { object } { isSoundEnabled, isMusicEnabled, displayMode, isMonitorFrameEnabled, curveLevel, monitorColors }
 */
export function createDefaultSettings() {
	return { isSoundEnabled: true, isMusicEnabled: true, displayMode: "integer", isMonitorFrameEnabled: true, curveLevel: "high", monitorColors: "256" };
}


//==============================================================================
// 설정 읽기. (없으면 기본값)
//==============================================================================
/**
 * @returns { object }
 */
export function readSettings() {
	const defaultSettings = createDefaultSettings();
	const storage = readStorage();
	if (storage === null) {
		return defaultSettings;
	}
	try {
		const savedText = storage.getItem(SETTINGS_STORAGE_KEY);
		if (savedText === null || savedText === undefined) {
			return defaultSettings;
		}
		const savedSettings = System.JSON.parse(savedText);
		const mergedSettings = System.Object.assign(defaultSettings, savedSettings);
		// 예전에는 브라운관 하나였습니다. 프레임 보기, 볼록 효과 둘로 나누며 그 값을 이어받습니다.
		if (savedSettings.isCrtEnabled === false && savedSettings.isMonitorFrameEnabled === undefined) {
			mergedSettings.isMonitorFrameEnabled = false;
			mergedSettings.curveLevel = "off";
		}
		// 볼록 효과가 켬 끔이던 때의 값도 이어받습니다.
		if (savedSettings.isCurveEnabled === false && savedSettings.curveLevel === undefined) {
			mergedSettings.curveLevel = "off";
		}
		return mergedSettings;
	}
	catch (error) {
		console.error(error);
		return defaultSettings;
	}
}


//==============================================================================
// 설정 쓰기.
//==============================================================================
/**
 * @param { object } settings
 */
export function writeSettings(settings) {
	const storage = readStorage();
	if (storage === null) {
		return;
	}
	try {
		storage.setItem(SETTINGS_STORAGE_KEY, System.JSON.stringify(settings));
	}
	catch (error) {
		console.error(error);
	}
}
