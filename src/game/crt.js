//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WINDOW_REFERENCE_WIDTH, WINDOW_REFERENCE_HEIGHT, MONITOR_BEZEL_X, MONITOR_BEZEL_Y } from "./constants.js";
import { readInputSource } from "./inputsource.js";
import { readInputIconBitmap, readInputIconSize } from "../ui/inputicon.js";


//==============================================================================
// 브라운관 필터. (게임 캔버스 위에 캔버스 하나를 더 얹어 셰이더로 다시 그립니다)
//
// 게임은 그대로 1280 × 800 백버퍼에 그리고, 이 캔버스가 매 프레임 그 그림을 텍스처로 받아
// 살짝 휘고(배럴), 주사선이 지나가고, 밝은 글자가 번지고(형광 글로우), 형광 마스크가 얇게 깔린 모습으로
// 보여 줍니다. 게임 코드는 손대지 않는 후처리입니다. (사용자 제안, 2026-09-08, "게임 영역 전체를
// 모니터 화면으로 두고 브라운관 효과를 주면서 그 안에서 게임이 동작하게")
//
// 설정의 "브라운관" 으로 켜고 끕니다. 끄면 이 캔버스를 감추고 게임 캔버스가 그대로 보입니다.
// 게임 캔버스의 그림을 읽으려면 그 컨텍스트가 preserveDrawingBuffer 여야 합니다. (엔진 graphic.js —
// docs/엔진-보완-내역.md)
//==============================================================================


const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
	vUv = aPosition * 0.5 + 0.5;
	gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform vec2 uOutputSize;
uniform vec2 uSourceSize;
uniform float uCurvature;
uniform float uScanline;
uniform float uMask;
uniform float uGlow;
uniform float uCornerRadius;
uniform vec4 uScreenRect;
uniform sampler2D uBezel;
uniform vec4 uMonitorRect;
// 모니터 그림을 보일지. (설정 "모니터 프레임")
uniform int uShowFrame;
// 볼록 렌즈, 주사선, 형광을 보일지. (설정 "볼록 효과")
uniform int uShowCurve;
// 입력 장치 아이콘. (모니터 프레임 자리에 얹습니다, 게임 화면 밖이라 브라운관 효과를 타지 않습니다)
// 화면이 드러난 정도. (0 이면 아무것도 안 보이고 1 이면 다 보입니다)
uniform float uReveal;
uniform sampler2D uIcon;
uniform vec4 uIconRect;
uniform vec3 uIconColor;
// 게임 화면 바깥의 바탕색. 게임의 종이가 검정이라 검게 두면 경계가 보이지 않습니다.
const vec3 OUTSIDE_COLOR = vec3(0.149, 0.149, 0.169);

// 원본에서 보여 줄 부분. (창을 꽉 채우면 가장자리를 베젤 밑에 넣고 1 : 1 로 봅니다, 줄여 그리지 않습니다)
uniform vec4 uSourceCrop;

// 화면 구멍 안이면 게임, 밖이면 검정. 그 위에 모니터 그림(베젤)을 알파로 얹습니다.
vec3 readScreenColor(vec2 pixel) {
	vec2 screenUv = (pixel - uScreenRect.xy) / uScreenRect.zw;
	// 게임 화면(1280 × 800) 바깥은 짙은 회색, 안쪽은 검정입니다. 모니터 프레임을 꺼도 게임 화면은 그대로입니다.
	vec2 bezelUv = (pixel - uMonitorRect.xy) / uMonitorRect.zw;
	if (bezelUv.x < 0.0 || bezelUv.x > 1.0 || bezelUv.y < 0.0 || bezelUv.y > 1.0) {
		return OUTSIDE_COLOR;
	}
	vec4 bezel = vec4(0.0, 0.0, 0.0, 0.0);
	if (uShowFrame == 1) {
		bezel = texture(uBezel, bezelUv);
	}
	if (screenUv.x < 0.0 || screenUv.x > 1.0 || screenUv.y < 0.0 || screenUv.y > 1.0) {
		if (uShowFrame == 1) {
			return bezel.rgb * bezel.a;
		}
		return vec3(0.0, 0.0, 0.0);
	}
	if (uShowCurve == 0) {
		// 볼록 효과를 끈 자리. 휘지도 않고 주사선도 없이 보여 줍니다.
		// 유리에 비치는 모니터 그림은 그대로 얹습니다. 구멍 둘레의 흐린 알파가 둥근 모서리를 만들기 때문입니다.
		vec2 flatUv = uSourceCrop.xy + screenUv * uSourceCrop.zw;
		vec3 flatColor = texture(uTexture, flatUv).rgb;
		return mix(flatColor, bezel.rgb, bezel.a);
	}
	// 볼록 렌즈. 가운데를 0 으로 둔 자리를 배럴로 휘어 유리가 부풀어 보이게 합니다.
	//
	// 휘어짐을 -1 에서 1 사이 자로 재면, 가로 반지름은 480 픽셀이고 세로 반지름은 360 픽셀이라
	// 같은 눈금으로 휘어도 세로는 픽셀로 3/4 만 부풉니다. 그래서 세로 눈금을 가로세로 비만큼 키워
	// 픽셀로 잰 부풂이 두 쪽에서 같아지게 합니다. 두 축 모두 가장자리 한가운데는 그대로 구멍에 닿습니다.
	vec2 centered = screenUv * 2.0 - 1.0;
	float radiusSquared = dot(centered, centered);
	float screenAspect = uScreenRect.z / uScreenRect.w;
	float sideRatio = uCurvature / (1.0 + uCurvature);
	float verticalRatio = clamp(sideRatio * screenAspect, 0.0, 0.9);
	float verticalCurvature = verticalRatio / (1.0 - verticalRatio);
	// 화면 구멍을 남김없이 채우도록 조금 넓게 떠서 봅니다. (오버스캔)
	// 모서리까지 그림이 닿아야 진짜 브라운관처럼 보입니다. 대신 가장자리 한가운데는 그림이 조금 가려지므로
	// 화면 코드는 SAFE_MARGIN 안쪽에 글자를 둡니다.
	float cornerScaleX = (1.0 + uCurvature * 2.0) / (1.0 + uCurvature);
	float cornerScaleY = (1.0 + verticalCurvature * 2.0) / (1.0 + verticalCurvature);
	vec2 warped = vec2(
		centered.x * (1.0 + uCurvature * radiusSquared) / (1.0 + uCurvature) / cornerScaleX,
		centered.y * (1.0 + verticalCurvature * radiusSquared) / (1.0 + verticalCurvature) / cornerScaleY);
	vec2 edge = abs(warped);
	if (max(edge.x, edge.y) > 1.0) {
		// 유리 안쪽. 휘어짐에 잘린 모서리는 베젤 안쪽 테와 이어지게 검정입니다.
		return bezel.rgb * bezel.a;
	}
	vec2 uv = uSourceCrop.xy + (warped * 0.5 + 0.5) * uSourceCrop.zw;
	vec3 color = texture(uTexture, uv).rgb;
	vec2 texel = 1.0 / uSourceSize;
	vec3 glow = vec3(0.0);
	glow += texture(uTexture, uv + vec2(-texel.x, 0.0)).rgb;
	glow += texture(uTexture, uv + vec2(texel.x, 0.0)).rgb;
	glow += texture(uTexture, uv + vec2(0.0, -texel.y)).rgb;
	glow += texture(uTexture, uv + vec2(0.0, texel.y)).rgb;
	glow = glow / 4.0;
	color = max(color, glow * uGlow);

	// 주사선: 원본 한 줄마다 한 번씩 어두워집니다. 화면 픽셀 줄을 기준으로 재어 휘어짐과 겹치지 않게 합니다.
	float rowsPerSource = uScreenRect.w / (uSourceSize.y * uSourceCrop.w);
	float period = max(2.0, rowsPerSource);
	float line = 0.5 + 0.5 * cos((pixel.y - uScreenRect.y + 0.5) / period * 6.28318530718);
	color *= 1.0 - uScanline * line;

	// 형광 마스크: 화면 픽셀 세 칸마다 빨강, 초록, 파랑이 조금씩 살아납니다.
	float column = mod(pixel.x, 3.0);
	vec3 mask = vec3(1.0 - uMask);
	if (column < 0.5) {
		mask.r = 1.0 + uMask;
	}
	else if (column < 1.5) {
		mask.g = 1.0 + uMask;
	}
	else {
		mask.b = 1.0 + uMask;
	}
	color *= mask;

	// 유리에 비치는 모니터 그림. (구멍 둘레의 흐린 알파가 유리 테를 만듭니다)
	return mix(color, bezel.rgb, bezel.a);
}

// 옛날식 드러나기. 알파로 흐려지는 것이 아니라 4 × 4 점 무늬의 문턱을 넘은 점만 켜집니다.
// 도스 시절의 디졸브입니다. (사용자 요청, 2026-09-13, "진짜 요즘식 페이드인말고 뭔가 옛날식")
float readDitherThreshold(vec2 cell) {
	int x = int(mod(cell.x, 4.0));
	int y = int(mod(cell.y, 4.0));
	int index = x + y * 4;
	float table[16] = float[16](
		0.0, 8.0, 2.0, 10.0,
		12.0, 4.0, 14.0, 6.0,
		3.0, 11.0, 1.0, 9.0,
		15.0, 7.0, 13.0, 5.0);
	return (table[index] + 0.5) / 16.0;
}

void main() {
	vec2 pixel = vUv * uOutputSize;
	vec3 result = readScreenColor(pixel);
	// 지금 쓰는 입력 장치 아이콘. 게임 화면 밖 프레임 자리라 휘지도 않고 색 수도 타지 않습니다.
	vec2 iconUv = (pixel - uIconRect.xy) / uIconRect.zw;
	if (iconUv.x >= 0.0 && iconUv.x <= 1.0 && iconUv.y >= 0.0 && iconUv.y <= 1.0) {
		float dotAlpha = texture(uIcon, iconUv).a;
		result = mix(result, uIconColor, dotAlpha);
	}
	if (uReveal < 1.0) {
		// 화면 구멍 안에서만 차오릅니다. 모니터까지 같이 나타나면 어색합니다.
		vec2 revealUv = (pixel - uScreenRect.xy) / uScreenRect.zw;
		if (revealUv.x >= 0.0 && revealUv.x <= 1.0 && revealUv.y >= 0.0 && revealUv.y <= 1.0) {
			// 점 무늬가 굵어야 옛 화면처럼 보입니다. 화면 점 세 칸을 한 칸으로 셉니다.
			float threshold = readDitherThreshold(floor(pixel / 3.0));
			if (threshold >= uReveal) {
				result = vec3(0.0, 0.0, 0.0);
			}
		}
	}
	outColor = vec4(result, 1.0);
}
`;

// 효과 세기. (은은하게, 도트가 살아 있어야 합니다)
const CURVATURE = 0.084;
const SCANLINE_STRENGTH = 0.30;
const MASK_STRENGTH = 0.035;
const GLOW_STRENGTH = 0.45;
// 형광 색마다 번지는 정도를 맞추는 값.
//
// 흰색은 세 채널이 다 밝아 둘레로 번진 회색이 글자에 붙어 보입니다. 녹색이나 적색은 한 채널만
// 번져 같은 세기라도 덜 도드라집니다. 그래서 흰색 계열만 번짐을 줄여 어느 색에서나 글자가
// 같은 굵기로 보이게 합니다. (사용자 지적, 2026-09-13, "흰색일 때만 폰트가 두께가 변한다")
const GLOW_SCALE_BY_MODE = System.Object.freeze({
	white: 0.62,
	white2: 0.62,
});
let glowScale = 1;
const CORNER_RADIUS = 0.06;
// 모니터 그림. (제미나이로 만든 옛 브라운관, 구멍이 알파 0 이고 그 자리에 게임이 놓입니다)
const BEZEL_IMAGE_PATH = "./assets/monitor/bezel.png";
// 모니터 그림의 크기. 베젤 두께는 constants.js 가 한 벌로 가지고 있습니다. (창 안에 비율 그대로 맞춰 넣습니다)
const MONITOR_WIDTH = WINDOW_REFERENCE_WIDTH;
const MONITOR_HEIGHT = WINDOW_REFERENCE_HEIGHT;
// 백킹 스토어 상한. (너무 큰 모니터에서 메모리를 아낍니다)
const MAXIMUM_BACKING_WIDTH = 3840;
// 입력 장치 아이콘의 자리. (1280 × 800 자로 잰 오른쪽 아래 여백, 모니터 프레임 자리입니다)
const ICON_DOT_SIZE = 2;
const ICON_MARGIN_X = 26;
const ICON_MARGIN_Y = 16;

let sourceCanvas = null;
let overlayCanvas = null;
let webGL = null;
let program = null;
let texture = null;
let uniformLocations = null;
let isEnabled = false;
let isLooping = false;
let sourceWidth = 1280;
let sourceHeight = 800;
let screenRect = { x: 0, y: 0, width: 1, height: 1 };
let monitorRect = { x: 0, y: 0, width: 1, height: 1 };
// 창(CSS) 좌표의 화면 구멍. (마우스, 손가락 자리를 되짚을 때 씁니다)
let screenRectCss = { x: 0, y: 0, width: 1, height: 1 };
// 화면 모드가 정한 모니터 자리. (CSS px, devicesize.js 가 넣습니다)
let monitorPlacement = null;
let sourceCrop = { x: 0, y: 0, width: 1, height: 1 };
let isTextureAllocated = false;
let bezelTexture = null;
let isBezelLoaded = false;
// 모니터 그림을 보일지, 볼록 효과를 보일지. (설정 둘, 색 수는 표시 장치가 따로 맡습니다)
let isFrameShown = true;
let curveScale = 1;
let iconTexture = null;
let iconSource = "";
let iconRect = { x: 0, y: 0, width: 1, height: 1 };


//==============================================================================
// 셰이더 하나 컴파일.
//==============================================================================
/**
 * @param { WebGL2RenderingContext } context
 * @param { number } type
 * @param { string } source
 * @returns { WebGLShader | null }
 */
function compileShader(context, type, source) {
	const shader = context.createShader(type);
	context.shaderSource(shader, source);
	context.compileShader(shader);
	const isCompiled = context.getShaderParameter(shader, context.COMPILE_STATUS);
	if (!isCompiled) {
		console.error("[crt] 셰이더 컴파일 실패: " + context.getShaderInfoLog(shader));
		context.deleteShader(shader);
		return null;
	}
	return shader;
}


//==============================================================================
// 캔버스, 컨텍스트, 프로그램 만들기. (한 번만)
//==============================================================================
/**
 * @returns { boolean } 준비됐는지.
 */
function ensureOverlay() {
	if (overlayCanvas !== null) {
		return webGL !== null;
	}
	const document = System.document;
	if (document === null || document === undefined || sourceCanvas === null) {
		return false;
	}
	overlayCanvas = document.createElement("canvas");
	overlayCanvas.id = "crtCanvas";
	overlayCanvas.style.position = "absolute";
	overlayCanvas.style.pointerEvents = "none";
	overlayCanvas.style.display = "none";
	sourceCanvas.parentNode.insertBefore(overlayCanvas, sourceCanvas.nextSibling);
	webGL = overlayCanvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
	if (webGL === null) {
		console.error("[crt] WebGL2 를 열 수 없어 브라운관 필터를 끕니다.");
		return false;
	}
	const vertexShader = compileShader(webGL, webGL.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
	const fragmentShader = compileShader(webGL, webGL.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
	if (vertexShader === null || fragmentShader === null) {
		webGL = null;
		return false;
	}
	program = webGL.createProgram();
	webGL.attachShader(program, vertexShader);
	webGL.attachShader(program, fragmentShader);
	webGL.linkProgram(program);
	const isLinked = webGL.getProgramParameter(program, webGL.LINK_STATUS);
	if (!isLinked) {
		console.error("[crt] 프로그램 링크 실패: " + webGL.getProgramInfoLog(program));
		webGL = null;
		return false;
	}
	webGL.useProgram(program);
	const positionBuffer = webGL.createBuffer();
	webGL.bindBuffer(webGL.ARRAY_BUFFER, positionBuffer);
	webGL.bufferData(webGL.ARRAY_BUFFER, new System.Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), webGL.STATIC_DRAW);
	const positionLocation = webGL.getAttribLocation(program, "aPosition");
	webGL.enableVertexAttribArray(positionLocation);
	webGL.vertexAttribPointer(positionLocation, 2, webGL.FLOAT, false, 0, 0);
	texture = webGL.createTexture();
	webGL.bindTexture(webGL.TEXTURE_2D, texture);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_S, webGL.CLAMP_TO_EDGE);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_T, webGL.CLAMP_TO_EDGE);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MIN_FILTER, webGL.NEAREST);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MAG_FILTER, webGL.NEAREST);
	uniformLocations = {
		texture: webGL.getUniformLocation(program, "uTexture"),
		outputSize: webGL.getUniformLocation(program, "uOutputSize"),
		sourceSize: webGL.getUniformLocation(program, "uSourceSize"),
		curvature: webGL.getUniformLocation(program, "uCurvature"),
		scanline: webGL.getUniformLocation(program, "uScanline"),
		mask: webGL.getUniformLocation(program, "uMask"),
		glow: webGL.getUniformLocation(program, "uGlow"),
		cornerRadius: webGL.getUniformLocation(program, "uCornerRadius"),
		screenRect: webGL.getUniformLocation(program, "uScreenRect"),
		bezel: webGL.getUniformLocation(program, "uBezel"),
		showFrame: webGL.getUniformLocation(program, "uShowFrame"),
		showCurve: webGL.getUniformLocation(program, "uShowCurve"),
		reveal: webGL.getUniformLocation(program, "uReveal"),
		icon: webGL.getUniformLocation(program, "uIcon"),
		iconRect: webGL.getUniformLocation(program, "uIconRect"),
		iconColor: webGL.getUniformLocation(program, "uIconColor"),
		sourceCrop: webGL.getUniformLocation(program, "uSourceCrop"),
		monitorRect: webGL.getUniformLocation(program, "uMonitorRect"),
	};
	webGL.uniform1i(uniformLocations.texture, 0);
	webGL.uniform1f(uniformLocations.curvature, CURVATURE);
	webGL.uniform1f(uniformLocations.scanline, SCANLINE_STRENGTH);
	webGL.uniform1f(uniformLocations.mask, MASK_STRENGTH);
	webGL.uniform1f(uniformLocations.glow, GLOW_STRENGTH * glowScale);
	webGL.uniform1f(uniformLocations.cornerRadius, CORNER_RADIUS);
	webGL.uniform1i(uniformLocations.bezel, 1);
	// 모니터 그림을 1 번 자리에 올립니다. (다 받기 전에는 비어 있어 게임만 보입니다)
	bezelTexture = webGL.createTexture();
	webGL.activeTexture(webGL.TEXTURE1);
	webGL.bindTexture(webGL.TEXTURE_2D, bezelTexture);
	webGL.texImage2D(webGL.TEXTURE_2D, 0, webGL.RGBA, 1, 1, 0, webGL.RGBA, webGL.UNSIGNED_BYTE, new System.Uint8Array([0, 0, 0, 0]));
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_S, webGL.CLAMP_TO_EDGE);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_T, webGL.CLAMP_TO_EDGE);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MIN_FILTER, webGL.LINEAR);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MAG_FILTER, webGL.LINEAR);
	const bezelImage = new System.Image();
	bezelImage.onload = () => {
		if (webGL === null) {
			return;
		}
		webGL.activeTexture(webGL.TEXTURE1);
		webGL.bindTexture(webGL.TEXTURE_2D, bezelTexture);
		webGL.pixelStorei(webGL.UNPACK_FLIP_Y_WEBGL, true);
		webGL.texImage2D(webGL.TEXTURE_2D, 0, webGL.RGBA, webGL.RGBA, webGL.UNSIGNED_BYTE, bezelImage);
		webGL.pixelStorei(webGL.UNPACK_FLIP_Y_WEBGL, false);
		isBezelLoaded = true;
	};
	bezelImage.onerror = () => {
		console.error("[crt] 모니터 그림을 받지 못했습니다: " + BEZEL_IMAGE_PATH);
	};
	bezelImage.src = BEZEL_IMAGE_PATH;
	// 입력 장치 아이콘을 2 번 자리에 올립니다. (장치가 바뀌면 다시 굽습니다)
	webGL.uniform1i(uniformLocations.icon, 2);
	iconTexture = webGL.createTexture();
	webGL.activeTexture(webGL.TEXTURE2);
	webGL.bindTexture(webGL.TEXTURE_2D, iconTexture);
	webGL.texImage2D(webGL.TEXTURE_2D, 0, webGL.RGBA, 1, 1, 0, webGL.RGBA, webGL.UNSIGNED_BYTE, new System.Uint8Array([0, 0, 0, 0]));
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_S, webGL.CLAMP_TO_EDGE);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_T, webGL.CLAMP_TO_EDGE);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MIN_FILTER, webGL.NEAREST);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MAG_FILTER, webGL.NEAREST);
	webGL.activeTexture(webGL.TEXTURE0);
	return true;
}


//==============================================================================
// 입력 장치 아이콘 굽기. (도트 그림 한 벌 → 알파만 있는 작은 텍스처)
//
// 게임 화면 밖 모니터 프레임 자리에 놓이므로 게임 캔버스에는 그리지 않습니다.
// (사용자 제안, 2026-09-10, "어차피 게임 화면과 별개의 기능이기도 하고 브라운관 적용도 필요 없어서")
//==============================================================================
/**
 * @param { string } source InputSource 의 값.
 */
function bakeIconTexture(source) {
	const bitmap = readInputIconBitmap(source);
	if (bitmap === undefined || webGL === null || iconTexture === null) {
		return;
	}
	const iconSize = readInputIconSize();
	const pixels = new System.Uint8Array(iconSize.columns * iconSize.rows * 4);
	for (let rowIndex = 0; rowIndex < iconSize.rows; ++rowIndex) {
		const row = bitmap[rowIndex];
		for (let columnIndex = 0; columnIndex < iconSize.columns; ++columnIndex) {
			const isOn = row[columnIndex] === "#";
			const offset = (rowIndex * iconSize.columns + columnIndex) * 4;
			pixels[offset] = 255;
			pixels[offset + 1] = 255;
			pixels[offset + 2] = 255;
			pixels[offset + 3] = isOn ? 255 : 0;
		}
	}
	webGL.activeTexture(webGL.TEXTURE2);
	webGL.bindTexture(webGL.TEXTURE_2D, iconTexture);
	webGL.pixelStorei(webGL.UNPACK_FLIP_Y_WEBGL, false);
	webGL.texImage2D(webGL.TEXTURE_2D, 0, webGL.RGBA, iconSize.columns, iconSize.rows, 0, webGL.RGBA, webGL.UNSIGNED_BYTE, pixels);
	webGL.activeTexture(webGL.TEXTURE0);
	iconSource = source;
}


//==============================================================================
// 한 프레임 그리기. (게임 캔버스 → 텍스처 → 셰이더)
//==============================================================================
function drawFrame() {
	if (!isEnabled || webGL === null || sourceCanvas === null) {
		isLooping = false;
		return;
	}
	const isContextLost = webGL.isContextLost();
	if (!isContextLost) {
		webGL.activeTexture(webGL.TEXTURE0);
		webGL.bindTexture(webGL.TEXTURE_2D, texture);
		webGL.pixelStorei(webGL.UNPACK_FLIP_Y_WEBGL, true);
		if (isTextureAllocated) {
			webGL.texSubImage2D(webGL.TEXTURE_2D, 0, 0, 0, webGL.RGBA, webGL.UNSIGNED_BYTE, sourceCanvas);
		}
		else {
			webGL.texImage2D(webGL.TEXTURE_2D, 0, webGL.RGBA, webGL.RGBA, webGL.UNSIGNED_BYTE, sourceCanvas);
			isTextureAllocated = true;
		}
		webGL.viewport(0, 0, overlayCanvas.width, overlayCanvas.height);
		webGL.uniform2f(uniformLocations.outputSize, overlayCanvas.width, overlayCanvas.height);
		webGL.uniform2f(uniformLocations.sourceSize, sourceWidth, sourceHeight);
		const flippedY = overlayCanvas.height - screenRect.y - screenRect.height;
		webGL.uniform4f(uniformLocations.screenRect, screenRect.x, flippedY, screenRect.width, screenRect.height);
		const currentSource = readInputSource();
		if (currentSource !== iconSource) {
			bakeIconTexture(currentSource);
		}
		const iconFlippedY = overlayCanvas.height - iconRect.y - iconRect.height;
		webGL.uniform4f(uniformLocations.iconRect, iconRect.x, iconFlippedY, iconRect.width, iconRect.height);
		// 베이지 플라스틱 위에서는 짙은 먹, 검은 자리에서는 옅은 잿빛입니다.
		if (isFrameShown) {
			webGL.uniform3f(uniformLocations.iconColor, 0.24, 0.22, 0.18);
		}
		else {
			webGL.uniform3f(uniformLocations.iconColor, 0.42, 0.42, 0.44);
		}
		webGL.uniform1f(uniformLocations.reveal, readRevealRatio());
		webGL.uniform1i(uniformLocations.showFrame, isFrameShown ? 1 : 0);
		webGL.uniform1i(uniformLocations.showCurve, curveScale > 0 ? 1 : 0);
		webGL.uniform1f(uniformLocations.curvature, CURVATURE * curveScale);
		webGL.uniform4f(uniformLocations.sourceCrop, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height);
		const monitorFlippedY = overlayCanvas.height - monitorRect.y - monitorRect.height;
		webGL.uniform4f(uniformLocations.monitorRect, monitorRect.x, monitorFlippedY, monitorRect.width, monitorRect.height);
		webGL.drawArrays(webGL.TRIANGLE_STRIP, 0, 4);
	}
	System.window.requestAnimationFrame(drawFrame);
}


//==============================================================================
// 브라운관 필터를 게임 캔버스에 붙임. (씬 시작 때 한 번)
//==============================================================================
/**
 * @param { HTMLCanvasElement } gameCanvas
 * @param { number } backbufferWidth 게임 백버퍼 가로. (1280)
 * @param { number } backbufferHeight 게임 백버퍼 세로. (800)
 */
export function attachCrt(gameCanvas, backbufferWidth, backbufferHeight) {
	sourceCanvas = gameCanvas;
	sourceWidth = backbufferWidth;
	sourceHeight = backbufferHeight;
}


//==============================================================================
// 덮개 캔버스의 자리, 크기를 게임 캔버스에 맞춤. (화면 모드가 바뀔 때마다)
//==============================================================================
export function syncCrtCanvas() {
	if (!isEnabled || sourceCanvas === null) {
		return;
	}
	const isReady = ensureOverlay();
	if (!isReady) {
		return;
	}
	const windowWidth = System.window.innerWidth;
	const windowHeight = System.window.innerHeight;
	// 덮개는 창 전체입니다. 그 안에 모니터 그림(1280 × 800 비율)을 비율 그대로 맞춰 넣고, 남는 자리는 검정입니다.
	overlayCanvas.style.left = "0px";
	overlayCanvas.style.top = "0px";
	overlayCanvas.style.width = windowWidth + "px";
	overlayCanvas.style.height = windowHeight + "px";
	const pixelRatio = System.window.devicePixelRatio || 1;
	const backingWidth = System.Math.min(MAXIMUM_BACKING_WIDTH, System.Math.round(windowWidth * pixelRatio));
	const backingScale = backingWidth / System.Math.max(1, windowWidth);
	const backingHeight = System.Math.round(windowHeight * backingScale);
	if (overlayCanvas.width !== backingWidth || overlayCanvas.height !== backingHeight) {
		overlayCanvas.width = backingWidth;
		overlayCanvas.height = backingHeight;
	}
	// 모니터 자리는 화면 모드가 정합니다. (아직 안 정해졌으면 창에 맞춥니다)
	let monitorWidth = monitorPlacement === null ? 0 : monitorPlacement.width;
	let monitorHeight = monitorPlacement === null ? 0 : monitorPlacement.height;
	let monitorLeft = monitorPlacement === null ? 0 : monitorPlacement.left;
	let monitorTop = monitorPlacement === null ? 0 : monitorPlacement.top;
	if (monitorWidth <= 0 || monitorHeight <= 0) {
		const windowFitScale = System.Math.min(windowWidth / MONITOR_WIDTH, windowHeight / MONITOR_HEIGHT);
		monitorWidth = MONITOR_WIDTH * windowFitScale;
		monitorHeight = MONITOR_HEIGHT * windowFitScale;
		monitorLeft = (windowWidth - monitorWidth) * 0.5;
		monitorTop = (windowHeight - monitorHeight) * 0.5;
	}
	const fitScale = monitorWidth / MONITOR_WIDTH;
	monitorRect = {
		x: monitorLeft * backingScale,
		y: monitorTop * backingScale,
		width: monitorWidth * backingScale,
		height: monitorHeight * backingScale,
	};
	let screenWidth = sourceWidth * fitScale;
	let screenHeight = sourceHeight * fitScale;
	let screenLeft = monitorLeft + MONITOR_BEZEL_X * fitScale;
	let screenTop = monitorTop + MONITOR_BEZEL_Y * fitScale;
	if (!isFrameShown) {
		// 모니터 프레임을 끄면 테두리가 없어진 만큼 화면이 커집니다. 비율은 그대로라 좌우에 검은 띠가 남습니다.
		const widthScale = monitorWidth / sourceWidth;
		const heightScale = monitorHeight / sourceHeight;
		const screenScale = System.Math.min(widthScale, heightScale);
		screenWidth = sourceWidth * screenScale;
		screenHeight = sourceHeight * screenScale;
		screenLeft = monitorLeft + (monitorWidth - screenWidth) * 0.5;
		screenTop = monitorTop + (monitorHeight - screenHeight) * 0.5;
	}
	screenRectCss = {
		x: screenLeft,
		y: screenTop,
		width: screenWidth,
		height: screenHeight,
	};
	screenRect = {
		x: screenRectCss.x * backingScale,
		y: screenRectCss.y * backingScale,
		width: screenRectCss.width * backingScale,
		height: screenRectCss.height * backingScale,
	};
	// 입력 장치 아이콘은 모니터 프레임의 오른쪽 아래 자리입니다. (프레임을 꺼도 같은 자리)
	const iconSize = readInputIconSize();
	const iconWidth = iconSize.columns * ICON_DOT_SIZE * fitScale;
	const iconHeight = iconSize.rows * ICON_DOT_SIZE * fitScale;
	const iconLeft = monitorLeft + monitorWidth - ICON_MARGIN_X * fitScale - iconWidth;
	const iconTop = monitorTop + monitorHeight - ICON_MARGIN_Y * fitScale - iconHeight;
	iconRect = {
		x: iconLeft * backingScale,
		y: iconTop * backingScale,
		width: iconWidth * backingScale,
		height: iconHeight * backingScale,
	};
	sourceCrop = { x: 0, y: 0, width: 1, height: 1 };
	webGL.activeTexture(webGL.TEXTURE0);
	webGL.bindTexture(webGL.TEXTURE_2D, texture);
	const textureScale = screenWidth / sourceWidth;
	const isIntegerScale = System.Math.abs(textureScale - System.Math.round(textureScale)) < 0.001;
	const filter = isIntegerScale ? webGL.NEAREST : webGL.LINEAR;
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MIN_FILTER, filter);
	webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MAG_FILTER, filter);
	overlayCanvas.style.display = "block";
}


//==============================================================================
// 모니터 프레임, 볼록 효과 켬, 끔. (설정 둘)
//
// 둘은 따로 놉니다. 프레임만 켜면 테두리 안에 또렷한 화면이 놓이고, 볼록 효과만 켜면
// 테두리 없이 화면이 휩니다. 색 수는 이것과 상관없이 표시 장치가 정합니다.
//==============================================================================
// 옛날식 드러나기. (화면이 점 무늬로 차오릅니다)
//
// 요즘처럼 투명도로 흐려지는 것이 아니라, 도스 시절처럼 **점 무늬의 문턱을 넘은 점부터 켜집니다.**
// 색 수가 1 비트여도 그대로 보이고, 알파 트윈을 쓰지 않는 이 앱의 방침에도 맞습니다.
// (사용자 요청, 2026-09-13)
//==============================================================================


// 다 드러나기까지 걸리는 시간. (초)
const REVEAL_SECONDS = 0.9;
// 몇 단으로 나누어 차오르는지. 단이 적어야 옛 화면처럼 툭툭 끊겨 보입니다.
const REVEAL_STEPS = 12;

let revealTimer = 0;
let revealSeconds = REVEAL_SECONDS;


//==============================================================================
// 드러나기 시작. (게임에 들어설 때 부릅니다)
//==============================================================================
/**
 * @param { number } [seconds] 다 드러나기까지의 시간. (없으면 기본값)
 */
export function startScreenReveal(seconds) {
	revealTimer = seconds === undefined ? REVEAL_SECONDS : seconds;
	revealSeconds = revealTimer;
}


//==============================================================================
// 드러나기 시간 흘리기. (앱이 프레임마다 부릅니다)
//==============================================================================
/**
 * @param { number } timeDelta
 */
export function advanceScreenReveal(timeDelta) {
	if (revealTimer <= 0) {
		return;
	}
	revealTimer = System.Math.max(0, revealTimer - timeDelta);
}


//==============================================================================
// 지금 얼마나 드러났는지. (0 ~ 1, 단으로 끊어 돌려줍니다)
//==============================================================================
/**
 * @returns { number }
 */
function readRevealRatio() {
	if (revealTimer <= 0) {
		return 1;
	}
	const ratio = 1 - revealTimer / revealSeconds;
	const stepped = System.Math.floor(ratio * REVEAL_STEPS) / REVEAL_STEPS;
	return System.Math.min(1, stepped);
}


//==============================================================================
/**
 * @param { boolean } isFrameValue 모니터 그림을 보일지.
 * @param { number } curveScaleValue 볼록 세기. (0 이면 쓰지 않습니다)
 */
export function applyCrtOptions(isFrameValue, curveScaleValue) {
	isFrameShown = isFrameValue;
	curveScale = System.Math.max(0, System.Math.min(1, curveScaleValue));
	// 브라운관을 꺼도 덮개는 계속 돕니다. 모니터 색(색 줄이기)은 브라운관과 별개인 설정이기 때문입니다.
	isEnabled = true;
	syncCrtCanvas();
	if (webGL === null) {
		isEnabled = false;
		if (overlayCanvas !== null) {
			overlayCanvas.style.display = "none";
		}
		if (sourceCanvas !== null) {
			sourceCanvas.style.visibility = "visible";
		}
		return;
	}
	// 게임 캔버스는 계속 그리되 화면에는 안 보이게 합니다. (덮개가 대신 보여 주므로 합성을 한 번 아낍니다)
	sourceCanvas.style.visibility = "hidden";

	if (!isLooping) {
		isLooping = true;
		System.window.requestAnimationFrame(drawFrame);
	}
}


//==============================================================================
// 창 좌표(clientX, clientY) → 게임 좌표. (마우스, 손가락이 가리킨 곳)
//
// 볼록 렌즈로 휘어 보여 주므로 셰이더와 같은 식으로 휘어 어느 게임 픽셀인지 잽니다.
// 화면 구멍 밖(베젤, 유리 테)이면 null 입니다.
//==============================================================================
/**
 * @param { number } clientX
 * @param { number } clientY
 * @returns { object | null } { x, y }
 */
export function mapWindowPointToGame(clientX, clientY) {
	if (sourceCanvas === null) {
		return null;
	}
	let left = screenRectCss.x;
	let top = screenRectCss.y;
	let width = screenRectCss.width;
	let height = screenRectCss.height;
	if (!isEnabled) {
		left = System.parseInt(sourceCanvas.style.left, 10) || 0;
		top = System.parseInt(sourceCanvas.style.top, 10) || 0;
		width = System.parseInt(sourceCanvas.style.width, 10) || sourceCanvas.clientWidth;
		height = System.parseInt(sourceCanvas.style.height, 10) || sourceCanvas.clientHeight;
	}
	if (width <= 0 || height <= 0) {
		return null;
	}
	const ratioX = (clientX - left) / width;
	const ratioY = (clientY - top) / height;
	if (ratioX < 0 || ratioX > 1 || ratioY < 0 || ratioY > 1) {
		return null;
	}
	if (!isEnabled || curveScale <= 0) {
		return { x: ratioX * sourceWidth, y: ratioY * sourceHeight };
	}
	const centeredX = ratioX * 2 - 1;
	const centeredY = ratioY * 2 - 1;
	const radiusSquared = centeredX * centeredX + centeredY * centeredY;
	const screenAspect = screenRectCss.width / screenRectCss.height;
	const activeCurvature = CURVATURE * curveScale;
	const sideRatio = activeCurvature / (1 + activeCurvature);
	const verticalRatio = System.Math.min(0.9, sideRatio * screenAspect);
	const verticalCurvature = verticalRatio / (1 - verticalRatio);
	const cornerScaleX = (1 + activeCurvature * 2) / (1 + activeCurvature);
	const cornerScaleY = (1 + verticalCurvature * 2) / (1 + verticalCurvature);
	const warpedX = centeredX * (1 + activeCurvature * radiusSquared) / (1 + activeCurvature) / cornerScaleX;
	const warpedY = centeredY * (1 + verticalCurvature * radiusSquared) / (1 + verticalCurvature) / cornerScaleY;
	if (System.Math.abs(warpedX) > 1 || System.Math.abs(warpedY) > 1) {
		return null;
	}
	return { x: (warpedX * 0.5 + 0.5) * sourceWidth, y: (warpedY * 0.5 + 0.5) * sourceHeight };
}


//==============================================================================
// 모니터 자리 지정. (화면 모드, src/game/devicesize.js 가 창 맞춤, 정수 배율 따위로 정합니다)
//==============================================================================
/**
 * @param { number } left CSS px.
 * @param { number } top
 * @param { number } width
 * @param { number } height
 */
export function setCrtMonitorPlacement(left, top, width, height) {
	monitorPlacement = { left: left, top: top, width: width, height: height };
	syncCrtCanvas();
}


//==============================================================================
// 모니터 색 알리기. (색마다 번지는 정도를 맞춥니다)
//==============================================================================
/**
 * @param { string } colorMode
 */
export function setCrtColorMode(colorMode) {
	const scale = GLOW_SCALE_BY_MODE[colorMode];
	glowScale = scale === undefined ? 1 : scale;
	if (webGL === null || program === null || uniformLocations === null) {
		return;
	}
	webGL.useProgram(program);
	webGL.uniform1f(uniformLocations.glow, GLOW_STRENGTH * glowScale);
}


/** @returns { boolean } */
export function isCrtOverlayActive() {
	return isEnabled;
}
