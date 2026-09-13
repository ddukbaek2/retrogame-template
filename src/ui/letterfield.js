//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { drawText } from "../game/text.js";
import { approachValue } from "../game/motion.js";
import { Colors, LETTER_FOLLOW_RATE, SHAKE_SECONDS, SHAKE_DISTANCE, CLEAR_BOUNCE_SECONDS, CLEAR_BOUNCE_HEIGHT } from "../game/constants.js";


//==============================================================================
// 글자 무리.
//
// 판 위의 글자들은 번호로 구별됩니다. 판이 바뀌면 같은 번호의 글자가 새 자리로 미끄러져
// 갑니다. (접히고 밀리고 기울어지는 것이 전부 이 미끄러짐입니다) 사라진 번호는 지우고,
// 새 번호는 그 자리에 바로 놓습니다.
//
// 막히면 흔들리고, 완료되면 차례로 튀어 오릅니다. 늘리거나 줄이지 않습니다.
//==============================================================================


export class LetterField {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map<number, object> } */ #letters;
	/** @private @type { Set<number> } */ #seenIds;
	/** @private @type { boolean } */ #isSyncing;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		this.#letters = new Map();
		this.#seenIds = new Set();
		this.#isSyncing = false;
	}

	//==============================================================================
	// 맞추기 시작. (이 뒤에 setLetter 로 안 불린 글자는 끝에 지웁니다)
	//==============================================================================
	beginSync() {
		this.#seenIds.clear();
		this.#isSyncing = true;
	}

	//==============================================================================
	// 맞추기 끝. (안 보인 글자 지우기)
	//==============================================================================
	endSync() {
		if (!this.#isSyncing) {
			return;
		}
		const removedIds = [];
		for (const id of this.#letters.keys()) {
			if (!this.#seenIds.has(id)) {
				removedIds.push(id);
			}
		}
		for (const id of removedIds) {
			this.#letters.delete(id);
		}
		this.#isSyncing = false;
	}

	//==============================================================================
	// 글자 놓기. (있으면 목표 자리만 바꾸고, 없으면 그 자리에 바로 놓습니다)
	//==============================================================================
	/**
	 * @param { number } id
	 * @param { string } glyph
	 * @param { number } targetX 글자 한가운데.
	 * @param { number } targetY
	 * @param { string } colorKey
	 */
	setLetter(id, glyph, targetX, targetY, colorKey) {
		this.#seenIds.add(id);
		const existing = this.#letters.get(id);
		if (existing !== undefined) {
			existing.glyph = glyph;
			existing.targetX = targetX;
			existing.targetY = targetY;
			existing.colorKey = colorKey;
			return;
		}
		this.#letters.set(id, {
			glyph: glyph,
			x: targetX,
			y: targetY,
			targetX: targetX,
			targetY: targetY,
			colorKey: colorKey,
			shakeTimer: 0,
			popTimer: 0,
			popDelay: 0,
		});
	}

	//==============================================================================
	// 글자를 목표 자리에 바로 두기. (화면이 처음 열릴 때)
	//==============================================================================
	snapAll() {
		for (const letter of this.#letters.values()) {
			letter.x = letter.targetX;
			letter.y = letter.targetY;
		}
	}

	//==============================================================================
	// 색 바꾸기.
	//==============================================================================
	/**
	 * @param { number } id
	 * @param { string } colorKey
	 */
	setColor(id, colorKey) {
		const letter = this.#letters.get(id);
		if (letter === undefined) {
			return;
		}
		letter.colorKey = colorKey;
	}

	//==============================================================================
	// 글자 하나 흔들기.
	//==============================================================================
	/**
	 * @param { number } id
	 */
	shake(id) {
		const letter = this.#letters.get(id);
		if (letter === undefined) {
			return;
		}
		letter.shakeTimer = SHAKE_SECONDS;
	}

	//==============================================================================
	// 전부 흔들기.
	//==============================================================================
	shakeAll() {
		for (const letter of this.#letters.values()) {
			letter.shakeTimer = SHAKE_SECONDS;
		}
	}

	//==============================================================================
	// 차례로 튀어 오르기. (완료)
	//==============================================================================
	/**
	 * @param { number } staggerSeconds 글자 사이 시간차.
	 */
	popAll(staggerSeconds) {
		let order = 0;
		const sorted = System.Array.from(this.#letters.values()).sort((first, second) => {
			if (first.targetY !== second.targetY) {
				return first.targetY - second.targetY;
			}
			return first.targetX - second.targetX;
		});
		for (const letter of sorted) {
			letter.popTimer = CLEAR_BOUNCE_SECONDS;
			letter.popDelay = order * staggerSeconds;
			order += 1;
		}
	}

	//==============================================================================
	// 글자 자리 반환. (없으면 null)
	//==============================================================================
	/**
	 * @param { number } id
	 * @returns { object }
	 */
	getLetter(id) {
		const letter = this.#letters.get(id);
		if (letter === undefined) {
			return null;
		}
		return letter;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		for (const letter of this.#letters.values()) {
			letter.x = approachValue(letter.x, letter.targetX, LETTER_FOLLOW_RATE, timeDelta);
			letter.y = approachValue(letter.y, letter.targetY, LETTER_FOLLOW_RATE, timeDelta);
			if (letter.shakeTimer > 0) {
				letter.shakeTimer -= timeDelta;
			}
			if (letter.popDelay > 0) {
				letter.popDelay -= timeDelta;
			}
			else if (letter.popTimer > 0) {
				letter.popTimer -= timeDelta;
			}
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { object } graphic
	 * @param { object } tier
	 */
	draw(graphic, tier) {
		for (const letter of this.#letters.values()) {
			let offsetX = 0;
			let offsetY = 0;
			if (letter.shakeTimer > 0) {
				const remaining = letter.shakeTimer / SHAKE_SECONDS;
				offsetX = System.Math.sin(letter.shakeTimer * 70) * SHAKE_DISTANCE * remaining;
			}
			if (letter.popDelay <= 0 && letter.popTimer > 0) {
				const ratio = 1 - letter.popTimer / CLEAR_BOUNCE_SECONDS;
				offsetY = -System.Math.abs(System.Math.sin(ratio * System.Math.PI * 2)) * CLEAR_BOUNCE_HEIGHT * (1 - ratio);
			}
			const drawX = System.Math.round(letter.x + offsetX);
			const drawY = System.Math.round(letter.y + offsetY);
			drawText(graphic, letter.glyph, drawX, drawY, tier, letter.colorKey, "center");
		}
	}

	//==============================================================================
	// 글자가 아직 움직이는 중인지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isMoving() {
		for (const letter of this.#letters.values()) {
			if (System.Math.abs(letter.x - letter.targetX) > 0.5 || System.Math.abs(letter.y - letter.targetY) > 0.5) {
				return true;
			}
		}
		return false;
	}

	//==============================================================================
	// 기본 색. (다른 파일이 Colors 를 다시 들여오지 않아도 되게)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	static readDefaultColorKey() {
		return Colors.textPrimary;
	}
}
