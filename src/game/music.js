//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { readAudioContext, readMasterGain, isSoundEnabled } from "./beep.js";


//==============================================================================
// 배경음. (구워 둔 소리 파일을 이어 틉니다)
//
// 곡을 그 자리에서 합성하지 않고 파일로 둡니다. (사용자 지시, 2026-09-15,
// "모든 사운드는 다 파일로 생성하는게낫지않나", "니가만드는과정은 똑같더라도 파일이낫다고하는거야")
//   - 소리가 고정됩니다. 브라우저마다 WebAudio 구현이 미묘하게 달라도 같은 소리가 납니다.
//   - 만들며 들어 본 그 소리가 그대로 나갑니다. 만드는 쪽과 들리는 쪽이 어긋나지 않습니다.
//   - 오실레이터 수십 개를 실시간으로 돌리지 않습니다.
//   - 나중에 사람이 만든 곡으로 갈아 끼우기 쉽습니다. 파일만 바꾸면 됩니다.
//
// 파일은 `tools/generate-music.py` 가 굽습니다. 한 바퀴만 담겨 있고 여기서 이어 틉니다.
// 효과음은 `beep.js` 가 그대로 합성합니다. 짧고 자주 나며 높낮이를 바꿔 쓰기 때문입니다.
//==============================================================================


// 곡과 그 파일.
const MUSIC_PATHS = System.Object.freeze({
	town: "./assets/sounds/music/town.wav",
	shop: "./assets/sounds/music/shop.wav",
	dungeon: "./assets/sounds/music/dungeon.wav",
	battle: "./assets/sounds/music/battle.wav",
});

// 배경음이 전체 소리에서 차지하는 몫.
const MUSIC_VOLUME = 1.0;
// 켜고 끌 때 이만큼 걸쳐 오갑니다. (초)
const FADE_SECONDS = 0.9;
// 곳이 바뀔 때 앞 곡을 이만큼에 걸쳐 내립니다. (초)
const SWITCH_FADE_SECONDS = 0.12;


// 받아 둔 소리. (이름 → AudioBuffer)
const buffers = new Map();
// 받는 중인 것. (같은 곡을 두 번 받지 않습니다)
const pending = new Map();

let musicGain = null;
let sourceNode = null;
let trackName = "";
// 배경음만 따로 끕니다. 효과음은 `beep.js` 의 스위치가 맡습니다.
let isMusicTurnedOn = true;


//==============================================================================
// 배경음이 흘러가는 자리. (없으면 만듭니다)
//==============================================================================
/**
 * @returns { object | null }
 */
function readMusicGain() {
	const audioContext = readAudioContext();
	const masterGain = readMasterGain();
	if (audioContext === null || masterGain === null) {
		return null;
	}
	if (musicGain === null) {
		musicGain = audioContext.createGain();
		musicGain.gain.value = 0;
		musicGain.connect(masterGain);
	}
	return musicGain;
}


//==============================================================================
// 소리 파일 받기. (한 번 받으면 들고 있습니다)
//==============================================================================
/**
 * @param { string } name
 * @returns { Promise<object | null> }
 */
function loadMusic(name) {
	const kept = buffers.get(name);
	if (kept !== undefined) {
		return System.Promise.resolve(kept);
	}
	const running = pending.get(name);
	if (running !== undefined) {
		return running;
	}
	const audioContext = readAudioContext();
	const path = MUSIC_PATHS[name];
	if (audioContext === null || path === undefined) {
		return System.Promise.resolve(null);
	}
	const work = System.fetch(path)
		.then((response) => {
			return response.arrayBuffer();
		})
		.then((arrayBuffer) => {
			return audioContext.decodeAudioData(arrayBuffer);
		})
		.then((audioBuffer) => {
			buffers.set(name, audioBuffer);
			pending.delete(name);
			return audioBuffer;
		})
		.catch((error) => {
			console.error("배경음을 받지 못했습니다: " + path, error);
			pending.delete(name);
			return null;
		});
	pending.set(name, work);
	return work;
}


//==============================================================================
// 지금 흐르는 것 끊기.
//==============================================================================
/**
 * @param { number } fadeSeconds
 */
function cutCurrent(fadeSeconds) {
	const audioContext = readAudioContext();
	if (audioContext === null || sourceNode === null) {
		return;
	}
	const oldSource = sourceNode;
	const oldGain = musicGain;
	sourceNode = null;
	if (oldGain !== null) {
		const now = audioContext.currentTime;
		oldGain.gain.cancelScheduledValues(now);
		oldGain.gain.setValueAtTime(oldGain.gain.value, now);
		oldGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
		// 내려간 뒤에 끊습니다. 바로 끊으면 뚝 하고 잘립니다.
		System.setTimeout(() => {
			try {
				oldSource.stop();
			}
			catch (error) {
				// 이미 멎었으면 넘어갑니다.
			}
			oldGain.disconnect();
		}, (fadeSeconds + 0.05) * 1000);
	}
	// 다음 곡은 새 자리에서 올라옵니다.
	musicGain = null;
}


//==============================================================================
// 받아 둔 것을 틀기.
//==============================================================================
/**
 * @param { string } name
 * @param { object } audioBuffer
 */
function playBuffer(name, audioBuffer) {
	// 받는 사이에 곳이 또 바뀌었으면 버립니다.
	if (trackName !== name || audioBuffer === null) {
		return;
	}
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	if (audioContext.state === "suspended") {
		audioContext.resume().catch((error) => {
			console.error(error);
		});
	}
	const source = audioContext.createBufferSource();
	source.buffer = audioBuffer;
	// 파일에는 한 바퀴만 담겨 있습니다. 여기서 이어 틉니다.
	source.loop = true;
	source.connect(destination);
	source.start();
	sourceNode = source;
	const now = audioContext.currentTime;
	const wantedVolume = isSoundEnabled() && isMusicTurnedOn ? MUSIC_VOLUME : 0;
	destination.gain.cancelScheduledValues(now);
	destination.gain.setValueAtTime(destination.gain.value, now);
	destination.gain.linearRampToValueAtTime(wantedVolume, now + FADE_SECONDS);
}


//==============================================================================
// 배경음 켜고 끄기. (효과음과 따로입니다)
//==============================================================================
/**
 * @param { boolean } value
 */
export function setMusicEnabled(value) {
	isMusicTurnedOn = value;
	const audioContext = readAudioContext();
	if (audioContext === null || musicGain === null) {
		return;
	}
	const now = audioContext.currentTime;
	const wantedVolume = value && isSoundEnabled() && trackName !== "" ? MUSIC_VOLUME : 0;
	musicGain.gain.cancelScheduledValues(now);
	musicGain.gain.setValueAtTime(musicGain.gain.value, now);
	musicGain.gain.linearRampToValueAtTime(wantedVolume, now + (value ? FADE_SECONDS : 0.12));
}


/** @returns { boolean } 배경음 설정이 켜져 있는지. */
export function isMusicEnabled() {
	return isMusicTurnedOn;
}


//==============================================================================
// 배경음 켜기. (이미 그 곡이면 아무것도 하지 않습니다)
//==============================================================================
/**
 * @param { string } name
 */
export function startMusic(name) {
	if (MUSIC_PATHS[name] === undefined || trackName === name) {
		return;
	}
	const wasPlaying = trackName !== "";
	trackName = name;
	if (wasPlaying) {
		// 곳이 바뀌면 앞 곡을 그 자리에서 내립니다.
		cutCurrent(SWITCH_FADE_SECONDS);
	}
	const kept = buffers.get(name);
	if (kept !== undefined) {
		playBuffer(name, kept);
		return;
	}
	loadMusic(name).then((audioBuffer) => {
		playBuffer(name, audioBuffer);
	});
}


//==============================================================================
// 배경음 끄기.
//==============================================================================
export function stopMusic() {
	if (trackName === "") {
		return;
	}
	trackName = "";
	cutCurrent(FADE_SECONDS);
}


//==============================================================================
// 지금 흐르는 곡 이름. ("" 이면 없습니다)
//==============================================================================
/**
 * @returns { string }
 */
export function readMusicTrack() {
	return trackName;
}
