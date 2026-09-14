//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 효과음. (소리 자산 없이 WebAudio 로 그 자리에서 만듭니다)
//
// 그림이 없는 게임이라 손맛은 소리가 거듭니다. 전부 짧은 사각파, 삼각파입니다.
// 오디오 컨텍스트는 첫 입력 뒤에 열립니다. (브라우저 정책)
//==============================================================================


let audioContext = null;
let masterGain = null;
let isEnabled = true;
const MASTER_VOLUME = 0.32;


//==============================================================================
// 오디오 컨텍스트 열기. (첫 입력 때 한 번)
//==============================================================================
export function openAudio() {
	if (audioContext !== null) {
		if (audioContext.state === "suspended") {
			audioContext.resume().catch((error) => {
				console.error(error);
			});
		}
		return;
	}
	const AudioContextClass = System.window.AudioContext || System.window.webkitAudioContext;
	if (AudioContextClass === undefined || AudioContextClass === null) {
		return;
	}
	try {
		audioContext = new AudioContextClass();
		masterGain = audioContext.createGain();
		masterGain.gain.value = MASTER_VOLUME;
		masterGain.connect(audioContext.destination);
	}
	catch (error) {
		console.error(error);
		audioContext = null;
	}
}


//==============================================================================
// 소리 켬, 끔.
//==============================================================================
/**
 * @param { boolean } value
 */
export function setSoundEnabled(value) {
	isEnabled = value;
}


//==============================================================================
// 음 하나. (주파수, 길이, 파형, 시작 지연)
//==============================================================================
/**
 * @param { number } frequency
 * @param { number } seconds
 * @param { string } waveType "square" | "triangle" | "sawtooth" | "sine"
 * @param { number } delaySeconds
 * @param { number } volume
 * @param { number } [endFrequency] 끝 주파수. (없으면 그대로)
 */
function playTone(frequency, seconds, waveType, delaySeconds, volume, endFrequency) {
	if (!isEnabled || audioContext === null) {
		return;
	}
	if (audioContext.state === "suspended") {
		audioContext.resume().catch((error) => {
			console.error(error);
		});
	}
	const startTime = audioContext.currentTime + delaySeconds;
	const oscillator = audioContext.createOscillator();
	oscillator.type = waveType;
	oscillator.frequency.setValueAtTime(frequency, startTime);
	if (endFrequency !== undefined) {
		oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + seconds);
	}
	const gain = audioContext.createGain();
	gain.gain.setValueAtTime(volume, startTime);
	gain.gain.exponentialRampToValueAtTime(0.001, startTime + seconds);
	oscillator.connect(gain);
	gain.connect(masterGain);
	oscillator.start(startTime);
	oscillator.stop(startTime + seconds + 0.02);
}


//==============================================================================
// 커서 이동.
//==============================================================================
export function beepMove() {
	playTone(720, 0.045, "square", 0, 0.5);
}


//==============================================================================
// 확인. (두 음 올라감)
//==============================================================================
export function beepConfirm() {
	playTone(660, 0.06, "square", 0, 0.6);
	playTone(990, 0.09, "square", 0.05, 0.6);
}


//==============================================================================
// 취소, 되돌리기. (두 음 내려감)
//==============================================================================
export function beepCancel() {
	playTone(520, 0.06, "square", 0, 0.5);
	playTone(390, 0.09, "square", 0.05, 0.5);
}


//==============================================================================
// 막힘. (낮은 톱니)
//==============================================================================
export function beepBlocked() {
	playTone(130, 0.14, "sawtooth", 0, 0.7, 90);
}


//==============================================================================
// 판이 바뀜. (접힘, 밀림, 기울어짐, 휙 하는 스윕)
//==============================================================================
export function beepAction() {
	playTone(440, 0.11, "triangle", 0, 0.7, 880);
}


//==============================================================================
// 완료. (짧은 아르페지오)
//==============================================================================
export function beepClear() {
	playTone(523, 0.1, "square", 0, 0.6);
	playTone(659, 0.1, "square", 0.09, 0.6);
	playTone(784, 0.1, "square", 0.18, 0.6);
	playTone(1047, 0.28, "square", 0.27, 0.7);
}


//==============================================================================
// 배경음이 쓰는 것. (같은 오디오 컨텍스트에 얹습니다)
//
// 컨텍스트를 둘 열면 브라우저가 싫어하고 소리 설정도 갈라집니다. 그래서 배경음(`music.js`)이
// 여기에서 컨텍스트와 마지막 볼륨 마디를 빌려 갑니다.
//==============================================================================
/** @returns { object | null } 아직 열리지 않았으면 null. */
export function readAudioContext() {
	return audioContext;
}

/** @returns { object | null } 마지막 볼륨 마디. */
export function readMasterGain() {
	return masterGain;
}

/** @returns { boolean } 소리 설정이 켜져 있는지. */
export function isSoundEnabled() {
	return isEnabled;
}
