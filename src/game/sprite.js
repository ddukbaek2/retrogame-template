//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { getColor } from "./palette.js";
import { ImageAsset } from "../../libs/vanilla.js/src/resource/imageasset.js";


//==============================================================================
// 도트 그림 낱개.
//
// 필드에 놓이는 적과 아이템은 선으로만 그리기에는 무엇인지 알아보기 어렵습니다. 그래서 그림
// 한 장을 씁니다. (사용자 지시, 2026-09-10)
//
// 화면의 색 수(1, 2, 4, 8 비트)는 설정마다 바뀝니다. 그림의 색을 그대로 쓰면 그 설정을 어깁니다.
// 그래서 그림은 **밝기 네 단의 마스크**로 구워져 있고(`tools/bake-sprites.py`), 여기서 그 넉 장을
// `Colors` 의 열쇠로 물들여 찍습니다. 색은 늘 `palette.js` 를 지나므로 어떤 색 수에서도 맞습니다.
//
// 가장 어두운 단은 종이색으로 찍습니다. 그래야 뒤가 비치지 않고 속의 검정이 형태를 갈라 줍니다.
//
// 그림 한 장의 짜임: 가로에 낱개가 차례로, 세로에 밝기 네 단.
//==============================================================================


// 낱개 한 칸의 크기와 밝기 단 수의 기본값. 실제 값은 차례 표에서 읽습니다.
// 0 단은 윤곽과 속의 검정이고 1 부터 3 이 어두운 데에서 밝은 데까지입니다.
const DEFAULT_CELL_SIZE = 32;
const DEFAULT_LEVEL_COUNT = 4;

let sheetAsset = null;
let isSheetLoaded = false;
let spriteIds = [];
let cellSize = DEFAULT_CELL_SIZE;
let levelCount = DEFAULT_LEVEL_COUNT;


//==============================================================================
// 그림 한 장 불러오기. (씬 시작 때 한 번)
//==============================================================================
/**
 * @param { string } sheetPath
 * @param { string } indexPath 낱개의 차례를 적어 둔 표. (굽는 도구가 만듭니다)
 * @returns { Promise<void> }
 */
export async function loadSpriteSheet(sheetPath, indexPath) {
	// 낱개의 차례는 굽는 도구가 정합니다. 여기에 손으로 적어 두면 낱개를 더할 때마다 어긋납니다.
	// (사용자 지적, 2026-09-13, "왜 촌장 이미지가 보관함 이미지고")
	spriteIds = [];
	cellSize = DEFAULT_CELL_SIZE;
	levelCount = DEFAULT_LEVEL_COUNT;
	try {
		const response = await System.fetch(indexPath);
		const indexData = await response.json();
		spriteIds = indexData.ids;
		cellSize = indexData.cellSize;
		levelCount = indexData.levelCount;
	}
	catch (error) {
		console.error("[sprite] 차례 표를 받지 못했습니다: " + indexPath);
		isSheetLoaded = false;
		return;
	}
	sheetAsset = new ImageAsset();
	try {
		await sheetAsset.load(sheetPath);
		isSheetLoaded = true;
	}
	catch (error) {
		console.error("[sprite] 그림을 받지 못했습니다: " + sheetPath);
		isSheetLoaded = false;
	}
}


//==============================================================================
// 그림이 준비되었는지.
//==============================================================================
/**
 * @returns { boolean }
 */
export function isSpriteSheetLoaded() {
	return isSheetLoaded;
}


//==============================================================================
// 낱개 번호 찾기. (없으면 -1)
//==============================================================================
/**
 * @param { string } spriteId
 * @returns { number }
 */
export function findSpriteIndex(spriteId) {
	for (let index = 0; index < spriteIds.length; ++index) {
		if (spriteIds[index] === spriteId) {
			return index;
		}
	}
	return -1;
}


//==============================================================================
// 낱개 하나 찍기. (창 사각형에 맞춰 잘라 그립니다)
//
// 밝기 네 단을 각각 다른 열쇠로 물들여 네 번 찍습니다.
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } spriteId
 * @param { number } centerX 화면 좌표.
 * @param { number } centerY
 * @param { number } size 한 변의 화면 크기.
 * @param { string[] } colorKeys 밝기 네 단에 쓸 열쇠. (0 이 가장 어두운 단)
 * @param { object } clipRect { left, top, right, bottom } 이 밖은 그리지 않습니다.
 */
export function drawSprite(graphic, spriteId, centerX, centerY, size, colorKeys, clipRect) {
	if (!isSheetLoaded) {
		return;
	}
	const spriteIndex = findSpriteIndex(spriteId);
	if (spriteIndex < 0) {
		return;
	}
	const image = sheetAsset.getImage();
	const destinationLeft = centerX - size * 0.5;
	const destinationTop = centerY - size * 0.5;
	const destinationRight = destinationLeft + size;
	const destinationBottom = destinationTop + size;
	const clippedLeft = System.Math.max(destinationLeft, clipRect.left);
	const clippedTop = System.Math.max(destinationTop, clipRect.top);
	const clippedRight = System.Math.min(destinationRight, clipRect.right);
	const clippedBottom = System.Math.min(destinationBottom, clipRect.bottom);
	if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
		return;
	}
	// 잘린 만큼 원본에서도 같은 비율로 잘라 냅니다.
	const leftRatio = (clippedLeft - destinationLeft) / size;
	const topRatio = (clippedTop - destinationTop) / size;
	const widthRatio = (clippedRight - clippedLeft) / size;
	const heightRatio = (clippedBottom - clippedTop) / size;
	// 도트가 뭉개지지 않게 보간을 끄고 찍습니다.
	const wasSmoothing = graphic.isImageSmoothingEnabled();
	graphic.setImageSmoothingEnabled(false);
	for (let levelIndex = 0; levelIndex < levelCount; ++levelIndex) {
		const tintColor = getColor(colorKeys[levelIndex]);
		graphic.setImageTintColor(tintColor);
		const sourceLeft = spriteIndex * cellSize + leftRatio * cellSize;
		const sourceTop = levelIndex * cellSize + topRatio * cellSize;
		graphic.drawImageWithSourceAndDestination(image,
			sourceLeft, sourceTop, widthRatio * cellSize, heightRatio * cellSize,
			System.Math.round(clippedLeft), System.Math.round(clippedTop),
			System.Math.round(clippedRight - clippedLeft), System.Math.round(clippedBottom - clippedTop));
	}
	graphic.setImageTintColor(null);
	graphic.setImageSmoothingEnabled(wasSmoothing);
}


//==============================================================================
// 낱개 한 칸의 픽셀 크기. (세로 한 조각씩 찍는 쪽이 원본 줄을 셀 때 씁니다)
//==============================================================================
/**
 * @returns { number }
 */
export function readSpriteCellSize() {
	return cellSize;
}


//==============================================================================
// 낱개의 세로 한 조각 찍기. (세상에 고정된 면에 그림을 붙일 때, 기둥마다 높이가 다릅니다)
//
// 원본의 가로 sourceLeftRatio 부터 sourceWidthRatio 만큼을 잘라 dest 사각형에 늘려 찍습니다.
// 세로는 clipRect 로 자르고, 잘린 만큼 원본에서도 같은 비율로 잘라 냅니다.
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } spriteId
 * @param { number } sourceLeftRatio 원본 가로의 시작. (0 ~ 1)
 * @param { number } sourceWidthRatio 원본 가로의 너비. (0 ~ 1)
 * @param { number } destinationLeft
 * @param { number } destinationTop
 * @param { number } destinationWidth
 * @param { number } destinationHeight
 * @param { string[] } colorKeys 밝기 단마다의 Colors 열쇠. (어두운 단부터)
 * @param { object } clipRect { left, top, right, bottom }
 */
export function drawSpriteSlice(graphic, spriteId, sourceLeftRatio, sourceWidthRatio, destinationLeft, destinationTop, destinationWidth, destinationHeight, colorKeys, clipRect) {
	if (!isSheetLoaded || destinationHeight <= 0 || destinationWidth <= 0) {
		return;
	}
	const spriteIndex = findSpriteIndex(spriteId);
	if (spriteIndex < 0) {
		return;
	}
	const image = sheetAsset.getImage();
	const destinationRight = destinationLeft + destinationWidth;
	const destinationBottom = destinationTop + destinationHeight;
	const clippedLeft = System.Math.max(destinationLeft, clipRect.left);
	const clippedTop = System.Math.max(destinationTop, clipRect.top);
	const clippedRight = System.Math.min(destinationRight, clipRect.right);
	const clippedBottom = System.Math.min(destinationBottom, clipRect.bottom);
	if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
		return;
	}
	const topRatio = (clippedTop - destinationTop) / destinationHeight;
	const heightRatio = (clippedBottom - clippedTop) / destinationHeight;
	const wasSmoothing = graphic.isImageSmoothingEnabled();
	graphic.setImageSmoothingEnabled(false);
	for (let levelIndex = 0; levelIndex < levelCount; ++levelIndex) {
		const tintColor = getColor(colorKeys[levelIndex]);
		graphic.setImageTintColor(tintColor);
		const sourceLeft = spriteIndex * cellSize + sourceLeftRatio * cellSize;
		const sourceTop = levelIndex * cellSize + topRatio * cellSize;
		graphic.drawImageWithSourceAndDestination(image,
			sourceLeft, sourceTop, System.Math.max(1, sourceWidthRatio * cellSize), heightRatio * cellSize,
			System.Math.round(clippedLeft), System.Math.round(clippedTop),
			System.Math.round(clippedRight - clippedLeft), System.Math.round(clippedBottom - clippedTop));
	}
	graphic.setImageTintColor(null);
	graphic.setImageSmoothingEnabled(wasSmoothing);
}


//==============================================================================
// 마스크 한 장짜리 그림. (제목 로고처럼 단색으로 찍는 것)
//
// 낱개 시트와 달리 밝기 단이 없습니다. 알파만 있는 그림 한 장을 받아 `Colors` 의 열쇠 하나로
// 통째로 물들여 찍습니다. 색 수가 1 비트로 내려가도 어긋나지 않습니다.
//==============================================================================
const maskAssets = new Map();


//==============================================================================
// 마스크 그림 받기. (이름으로 들고 있습니다)
//==============================================================================
/**
 * @param { string } name
 * @param { string } imagePath
 */
export async function loadMaskImage(name, imagePath) {
	const asset = new ImageAsset();
	try {
		await asset.load(imagePath);
		maskAssets.set(name, asset);
	}
	catch (error) {
		console.error("[sprite] 그림을 받지 못했습니다: " + imagePath);
	}
}


//==============================================================================
// 마스크 그림이 준비되었는지.
//==============================================================================
/**
 * @param { string } name
 * @returns { boolean }
 */
export function isMaskImageLoaded(name) {
	const asset = maskAssets.get(name);
	if (asset === undefined) {
		return false;
	}
	return asset.isLoaded();
}


//==============================================================================
// 마스크 그림 찍기. (가운데 맞춤, 정수 배율)
//
// 도트가 깨지지 않게 배율은 정수만 씁니다. 주어진 높이에 맞는 가장 큰 정수 배를 고릅니다.
//==============================================================================
/**
 * @param { object } graphic
 * @param { string } name
 * @param { number } centerX
 * @param { number } centerY
 * @param { number } wantedHeight 이 높이에 맞춰 정수 배를 고릅니다.
 * @param { string } colorKey
 */
export function drawMaskImage(graphic, name, centerX, centerY, wantedHeight, colorKey) {
	const asset = maskAssets.get(name);
	if (asset === undefined || !asset.isLoaded()) {
		return;
	}
	const image = asset.getImage();
	const sourceWidth = image.width;
	const sourceHeight = image.height;
	if (sourceWidth <= 0 || sourceHeight <= 0) {
		return;
	}
	let scale = System.Math.floor(wantedHeight / sourceHeight);
	if (scale < 1) {
		scale = 1;
	}
	const drawWidth = sourceWidth * scale;
	const drawHeight = sourceHeight * scale;
	const drawLeft = System.Math.round(centerX - drawWidth * 0.5);
	const drawTop = System.Math.round(centerY - drawHeight * 0.5);
	const wasSmoothing = graphic.isImageSmoothingEnabled();
	graphic.setImageSmoothingEnabled(false);
	graphic.setImageTintColor(getColor(colorKey));
	graphic.drawImageWithSourceAndDestination(image,
		0, 0, sourceWidth, sourceHeight,
		drawLeft, drawTop, drawWidth, drawHeight);
	graphic.setImageTintColor(null);
	graphic.setImageSmoothingEnabled(wasSmoothing);
}
