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
// 배경음이 전체 소리에서 차지하는 몫. 효과음과 같은 master 를 지나므로 이 값이 곧 상대 크기입니다.
// 0.5 로 두었더니 있는지 없는지 모를 만큼 작았습니다. (사용자 지적, 2026-09-15, "너무 소리크기가 작았어")
const MUSIC_VOLUME = 1.0;
// 켜고 끌 때 이만큼 걸쳐 오갑니다. (초)
const FADE_SECONDS = 0.9;
// 한 마디는 네 박입니다.
// 한 마디의 박 수. 곡이 제 값을 가지면 그것을 씁니다.
// 셋이면 왈츠, 다섯이면 발이 안 맞아 불안합니다. 박자가 다르면 곡이 근본부터 달라집니다.
const BEATS_PER_BAR = 4;

//==============================================================================
// 음계. (가락이 고르는 음)
//
// 가락을 화음 구성음에서만 뽑으면 어떤 곡이든 같은 세 음만 울려 다 비슷하게 들립니다.
// 곡마다 음계를 달리 주어야 색이 갈립니다. 값은 뿌리음에서 센 반음 수입니다.
//==============================================================================
const Scales = System.Object.freeze({
	// 도리안. 단조인데 여섯째 음이 밝습니다. 애잔하지만 숨은 쉬어집니다.
	dorian: [0, 2, 3, 5, 7, 9, 10],
	// 자연 단조. 흔하고 사람 냄새가 납니다.
	minor: [0, 2, 3, 5, 7, 8, 10],
	// 로크리안. 다섯째 음이 반음 낮아 어디에도 기댈 데가 없습니다.
	locrian: [0, 1, 3, 5, 6, 8, 10],
	// 프리지안. 둘째 음이 반음이라 바짝 조입니다.
	phrygian: [0, 1, 3, 5, 7, 8, 10],
});
// 드론의 뿌리 음. (D1 언저리)
const DRONE_NOTE = 26;
// 베이스가 서는 자리. (D2)
const BASS_NOTE = 38;
// 화음이 서는 자리. (D3)
const CHORD_NOTE = 50;
// 가락이 서는 자리. (D4)
const LEAD_NOTE = 62;
// 아르페지오 반주가 서는 자리. 선율보다 한 옥타브 아래입니다.
const ARP_NOTE = 50;

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
	// 마을. 3 박 왈츠입니다.
	//
	// 네 곳 가운데 여기만 박이 셋이라 걸음이 돌아가듯 얹힙니다. 도리안이라 단조인데도
	// 여섯째 음이 밝아 애잔한 쪽입니다. 선율이 네 마디에 걸쳐 오르내리며 노래합니다.
	// 아르페지오가 박마다 화음을 쪼개 깔고, 베이스는 첫 박만 짚습니다.
	town: {
		beatsPerBar: 3,
		beatSeconds: 0.46,
		scale: Scales.dorian,
		leadRoot: 0,
		bars: [
			{ chord: [0, 3, 7], bass: -12, lead: 0 },
			{ chord: [-2, 2, 5], bass: -14, lead: 0 },
			{ chord: [3, 7, 10], bass: -9, lead: 0 },
			{ chord: [-2, 2, 7], bass: -14, lead: 0 },
		],
		padVolume: 0.025,
		bassVolume: 0.11,
		leadVolume: 0.1,
		droneVolume: 0.015,
		leadWave: "triangle",
		leadFilter: 2800,
		leadVibrato: 14,
		bassWave: "triangle",
		leadStep: 2,
		leadHold: 1.5,
		// 네 마디 스물넷 자리를 한 선율로 씁니다. (3 박 × 2 쪼갬 × 4 마디)
		leadPattern: [
			4, null, 5, null, 4, 2,
			3, null, 2, null, 0, null,
			4, null, 5, 6, 5, 4,
			2, null, 3, 2, 0, null,
		],
		bassBeats: [0],
		arpVolume: 0.045,
		arpStep: 6,
		arpWave: "square",
		arpFilter: 1700,
		arpRoot: 0,
		bellEveryBars: 0,
		windEveryBars: 0,
		stingCount: 0,
		drumPattern: [],
	},
	// 상점. 4 박에 걷는 베이스입니다.
	//
	// 사람을 마주하는 자리라 넷 가운데 가장 움직임이 많습니다. 베이스가 박마다 걸어 다니고
	// 아르페지오가 열여섯으로 잘게 구릅니다. 선율은 짧은 모티프를 부르고 받습니다.
	shop: {
		beatsPerBar: 4,
		beatSeconds: 0.4,
		scale: Scales.minor,
		leadRoot: 0,
		bars: [
			{ chord: [0, 3, 7], bass: -12, lead: 0 },
			{ chord: [-4, 0, 5], bass: -16, lead: 0 },
			{ chord: [-5, -1, 3], bass: -17, lead: -2 },
			{ chord: [-2, 2, 7], bass: -14, lead: 0 },
		],
		padVolume: 0.02,
		bassVolume: 0.12,
		leadVolume: 0.085,
		droneVolume: 0,
		leadWave: "square",
		leadFilter: 2500,
		leadVibrato: 10,
		bassWave: "triangle",
		leadStep: 2,
		leadHold: 0.85,
		// 서른두 자리. 앞 여덟을 부르고 다음 여덟이 받습니다.
		leadPattern: [
			2, 4, 2, null, 4, 2, 0, null,
			0, 2, 4, null, 2, 0, null, null,
			4, 5, 4, 2, 4, null, 2, null,
			2, 1, 0, null, 2, null, null, null,
		],
		bassBeats: [0, 1, 2, 3],
		arpVolume: 0.04,
		arpStep: 16,
		arpWave: "square",
		arpFilter: 2000,
		arpRoot: 0,
		bellEveryBars: 0,
		windEveryBars: 0,
		stingCount: 0,
		drumPattern: [],
	},
	// 던전. 5 박입니다.
	//
	// 홀수 박이라 걸음과 박자가 맞지 않습니다. 발이 어긋나는 것이 그대로 불안이 됩니다.
	// 로크리안이라 다섯째 음이 반음 낮아 기댈 데가 없습니다.
	// 아르페지오도 아주 성글게 굴러 빈자리를 그대로 둡니다. 종과 바람이 그 자리를 지납니다.
	dungeon: {
		beatsPerBar: 5,
		beatSeconds: 0.8,
		scale: Scales.locrian,
		leadRoot: -12,
		bars: [
			{ chord: [0, 3, 6], bass: -12, lead: 0 },
			{ chord: [0, 3, 6], bass: -12, lead: 0 },
			{ chord: [-1, 3, 6], bass: -13, lead: -1 },
			{ chord: [-3, 1, 6], bass: -15, lead: -3 },
		],
		padVolume: 0.1,
		bassVolume: 0.11,
		leadVolume: 0.055,
		droneVolume: 0.13,
		leadWave: "sine",
		leadFilter: 1000,
		leadVibrato: 22,
		bassWave: "sawtooth",
		leadStep: 1,
		leadHold: 2.4,
		// 스무 자리에 여섯 음뿐입니다. 나머지는 정적입니다.
		leadPattern: [
			0, null, null, 4, null,
			null, null, 2, null, null,
			1, null, null, null, 4,
			null, 0, null, null, null,
		],
		bassBeats: [0],
		arpVolume: 0.022,
		arpStep: 5,
		arpWave: "triangle",
		arpFilter: 900,
		arpRoot: -12,
		bellEveryBars: 3,
		windEveryBars: 4,
		stingCount: 0,
		drumPattern: [],
	},
	// 전투. 4 박을 빠르게 몰아칩니다.
	//
	// 프리지안이라 둘째 음이 반음입니다. 그 반음이 계속 스쳐 바짝 조입니다.
	// 화음이 반음씩 기어 내려가고 베이스가 박마다 내려찍습니다.
	// 아르페지오가 열여섯으로 구르고 북이 뒤를 받칩니다.
	battle: {
		beatsPerBar: 4,
		beatSeconds: 0.27,
		scale: Scales.phrygian,
		leadRoot: 0,
		bars: [
			{ chord: [0, 3, 7], bass: -12, lead: 0 },
			{ chord: [-1, 3, 6], bass: -13, lead: -1 },
			{ chord: [-2, 1, 5], bass: -14, lead: -2 },
			{ chord: [-3, 1, 4], bass: -15, lead: -3 },
		],
		padVolume: 0.015,
		bassVolume: 0.26,
		leadVolume: 0.075,
		droneVolume: 0.07,
		leadWave: "square",
		leadFilter: 2400,
		leadVibrato: 8,
		bassWave: "sawtooth",
		leadStep: 2,
		leadHold: 0.8,
		// 서른두 자리. 치받았다 내려꽂습니다.
		leadPattern: [
			0, 1, 0, 1, 4, null, 3, null,
			2, 1, 0, null, 1, null, 0, null,
			0, 1, 2, 3, 4, null, 5, null,
			4, 3, 2, 1, 0, null, null, null,
		],
		bassBeats: [0, 1, 2, 3],
		arpVolume: 0.035,
		arpStep: 16,
		arpWave: "square",
		arpFilter: 2200,
		arpRoot: 0,
		bellEveryBars: 0,
		windEveryBars: 0,
		stingCount: 0,
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
function schedulePluck(noteNumber, startTime, seconds, volume, waveType, filterHertz, vibratoCents) {
	const audioContext = readAudioContext();
	const destination = readMusicGain();
	if (audioContext === null || destination === null) {
		return;
	}
	const filter = audioContext.createBiquadFilter();
	filter.type = "lowpass";
	// 필터를 너무 닫으면 배음이 다 깎여 소리가 둔해집니다. 8 비트 음원의 맛은 그 배음에 있습니다.
	// 0.35 배까지 닫았더니 2800Hz 가 980Hz 가 되어 선율이 뭉개졌습니다.
	// (사용자 지적, 2026-09-15, "wav 가 훨씬 다채롭게 들리는데")
	filter.frequency.setValueAtTime(filterHertz, startTime);
	filter.frequency.exponentialRampToValueAtTime(filterHertz * 0.8, startTime + seconds);
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
	// 비브라토. 음을 조금 떨어 줍니다. 옛 8 비트 음원이 선율을 살리던 방법입니다.
	// 길게 끄는 음에만 걸고, 짧게 스치는 음에는 걸지 않습니다.
	if (vibratoCents > 0 && seconds > 0.2) {
		const vibrato = audioContext.createOscillator();
		vibrato.type = "sine";
		vibrato.frequency.value = 5.5;
		const vibratoGain = audioContext.createGain();
		// 센트를 주파수 폭으로 바꿉니다. (한 반음이 100 센트)
		vibratoGain.gain.value = readFrequency(noteNumber) * (System.Math.pow(2, vibratoCents / 1200) - 1);
		vibrato.connect(vibratoGain);
		vibratoGain.connect(oscillator.frequency);
		vibrato.start(startTime + 0.08);
		vibrato.stop(startTime + seconds);
	}
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
// 아르페지오 반주. (화음을 빠르게 쪼개 올렸다 내립니다)
//
// 옛 8 비트 음원은 채널이 넷뿐이라 화음을 한꺼번에 누르지 못했습니다. 그래서 화음의 음을
// 아주 빠르게 번갈아 쳐서 화음처럼 들리게 했습니다. 이 결이 곧 그 시절 소리입니다.
// 긴 패드를 까는 것과는 전혀 다르게 들립니다.
//==============================================================================
/**
 * @param { object } track
 * @param { Array } chord
 * @param { number } startTime
 * @param { number } barSeconds
 */
function scheduleArpeggio(track, chord, startTime, barSeconds) {
	if (track.arpVolume <= 0 || track.arpStep <= 0) {
		return;
	}
	const stepCount = track.arpStep;
	const stepSeconds = barSeconds / stepCount;
	for (let index = 0; index < stepCount; ++index) {
		// 올라갔다 내려오는 차례입니다. 한 방향으로만 돌면 기계처럼 들립니다.
		const span = chord.length * 2 - 2;
		let chordIndex = span <= 0 ? 0 : index % span;
		if (chordIndex >= chord.length) {
			chordIndex = span - chordIndex;
		}
		const noteNumber = ARP_NOTE + track.arpRoot + chord[chordIndex];
		schedulePluck(noteNumber, startTime + stepSeconds * index, stepSeconds * 0.92,
			track.arpVolume, track.arpWave, track.arpFilter, 0);
	}
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
	const beatsPerBar = track.beatsPerBar === undefined ? BEATS_PER_BAR : track.beatsPerBar;
	const barSeconds = beatSeconds * beatsPerBar;

	// 화음. 길게 까는 패드는 얇게 두고, 아르페지오가 반주를 맡습니다.
	scheduleChord(track, startTime, bar.chord, barSeconds);
	scheduleArpeggio(track, bar.chord, startTime, barSeconds);

	// 베이스. 짚는 박마다 뿌리 음을 뜯습니다.
	for (const beat of track.bassBeats) {
		const isFirst = beat === 0;
		const noteNumber = BASS_NOTE + bar.bass;
		schedulePluck(noteNumber, startTime + beatSeconds * beat, beatSeconds * 0.9,
			track.bassVolume * (isFirst ? 1 : 0.72), track.bassWave, 900);
	}

	// 북. 전투에서만 칩니다.
	for (let index = 0; index < track.drumPattern.length; ++index) {
		const strength = track.drumPattern[index];
		if (strength <= 0) {
			continue;
		}
		scheduleDrum(startTime + barSeconds * index / track.drumPattern.length, 0.3 * strength);
	}

	// 가락. 곡의 음계에서 음을 골라 오르내립니다.
	//
	// 가락 패턴의 값은 **음계의 자리**입니다. 마이너스면 아래 옥타브로 내려갑니다.
	// `null` 이면 그 자리는 쉽니다. 쉬는 자리가 있어야 곡이 늘어지지 않습니다.
	const stepSeconds = beatSeconds / track.leadStep;
	const stepCount = beatsPerBar * track.leadStep;
	const scale = track.scale === undefined ? Scales.minor : track.scale;
	const leadRoot = track.leadRoot === undefined ? 0 : track.leadRoot;
	for (let step = 0; step < stepCount; ++step) {
		// 선율은 곡 전체로 이어집니다. 마디를 세지 않으면 패턴 앞부분만 되풀이됩니다.
		const melodyIndex = (barIndex * stepCount + step) % track.leadPattern.length;
		const patternValue = track.leadPattern[melodyIndex];
		if (patternValue === null) {
			continue;
		}
		// 음계 자리를 반음 수로 풉니다. 자리가 음계 길이를 넘으면 위 옥타브입니다.
		const scaleLength = scale.length;
		let scaleIndex = patternValue;
		let octaveShift = 0;
		while (scaleIndex < 0) {
			scaleIndex += scaleLength;
			octaveShift -= 12;
		}
		while (scaleIndex >= scaleLength) {
			scaleIndex -= scaleLength;
			octaveShift += 12;
		}
		const offset = scale[scaleIndex] + octaveShift + bar.lead;
		schedulePluck(LEAD_NOTE + leadRoot + offset, startTime + stepSeconds * step,
			stepSeconds * track.leadHold, track.leadVolume, track.leadWave, track.leadFilter, track.leadVibrato);
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
	const beatsPerBar = track.beatsPerBar === undefined ? BEATS_PER_BAR : track.beatsPerBar;
	const barSeconds = track.beatSeconds * beatsPerBar;
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
