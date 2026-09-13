//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 이미지의 화풍. (한 곳에서 정해 두 도구가 같이 씁니다)
//
// 낱개를 따로따로 받다 보니 그림체가 제각각이었습니다. (사용자 지적, 2026-09-13,
// "NPC나 적이나 오브젝트나 아무튼 풍이 다 안 맞는 것 같아, 동일한 그림체가 아님")
// 그래서 사람의 몸 비례, 빛의 방향, 색의 단, 윤곽의 굵기를 여기 한 줄씩 적어 두고
// `generate-sprites.mjs` 와 `generate-field.mjs` 가 똑같이 앞뒤에 붙입니다.
//
// 세 등신 같은 귀여운 결은 쓰지 않습니다. 진지한 던전 롤플레잉의 결입니다.
//==============================================================================


// 그림을 받을 모델. 받은 그림은 32 × 32 로 구워 밝기 네 단 마스크만 남기므로 가장 비싼 모델이
// 필요하지 않습니다. (사용자 지적, 2026-09-13, "왜 3 pro 를 쓴 거야, 어차피 가장 해상도 떨어지고
// 단순한 이미지 아니냐") 도구 다섯이 이 이름 하나를 함께 봅니다.
export const IMAGE_MODEL = "gemini-3.1-flash-image";


export const STYLE_LINES = System.Object.freeze([
	"Art style contract, identical for every icon:",
	"late 1990s DOS dungeon crawler pixel art, serious and grim dark fantasy, drawn as 32x32 pixel art scaled up.",
	"Human and humanoid figures are drawn with realistic adult proportions, about seven heads tall,",
	"a small head no taller than one seventh of the figure, long legs, narrow shoulders in proportion,",
	"standing upright and facing the viewer, whole body from the top of the head down to the feet inside the frame.",
	"Never chibi, never big headed, never three heads tall, never cute, never cartoonish, never a mascot.",
	"The subject fills the whole height of the frame, and its widest part fills at least two thirds of the frame width,",
	"so a wide cloak, a spread stance, a held tool or a broad load gives the silhouette real width.",
	"It must stay readable when shrunk down to 32 by 32 pixels: one thick unbroken silhouette, no thin spindly parts,",
	"no small scattered details, no speckled texture, no noise, every part at least three pixels thick at that size.",
	"This is the hardest rule: the whole subject must read as ONE COMPACT SOLID MASS when you squint at it.",
	"Limbs, legs, antennae, spikes, tails and cloth stay short and thick and pressed against the body,",
	"never long, never thin, never fanned out, never more than a few of them, and no gap inside the shape",
	"is thinner than three pixels at 32 by 32. The game draws this in one colour on black, so any detail",
	"finer than that turns into meaningless speckles.",
	"One single cold light source from the upper left, so the left side of every subject is lit and the lower right is in shadow.",
	"Exactly three brightness steps per subject plus pure black, and all three steps are clearly bright against the black:",
	"a mid tone base that covers most of the shape, a lighter tone, and a small very bright highlight.",
	"Use pure black only for a hard outline one pixel thick around the silhouette and for the narrow gaps that separate",
	"limbs, folds, armour plates and body parts, never for shading a large area, so the shape never dissolves into speckles.",
	"Worn and cracked and dirty but never dim: muted earthy hues raised to a clearly visible brightness.",
	"No gradients, no anti-aliasing, no text, no numbers, no borders, no grid lines, no ground shadow.",
]);


//==============================================================================
// 한 줄로 잇기.
//==============================================================================
/**
 * @returns { string }
 */
export function readStyleText() {
	return STYLE_LINES.join(" ");
}
