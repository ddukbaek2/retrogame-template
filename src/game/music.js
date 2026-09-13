//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { readAudioContext, readMasterGain, isSoundEnabled } from "./beep.js";


//==============================================================================
// 배경음. (소리 자산 없이 WebAudio 로 그 자리에서 만듭니다)
//
// 결은 고딕 호러입니다. 다만 음산하기만 하고 느리면 배경음으로 들리지 않습니다.
// (사용자 지적, 2026-09-13, "너무 느리고 bgm같지가 않아") 그래서 네 겹으로 짭니다.
//
//   낮은 줄   마디마다 내려가는 베이스. 박을 짚어 줍니다.
//   가락 줄   화음을 타고 오르내리는 여덟잇단 아르페지오. 이것이 곡처럼 들리게 합니다.
//   화음 줄   교회 오르간처럼 마디 내내 깔리는 화음.
//   덧소리    낮은 종과 바람. 이따금 한 번씩만 옵니다.
//
// 자리는 D 단조의 내려가는 베이스(D - C# - C - Bb)입니다. 옛 파사칼리아의 걸음이라
// 고딕한 결이 저절로 납니다.
//
// 미리 짜 두는 방식입니다. 0.12 초마다 깨어나 0.8 초 앞까지 컨텍스트 시계에 걸어 둡니다.
// 프레임이 밀려도 박자가 흔들리지 않습니다.
//==============================================================================


// 앞으로 이만큼까지 미리 걸어 둡니다. (초)
const SCHEDULE_AHEAD = 0.8;
// 곳이 바뀔 때 앞엣것을 끊는 데 드는 시간. (뚝 끊기지 않을 만큼만 짧게 둡니다)
const SWITCH_FADE_SECONDS = 0.08;
// 짜는 일을 이 간격으로 합니다. (밀리초)
const TICK_MILLISECONDS = 120;
// 배경음은 효과음보다 작아야 합니다.
const MUSIC_VOLUME = 0.5;
// 켜고 끌 때 이만큼 걸쳐 오갑니다. (초)
const FADE_SECONDS = 0.9;
// 한 마디는 네 박입니다.
const BEATS_PER_BAR = 4;
// 드론의 뿌리 음. (D1 언저리)
const DRONE_NOTE = 26;
// 베이스가 서는 자리. (D2)
const BASS_NOTE = 38;
// 화음이 서는 자리. (D3)
const CHORD_NOTE = 50;
// 가락이 서는 자리. (D4)
const LEAD_NOTE = 62;

// 자리 넷. (화음, 베이스) 내려가는 걸음입니다.
const LAMENT = System.Object.freeze([
	{ chord: [0, 3, 7], bass: 0 },
	{ chord: [1, 4, 9], bass: -11 },
	{ chord: [0, 3, 7], bass: -2 },
	{ chord: [-4, 0, 3], bass: -4 },
]);

// 곳마다의 배경음.
//
// **넷은 서로 다른 소리여야 합니다.** (사용자 지시, 2026-09-13) 자리만 바꾸면 다 비슷하게
// 들리므로 쓰는 악기와 겹의 짜임을 아예 다르게 둡니다.
//
//   네 곳이 다 고딕의 진중한 호러 한 결입니다. 드론과 오르간 화음이 바탕에 늘 깔리고,
//   곳마다 걸음의 빠르기와 두께, 얹히는 소리만 다릅니다.
//   (사용자 지적, 2026-09-13, "서로 다른 bgm 이더라도 어느 정도 테마는 맞출 수 있잖아",
//   "고딕의 진중한 호러 느낌 안에서")
//
//   마을  드론과 오르간을 얇게 깔고 가락만 성글게 지납니다. 종이 이따금 울립니다.
//   상점  마을과 같은 뜯는 줄입니다. 걸음이 조금 빠르고 화음이 한 단 밝습니다.
//   던전  드론과 오르간 화음이 주인공입니다. 가락은 성글고 종과 바람이 옵니다.
//   전투  북(잡음)과 톱니 저음 리프, 반음으로 떠는 줄. 화음은 거의 없습니다.
const TRACKS = System.Object.freeze({
	town: {
		// 같은 고딕 분위기 안에서 숨을 돌리는 자리입니다. 드론을 얇게 깔고 가락을 또렷하게 세웁니다.
		// 던전과 확실히 갈리도록 걸음을 빠르게 하고 낮은 소리를 걷어 냅니다.
		// (사용자 지적, 2026-09-13, "던전에 들어왔는데 왜 마을 bgm 이 계속 이어지냐")
		beatSeconds: 0.52,
		bars: [
			{ chord: [-4, 0, 3], bass: -16 },
			{ chord: [-5, -1, 2], bass: -17 },
			{ chord: [-2, 2, 5], bass: -14 },
			{ chord: [-4, 0, 3], bass: -16 },
		],
		padVolume: 0.07,
		bassVolume: 0.11,
		leadVolume: 0.1,
		droneVolume: 0.03,
		leadWave: "triangle",
		leadFilter: 2400,
		bassWave: "triangle",
		leadStep: 2,
		leadPattern: [0, 2, 1, 2],
		bassBeats: [0, 2],
		bellEveryBars: 0,
		windEveryBars: 0,
		stingCount: 0,
		drumPattern: [],
	},
	shop: {
		// 네 곳이 다 같은 고딕의 진중한 결입니다. 상점은 그 안에서 한 단만 열려 있습니다.
		// 드론과 오르간은 그대로 깔리고, 걸음이 조금 빠르며 화음이 어둡지만은 않습니다.
		// (사용자 지적, 2026-09-13, "무슨 빠찡꼬 bgm 이냐", "고딕의 진중한 호러 느낌 안에서")
		beatSeconds: 0.54,
		bars: [
			{ chord: [-4, 0, 3], bass: -16 },
			{ chord: [-2, 2, 5], bass: -14 },
			{ chord: [-5, -1, 3], bass: -17 },
			{ chord: [-4, 0, 3], bass: -16 },
		],
		padVolume: 0.13,
		bassVolume: 0.11,
		leadVolume: 0.07,
		droneVolume: 0.07,
		leadWave: "sine",
		leadFilter: 2100,
		bassWave: "triangle",
		leadStep: 2,
		leadPattern: [0, 2, 1, 2, 2, 0, 1, 2],
		bassBeats: [0, 2],
		bellEveryBars: 12,
		windEveryBars: 0,
		stingCount: 0,
		drumPattern: [],
	},
	dungeon: {
		// 마을과 한눈에, 한 귀에 갈려야 합니다. 걸음을 늦추고 바닥을 깔고 가락을 성글게 둡니다.
		// 낮은 종과 바람이 자주 지나가며 소리가 비는 자리를 메웁니다.
		beatSeconds: 0.88,
		bars: LAMENT,
		padVolume: 0.13,
		bassVolume: 0.13,
		leadVolume: 0.045,
		droneVolume: 0.13,
		leadWave: "sine",
		leadFilter: 1100,
		bassWave: "sawtooth",
		leadStep: 1,
		leadPattern: [0, 0, 2, 0],
		bassBeats: [0],
		bellEveryBars: 3,
		windEveryBars: 4,
		stingCount: 0,
		drumPattern: [],
	},
	battle: {
		beatSeconds: 0.3,
		bars: [
			{ chord: [0, 3, 6], bass: 0 },
			{ chord: [-1, 2, 5], bass: -1 },
			{ chord: [1, 4, 7], bass: 1 },
			{ chord: [0, 3, 6], bass: -2 },
		],
		padVolume: 0.02,
		bassVolume: 0.3,
		leadVolume: 0.05,
		droneVolume: 0.1,
		leadWave: "sawtooth",
		leadFilter: 1800,
		bassWave: "sawtooth",
		leadStep: 2,
		leadPattern: [0, 0, 1, 0, 2, 0, 1, 0],
		bassBeats: [0, 1, 2, 3],
		bellEveryBars: 0,
		windEveryBars: 0,
		stingCount: 16,
		// 북. 한 마디를 여덟로 쪼갠 자리에 (세기) 를 둡니다. 0 이면 치지 않습니다.
		drumPattern: [1, 0, 0.5, 0, 1, 0, 0.5, 0.7],
	},
});


let musicGain = null;
// 배경음만 따로 끕니다. 효과음은 `beep.js` 의 스위치가 맡습니다.
// (사용자 지시, 2026-09-14, "소리도 배경음 효과음 이렇게 나누고")
let isMusicTurnedOn = true;
let droneNodes = null;
let trackName = "";
let barIndex = 0;
let nextBarTime = 0;
let tickTimer = 0;


//==============================================================================
// 반음 번호를 주파수로. (A4 = 440)
//==============================================================================
/**
 * @param { number } noteNumber
 * @returns { number }
 */
function readFrequency(noteNumber) {
	return 440 * System.Math.pow(2, (noteNumber - 69) / 12);
}


//==============================================================================
// 배경음이 지나는 볼륨 마디. (효과음 마디에 얹습니다)
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
// 걸어 둔 음 한꺼번에 끊기. (곳이 바뀔 때 그 자리에서 갈아탑니다)
//
// 앞으로 0.8 초까지 미리 걸어 두기 때문에, 노드를 그대로 두면 이미 지나간 곳의 가락이
// 한 마디 더 울립니다. 매달려 있던 게인을 잘라 내고 새것으로 갈아 끼우면 바로 멎습니다.
// (사용자 지시, 2026-09-13, "각 bgm 은 바로 교체해야 되는데 지금 뭔가 교체 타이밍이 안 맞다")
//==============================================================================
function cutScheduledMusic() {
	const audioContext = readAudioContext();
	const masterGain = readMasterGain();
	if (audioContext === null || masterGain === null || musicGain === null) {
		return;
	}
	const oldGain = musicGain;
	const now = audioContext.currentTime;
	oldGain.gain.cancelScheduledValues(now);
	oldGain.gain.setValueAtTime(oldGain.gain.value, now);
	oldGain.gain.linearRampToValueAtTime(0, now + SWITCH_FADE_SECONDS);
	System.setTimeout(() => {
		oldGain.disconnect();
	}, 400);
	musicGain = audioContext.createGain();
	musicGain.gain.value = 0;
	musicGain.connect(masterGain);
}


//==============================================================================
// 드론 켜기. (아주 낮게 깔려 바닥을 채웁니다)
//==============================================================================
/**
 * @param { object } track
 */
function startDrone(track) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null || droneNodes !== null) {
		return;
	}
	if (track.droneVolume <= 0) {
		// 경쾌한 자리에서는 바닥을 깔지 않습니다.
		return;
	}
	const filter = audioContext.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 150;
	// Q 를 세우면 컷오프 언저리가 부풀어 저음이 웅웅거립니다. 울림만 커지고 가락이 묻힙니다.
	// (사용자 지적, 2026-09-13, "그냥 귀만 아픈데 울림만 존나 커서")
	filter.Q.value = 0.7;
	const gain = audioContext.createGain();
	gain.gain.value = track.droneVolume;
	filter.connect(gain);
	gain.connect(destination);

	const low = audioContext.createOscillator();
	low.type = "sawtooth";
	low.frequency.value = readFrequency(DRONE_NOTE);
	const fifth = audioContext.createOscillator();
	fifth.type = "triangle";
	fifth.frequency.value = readFrequency(DRONE_NOTE + 7) * 1.004;
	low.connect(filter);
	fifth.connect(filter);

	// 아주 느린 흔들림이 숨소리처럼 들립니다.
	const sway = audioContext.createOscillator();
	sway.type = "sine";
	sway.frequency.value = 0.06;
	const swayGain = audioContext.createGain();
	swayGain.gain.value = 60;
	sway.connect(swayGain);
	swayGain.connect(filter.frequency);

	low.start();
	fifth.start();
	sway.start();
	droneNodes = { low: low, fifth: fifth, sway: sway, gain: gain, filter: filter };
}


//==============================================================================
// 드론 끄기.
//==============================================================================
function stopDrone() {
	if (droneNodes === null) {
		return;
	}
	const audioContext = readAudioContext();
	const stopTime = audioContext === null ? 0 : audioContext.currentTime + FADE_SECONDS + 0.1;
	droneNodes.low.stop(stopTime);
	droneNodes.fifth.stop(stopTime);
	droneNodes.sway.stop(stopTime);
	droneNodes = null;
}


//==============================================================================
// 뜯는 음 하나. (베이스와 가락이 함께 씁니다)
//==============================================================================
/**
 * @param { number } noteNumber
 * @param { number } startTime
 * @param { number } seconds
 * @param { number } volume
 * @param { string } waveType
 * @param { number } filterHertz
 */
function schedulePluck(noteNumber, startTime, seconds, volume, waveType, filterHertz) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	const filter = audioContext.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.setValueAtTime(filterHertz, startTime);
	filter.frequency.exponentialRampToValueAtTime(filterHertz * 0.35, startTime + seconds);
	const gain = audioContext.createGain();
	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.linearRampToValueAtTime(volume, startTime + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + seconds);
	filter.connect(gain);
	gain.connect(destination);
	const oscillator = audioContext.createOscillator();
	oscillator.type = waveType;
	oscillator.frequency.value = readFrequency(noteNumber);
	oscillator.connect(filter);
	oscillator.start(startTime);
	oscillator.stop(startTime + seconds + 0.02);
}


//==============================================================================
// 긁는 줄 한 번. (반음으로 떠는 높은 줄, 조이는 느낌을 냅니다)
//==============================================================================
/**
 * @param { number } noteNumber
 * @param { number } startTime
 * @param { number } seconds
 * @param { number } volume
 */
function scheduleSting(noteNumber, startTime, seconds, volume) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	const gain = audioContext.createGain();
	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + seconds);
	gain.connect(destination);
	const oscillator = audioContext.createOscillator();
	oscillator.type = "sawtooth";
	oscillator.frequency.value = readFrequency(noteNumber);
	const filter = audioContext.createBiquadFilter();
	filter.type = "highpass";
	filter.frequency.value = 900;
	oscillator.connect(filter);
	filter.connect(gain);
	oscillator.start(startTime);
	oscillator.stop(startTime + seconds + 0.02);
}


//==============================================================================
// 북 한 번. (짧게 거른 잡음, 전투에서만 칩니다)
//==============================================================================
/**
 * @param { number } startTime
 * @param { number } volume
 */
function scheduleDrum(startTime, volume) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	const seconds = 0.16;
	const sampleCount = System.Math.floor(audioContext.sampleRate * seconds);
	const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let index = 0; index < sampleCount; ++index) {
		samples[index] = (System.Math.random() * 2 - 1) * (1 - index / sampleCount);
	}
	const source = audioContext.createBufferSource();
	source.buffer = buffer;
	const filter = audioContext.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.setValueAtTime(1400, startTime);
	filter.frequency.exponentialRampToValueAtTime(180, startTime + seconds);
	const gain = audioContext.createGain();
	gain.gain.setValueAtTime(volume, startTime);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + seconds);
	source.connect(filter);
	filter.connect(gain);
	gain.connect(destination);
	source.start(startTime);
	source.stop(startTime + seconds);
	// 북의 몸통. 낮은 사인이 함께 울려 가슴을 칩니다.
	const body = audioContext.createOscillator();
	const bodyGain = audioContext.createGain();
	body.type = "sine";
	body.frequency.setValueAtTime(readFrequency(DRONE_NOTE + 12), startTime);
	body.frequency.exponentialRampToValueAtTime(readFrequency(DRONE_NOTE), startTime + 0.12);
	bodyGain.gain.setValueAtTime(volume * 0.9, startTime);
	bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);
	body.connect(bodyGain);
	bodyGain.connect(destination);
	body.start(startTime);
	body.stop(startTime + 0.2);
}


//==============================================================================
// 화음 한 마디. (오르간처럼 마디 내내 깔립니다)
//==============================================================================
/**
 * @param { object } track
 * @param { number } startTime
 * @param { number[] } offsets
 * @param { number } seconds
 */
function scheduleChord(track, startTime, offsets, seconds) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	for (const offset of offsets) {
		const frequency = readFrequency(CHORD_NOTE + offset);
		const gain = audioContext.createGain();
		gain.gain.setValueAtTime(0.0001, startTime);
		gain.gain.exponentialRampToValueAtTime(track.padVolume, startTime + seconds * 0.18);
		gain.gain.setValueAtTime(track.padVolume, startTime + seconds * 0.7);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + seconds * 0.99);
		gain.connect(destination);
		// 두 줄을 아주 조금 어긋나게 울려 오르간 같은 분위기을 냅니다.
		for (let voice = 0; voice < 2; ++voice) {
			const oscillator = audioContext.createOscillator();
			oscillator.type = voice === 0 ? "triangle" : "sine";
			oscillator.frequency.value = voice === 0 ? frequency : frequency * 2.003;
			oscillator.connect(gain);
			oscillator.start(startTime);
			oscillator.stop(startTime + seconds);
		}
	}
}


//==============================================================================
// 종 한 번. (멀리서 울리는 낮은 종)
//==============================================================================
/**
 * @param { number } startTime
 */
function scheduleBell(startTime) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	const frequency = readFrequency(CHORD_NOTE - 12);
	const partials = [1, 2.01, 2.76];
	for (let index = 0; index < partials.length; ++index) {
		const gain = audioContext.createGain();
		const volume = 0.12 / (index + 1.6);
		gain.gain.setValueAtTime(volume, startTime);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.6 - index * 0.8);
		gain.connect(destination);
		const oscillator = audioContext.createOscillator();
		oscillator.type = "sine";
		oscillator.frequency.value = frequency * partials[index];
		oscillator.connect(gain);
		oscillator.start(startTime);
		oscillator.stop(startTime + 3.8);
	}
}


//==============================================================================
// 바람 한 자락. (좁게 거른 잡음이 지나갑니다)
//==============================================================================
/**
 * @param { number } startTime
 */
function scheduleWind(startTime) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	const seconds = 3.2;
	const sampleCount = System.Math.floor(audioContext.sampleRate * seconds);
	const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let index = 0; index < sampleCount; ++index) {
		samples[index] = System.Math.random() * 2 - 1;
	}
	const source = audioContext.createBufferSource();
	source.buffer = buffer;
	const filter = audioContext.createBiquadFilter();
	filter.type = "bandpass";
	filter.Q.value = 1.6;
	filter.frequency.setValueAtTime(240, startTime);
	filter.frequency.linearRampToValueAtTime(900, startTime + seconds * 0.5);
	filter.frequency.linearRampToValueAtTime(180, startTime + seconds);
	const gain = audioContext.createGain();
	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.linearRampToValueAtTime(0.04, startTime + seconds * 0.4);
	gain.gain.linearRampToValueAtTime(0.0001, startTime + seconds);
	source.connect(filter);
	filter.connect(gain);
	gain.connect(destination);
	source.start(startTime);
	source.stop(startTime + seconds);
}


//==============================================================================
// 한 마디 짜기. (베이스, 가락, 화음, 덧소리)
//==============================================================================
/**
 * @param { object } track
 * @param { number } startTime
 */
function scheduleBar(track, startTime) {
	const bar = track.bars[barIndex % track.bars.length];
	const beatSeconds = track.beatSeconds;
	const barSeconds = beatSeconds * BEATS_PER_BAR;

	// 화음.
	scheduleChord(track, startTime, bar.chord, barSeconds);

	// 베이스. 짚는 박마다 뿌리 음을 뜯습니다.
	for (const beat of track.bassBeats) {
		const isFirst = beat === 0;
		const noteNumber = BASS_NOTE + bar.bass;
		schedulePluck(noteNumber, startTime + beatSeconds * beat, beatSeconds * 0.9,
			track.bassVolume * (isFirst ? 1 : 0.72), track.bassWave, 320);
	}

	// 북. 전투에서만 칩니다.
	for (let index = 0; index < track.drumPattern.length; ++index) {
		const strength = track.drumPattern[index];
		if (strength <= 0) {
			continue;
		}
		scheduleDrum(startTime + barSeconds * index / track.drumPattern.length, 0.3 * strength);
	}

	// 가락. 화음의 음을 타고 오르내립니다.
	const stepSeconds = beatSeconds / track.leadStep;
	const stepCount = BEATS_PER_BAR * track.leadStep;
	for (let step = 0; step < stepCount; ++step) {
		const patternIndex = track.leadPattern[step % track.leadPattern.length];
		const offset = bar.chord[patternIndex % bar.chord.length];
		const octave = step % (stepCount / 2) === 0 ? 12 : 0;
		schedulePluck(LEAD_NOTE + offset + octave, startTime + stepSeconds * step,
			stepSeconds * 1.6, track.leadVolume, track.leadWave, track.leadFilter);
	}

	// 긁는 줄. 반음을 오가며 빠르게 떱니다.
	if (track.stingCount > 0) {
		const stingSeconds = barSeconds / track.stingCount;
		for (let index = 0; index < track.stingCount; ++index) {
			const noteNumber = LEAD_NOTE + 12 + bar.chord[0] + (index % 2);
			scheduleSting(noteNumber, startTime + stingSeconds * index, stingSeconds * 0.9, track.leadVolume * 0.5);
		}
	}

	// 덧소리.
	if (track.bellEveryBars > 0 && barIndex % track.bellEveryBars === 0) {
		scheduleBell(startTime + 0.05);
	}
	if (track.windEveryBars > 0 && barIndex % track.windEveryBars === 2) {
		scheduleWind(startTime + barSeconds * 0.3);
	}
}


//==============================================================================
// 깨어나 앞의 마디를 걸어 두기.
//==============================================================================
function tick() {
	const track = TRACKS[trackName];
	if (track === undefined) {
		return;
	}
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		// 아직 오디오가 열리지 않았습니다. (첫 입력 전) 열리면 그때부터 울립니다.
		return;
	}
	if (!isSoundEnabled() || !isMusicTurnedOn) {
		destination.gain.cancelScheduledValues(audioContext.currentTime);
		destination.gain.setValueAtTime(0, audioContext.currentTime);
		return;
	}
	if (audioContext.state === "suspended") {
		audioContext.resume().catch((error) => {
			console.error(error);
		});
	}
	startDrone(track);
	if (destination.gain.value < MUSIC_VOLUME) {
		destination.gain.cancelScheduledValues(audioContext.currentTime);
		destination.gain.setValueAtTime(destination.gain.value, audioContext.currentTime);
		destination.gain.linearRampToValueAtTime(MUSIC_VOLUME, audioContext.currentTime + FADE_SECONDS);
	}
	if (nextBarTime <= 0) {
		nextBarTime = audioContext.currentTime + 0.12;
	}
	const barSeconds = track.beatSeconds * BEATS_PER_BAR;
	while (nextBarTime < audioContext.currentTime + SCHEDULE_AHEAD) {
		scheduleBar(track, nextBarTime);
		nextBarTime += barSeconds;
		barIndex += 1;
	}
}


//==============================================================================
// 배경음 켜기. (곳이 바뀌면 이름만 바꿔 부릅니다)
//==============================================================================
/**
 * @param { string } name "town" | "shop" | "dungeon" | "battle"
 */
//==============================================================================
// 배경음 켜고 끄기. (효과음과 따로입니다)
//==============================================================================
/**
 * @param { boolean } value
 */
export function setMusicEnabled(value) {
	isMusicTurnedOn = value;
	if (value) {
		return;
	}
	// 끈 그 자리에서 소리를 내립니다. 다음 마디를 기다리지 않습니다.
	const audioContext = readAudioContext();
	if (audioContext === null || musicGain === null) {
		return;
	}
	musicGain.gain.cancelScheduledValues(audioContext.currentTime);
	musicGain.gain.setValueAtTime(0, audioContext.currentTime);
}

/** @returns { boolean } 배경음 설정이 켜져 있는지. */
export function isMusicEnabled() {
	return isMusicTurnedOn;
}


export function startMusic(name) {
	if (TRACKS[name] === undefined || trackName === name) {
		return;
	}
	const wasPlaying = trackName !== "";
	trackName = name;
	barIndex = 0;
	nextBarTime = 0;
	if (wasPlaying) {
		// 곳이 바뀌면 그 자리에서 바로 새 배경음으로 갑니다. 마디를 기다리지 않습니다.
		stopDrone();
		cutScheduledMusic();
	}
	if (tickTimer === 0) {
		tickTimer = System.setInterval(tick, TICK_MILLISECONDS);
	}
	tick();
}


//==============================================================================
// 배경음 끄기.
//==============================================================================
export function stopMusic() {
	if (trackName === "") {
		return;
	}
	trackName = "";
	if (tickTimer !== 0) {
		System.clearInterval(tickTimer);
		tickTimer = 0;
	}
	const audioContext = readAudioContext();
	if (audioContext !== null && musicGain !== null) {
		musicGain.gain.cancelScheduledValues(audioContext.currentTime);
		musicGain.gain.setValueAtTime(musicGain.gain.value, audioContext.currentTime);
		musicGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + FADE_SECONDS);
	}
	stopDrone();
	barIndex = 0;
	nextBarTime = 0;
}


//==============================================================================
// 지금 울리고 있는 곳. (검증이 씁니다)
//==============================================================================
/**
 * @returns { string } 꺼져 있으면 빈 값.
 */
export function readMusicTrack() {
	return trackName;
}
