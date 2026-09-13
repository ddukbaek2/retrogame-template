//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// VGA 기본 팔레트. (모드 13h 로 들어갈 때 BIOS 가 채워 넣던 바로 그 256 색)
//
//   0 ~ 15    옛 16 색. (4 비트 모드가 쓰던 것과 같은 차례)
//   16 ~ 31   회색 16 단.
//   32 ~ 247  색 216 개. 밝기 세 단 × 선명함 세 단 × 색상 스물넷.
//   248 ~ 255 검정.
//
// 값은 그때의 6 비트(0 ~ 63)입니다. 화면에 낼 때 8 비트로 늘립니다.
//
// 256 색을 화면 픽셀마다 다 뒤지면 느리므로, 여기서 미리 "어떤 색은 어느 팔레트 색"인지를
// 표(룩업)로 구워 둡니다. 셰이더는 그 표를 한 번 읽습니다.
//==============================================================================


// 0 ~ 15. 옛 16 색.
const BASIC_LEVELS = [
	[0, 0, 0], [0, 0, 42], [0, 42, 0], [0, 42, 42],
	[42, 0, 0], [42, 0, 42], [42, 21, 0], [42, 42, 42],
	[21, 21, 21], [21, 21, 63], [21, 63, 21], [21, 63, 63],
	[63, 21, 21], [63, 21, 63], [63, 63, 21], [63, 63, 63],
];

// 16 ~ 31. 회색 16 단.
const GRAY_LEVELS = [0, 5, 8, 11, 14, 17, 20, 24, 28, 32, 36, 40, 45, 50, 56, 63];

// 32 ~ 247. 밝기 세 단(밝음, 중간, 어두움) × 선명함 세 단(진함, 중간, 옅음).
// 다섯 값은 색상 한 바퀴를 도는 동안 채널 하나가 밟는 눈금입니다. 첫 값이 바닥, 끝 값이 꼭대기입니다.
const HUE_RAMPS = [
	[[0, 16, 31, 47, 63], [31, 39, 47, 55, 63], [45, 49, 54, 58, 63]],
	[[0, 7, 14, 21, 28], [14, 17, 21, 24, 28], [20, 22, 24, 26, 28]],
	[[0, 4, 8, 12, 16], [8, 10, 12, 14, 16], [11, 12, 13, 15, 16]],
];

// 색상 스물넷은 여섯 구간을 넷씩 지납니다. 파랑 → 자홍 → 빨강 → 노랑 → 초록 → 청록.
const SECTOR_COUNT = 6;
const STEP_COUNT = 4;


//==============================================================================
// 6 비트 값을 8 비트로.
//==============================================================================
/**
 * @param { number } value 0 ~ 63
 * @returns { number } 0 ~ 255
 */
function toEightBit(value) {
	const scaled = value * 255 / 63;
	const rounded = System.Math.round(scaled);
	return rounded;
}


//==============================================================================
// 팔레트 256 색 만들기.
//==============================================================================
/**
 * @returns { Uint8Array } 색마다 빨강, 초록, 파랑 세 값. (모두 768 개)
 */
export function createVgaPalette() {
	const entries = new System.Uint8Array(256 * 3);
	let offset = 0;
	for (let index = 0; index < BASIC_LEVELS.length; ++index) {
		const levels = BASIC_LEVELS[index];
		entries[offset] = toEightBit(levels[0]);
		entries[offset + 1] = toEightBit(levels[1]);
		entries[offset + 2] = toEightBit(levels[2]);
		offset += 3;
	}
	for (let index = 0; index < GRAY_LEVELS.length; ++index) {
		const level = toEightBit(GRAY_LEVELS[index]);
		entries[offset] = level;
		entries[offset + 1] = level;
		entries[offset + 2] = level;
		offset += 3;
	}
	for (let intensity = 0; intensity < HUE_RAMPS.length; ++intensity) {
		const saturations = HUE_RAMPS[intensity];
		for (let saturation = 0; saturation < saturations.length; ++saturation) {
			const ramp = saturations[saturation];
			const lowLevel = ramp[0];
			const highLevel = ramp[STEP_COUNT];
			for (let sector = 0; sector < SECTOR_COUNT; ++sector) {
				for (let step = 0; step < STEP_COUNT; ++step) {
					const risingLevel = ramp[step];
					const fallingLevel = ramp[STEP_COUNT - step];
					let red = lowLevel;
					let green = lowLevel;
					let blue = highLevel;
					if (sector === 0) {
						red = risingLevel;
					}
					else if (sector === 1) {
						red = highLevel;
						blue = fallingLevel;
					}
					else if (sector === 2) {
						red = highLevel;
						green = risingLevel;
						blue = lowLevel;
					}
					else if (sector === 3) {
						red = fallingLevel;
						green = highLevel;
						blue = lowLevel;
					}
					else if (sector === 4) {
						green = highLevel;
						blue = risingLevel;
					}
					else {
						green = fallingLevel;
					}
					entries[offset] = toEightBit(red);
					entries[offset + 1] = toEightBit(green);
					entries[offset + 2] = toEightBit(blue);
					offset += 3;
				}
			}
		}
	}
	// 248 ~ 255 는 검정입니다. 그릇이 처음부터 0 이라 그대로 둡니다.
	return entries;
}


//==============================================================================
// 색 하나에 가장 가까운 팔레트 색 찾기.
//==============================================================================
/**
 * @param { Uint8Array } palette
 * @param { number } colorCount 앞에서부터 몇 색까지 볼지. (16 또는 256)
 * @param { number } red 0 ~ 255
 * @param { number } green
 * @param { number } blue
 * @returns { number } 팔레트 자리 번호.
 */
function findNearestEntry(palette, colorCount, red, green, blue) {
	let nearestIndex = 0;
	let nearestDistance = Number.MAX_VALUE;
	for (let index = 0; index < colorCount; ++index) {
		const offset = index * 3;
		const differenceRed = red - palette[offset];
		const differenceGreen = green - palette[offset + 1];
		const differenceBlue = blue - palette[offset + 2];
		const distance = differenceRed * differenceRed + differenceGreen * differenceGreen + differenceBlue * differenceBlue;
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestIndex = index;
		}
	}
	return nearestIndex;
}


//==============================================================================
// 룩업 표 한 덩이 채우기. (색 상자 하나가 표의 한 칸입니다)
//==============================================================================
/**
 * @param { Uint8Array } palette
 * @param { number } colorCount
 * @param { number } lutSize 한 축을 몇 칸으로 나눌지.
 * @param { number } rowOffset 표에서 이 덩이가 시작하는 줄.
 * @param { number } width 표의 가로 칸 수.
 * @param { Uint8Array } data
 */
function fillLookupBlock(palette, colorCount, lutSize, rowOffset, width, data) {
	const maximumLevel = lutSize - 1;
	for (let blue = 0; blue < lutSize; ++blue) {
		for (let green = 0; green < lutSize; ++green) {
			for (let red = 0; red < lutSize; ++red) {
				const sourceRed = System.Math.round(red * 255 / maximumLevel);
				const sourceGreen = System.Math.round(green * 255 / maximumLevel);
				const sourceBlue = System.Math.round(blue * 255 / maximumLevel);
				const nearestIndex = findNearestEntry(palette, colorCount, sourceRed, sourceGreen, sourceBlue);
				const paletteOffset = nearestIndex * 3;
				const column = blue * lutSize + red;
				const row = rowOffset + green;
				const dataOffset = (row * width + column) * 4;
				data[dataOffset] = palette[paletteOffset];
				data[dataOffset + 1] = palette[paletteOffset + 1];
				data[dataOffset + 2] = palette[paletteOffset + 2];
				data[dataOffset + 3] = 255;
			}
		}
	}
}


//==============================================================================
// 룩업 표 만들기. (위쪽 절반이 16 색, 아래쪽 절반이 256 색입니다)
//==============================================================================
/**
 * @param { number } lutSize 한 축을 몇 칸으로 나눌지. (32 면 32 × 32 × 32)
 * @returns { object } { width, height, data }
 */
export function createPaletteLookup(lutSize) {
	const palette = createVgaPalette();
	const width = lutSize * lutSize;
	const height = lutSize * 2;
	const data = new System.Uint8Array(width * height * 4);
	fillLookupBlock(palette, 16, lutSize, 0, width, data);
	fillLookupBlock(palette, 256, lutSize, lutSize, width, data);
	return { width: width, height: height, data: data };
}
