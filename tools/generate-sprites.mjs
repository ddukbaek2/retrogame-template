//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import fileSystem from "node:fs";
import path from "node:path";
import { readStyleText, IMAGE_MODEL } from "./sprite-style.mjs";


//==============================================================================
// 도트 그림 만들기. (제미나이에게 한 장을 받아 팔레트에 맞춰 굽습니다)
//
//   node tools/generate-sprites.mjs
//
// 필드에 놓이는 적과 아이템은 선으로만 그리기에는 무엇인지 알아보기 어렵습니다. 그래서 그림
// 한 장을 받아 씁니다. (사용자 지시, 2026-09-10) 다만 화면의 색 수(1, 2, 4, 8 비트)가 설정마다
// 바뀌므로, 받은 그림을 그대로 쓰지 않고 **밝기 두 단의 마스크**로 구워 둡니다. 그리는 쪽이
// 그 두 장을 `Colors` 의 열쇠로 물들여 찍으면 어떤 색 수에서도 어긋나지 않습니다.
//
// 결과물
//   assets/sprites/wire3d.png   가로에 낱개, 세로에 밝기 두 단.
//   assets/sprites/wire3d.json  낱개의 차례와 칸 크기.
//==============================================================================


// 받을 그림의 크기와 격자.
const SHEET_COLUMNS = 4;
const SHEET_ROWS = 4;
// 구워 낼 낱개 한 칸의 크기. 32 로는 사람이 무엇을 들고 있는지도 보이지 않았습니다.
// (사용자 지적, 2026-09-13, "너무 줄어들어서 제대로 표현이 잘 안되고 있는데")
const CELL_SIZE = 48;
// 밝기 네 단. (0 은 속을 채우는 검정, 1 부터 3 이 어두운 몸에서 밝은 데까지)
const LEVEL_COUNT = 4;
// 검정으로 볼 밝기. (이보다 어두우면 배경입니다)
const BACKGROUND_LEVEL = 46;

// 시트 목록. 한 장에 4 × 4 로 열여섯 칸을 받습니다.
//
// 적과 아이템이 그림을 나눠 쓰고 있어 서로 구분되지 않았습니다. 그래서 무리마다 시트를 따로 받아
// 낱개마다 제 그림을 줍니다. (사용자 지시, 2026-09-13, "아이템이랑 적들 중복 없게 해 줘라",
// "아이템의 경우에 좀 맞는 이미지였으면 해")
//
//   node tools/generate-sprites.mjs enemies
//   node tools/generate-sprites.mjs consumables
//   node tools/generate-sprites.mjs gears
const SHEETS = {
	enemies: {
		raw: ".assets-raw/wire3d-enemies-raw.png",
		ids: [
			"crawler", "sludge", "needle", "shrike",
			"coil", "pillar", "watcher", "husk",
			"shard", "hollow", "mirror", "lattice",
			"gnash", "butcher", "", "",
		],
		rows: [
			"Row 1: a thick armoured centipede curled tight into one compact coil with short stubby legs pressed to the body,",
			"a fat round dripping slime blob with two big eyes, a dense clump of short thick thorns fused into one solid lump,",
			"a round hedgehog rolled up into a ball with short blunt quills.",
			"Row 2: a fat coiled serpent with a thick raised head and a heavy body, a large round armoured beetle seen from above with short thick pincers,",
			"one huge round eyeball with a few short thick tendrils under it, a large heavy cracked skull.",
			"Row 3: a tight cluster of short thick crystal shards fused into one solid block,",
			"a huge thick-bodied python coiled into a heavy mass with its head raised,",
			"a hulking brute with ONE single large eye in the middle of its forehead and heavy thick limbs,",
			"a hooded wraith in one heavy thick robe with no visible limbs.",
			"Row 4: a massive blocky stone golem with heavy square shoulders,",
			"a towering butcher in a heavy blood-stained leather apron holding one huge cleaver, broad square shoulders,",
			"a sack hood over the head with no face, thick heavy body, standing still and facing the viewer,",
			"empty black cell, empty black cell.",
		],
	},
	consumables: {
		raw: ".assets-raw/wire3d-consumables-raw.png",
		ids: [
			"bandage", "draught", "elixir", "root",
			"bread", "soup", "meat", "ration",
			"antidote", "tourniquet", "clearWater", "holyWater",
			"ether", "essence", "lifeFruit", "key",
		],
		rows: [
			"Row 1: a rolled cloth bandage, a small round healing potion flask, a tall ornate elixir bottle with a stopper, a bundle of green herbs tied with string.",
			"Row 2: a round loaf of bread, a bowl of soup with steam, a cut of meat on the bone, a wrapped travel ration parcel.",
			"Row 3: a small vial of green antidote, a tight cloth tourniquet strap with a buckle, a clear water flask, a holy water vial with a cross engraved.",
			"Row 4: a slender vial of blue mana liquid, a cut blue mana crystal, a red fruit with a leaf, an old iron key.",
		],
	},
	gears: {
		raw: ".assets-raw/wire3d-gears-raw.png",
		ids: [
			"whetstone", "edge", "core", "brand",
			"plate", "shell", "ward", "ring",
			"charm", "fang", "magicLamp", "compass",
			"lamp", "coinPouch", "coinSack", "treasure",
		],
		rows: [
			"Row 1: a heavy wooden cudgel club, a short dagger with a cross guard, a spear with a flaming tip, a black sword with a dark aura.",
			"Row 2: a leather chest armour piece, a chain mail shirt, a heavy plate cuirass, a plain silver ring.",
			"Row 3: a warding talisman on a cord, a fang necklace, an ornate magic lantern glowing, a round compass with a needle.",
			"Row 4: a burning wooden torch, a small drawstring coin pouch, a large bulging coin sack, a pile of jewels and treasure.",
		],
	},
};

const sheetName = process.argv[2] === undefined ? "enemies" : process.argv[2];
const sheet = SHEETS[sheetName];
if (sheet === undefined) {
	console.log("모르는 시트입니다: " + sheetName);
	console.log("고를 수 있는 것: " + System.Object.keys(SHEETS).join(", "));
	process.exit(1);
}
const SPRITE_IDS = sheet.ids;

const PROMPT = [
	"A single 4x4 grid sprite sheet of 16 DOS-era pixel art icons on a pure black background.",
	"Each grid cell contains exactly one centered subject drawn large and clearly readable.",
	readStyleText(),
].concat(sheet.rows).concat([
	"Leave wide black separation between every cell.",
]).join(" ");


//==============================================================================
// 환경 파일에서 열쇠 읽기.
//==============================================================================
/**
 * @returns { string }
 */
function readApiKey() {
	const envPath = path.join(process.cwd(), ".env");
	const text = fileSystem.readFileSync(envPath, "utf8");
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.startsWith("GOOGLE_AI_API")) {
			const value = trimmed.slice(trimmed.indexOf("=") + 1).trim();
			return value;
		}
	}
	throw new Error(".env 에 GOOGLE_AI_API 가 없습니다.");
}


//==============================================================================
// 제미나이에게 그림 한 장 받기.
//==============================================================================
/**
 * @param { string } apiKey
 * @returns { Promise<Buffer> }
 */
async function requestImage(apiKey) {
	const address = "https://generativelanguage.googleapis.com/v1beta/models/" + IMAGE_MODEL + ":generateContent";
	const body = {
		contents: [{ parts: [{ text: PROMPT }] }],
		generationConfig: { imageConfig: { aspectRatio: "1:1" } },
	};
	const response = await fetch(address, {
		method: "POST",
		headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error("제미나이 응답 " + response.status + ": " + errorText.slice(0, 400));
	}
	const payload = await response.json();
	const candidates = payload.candidates === undefined ? [] : payload.candidates;
	for (const candidate of candidates) {
		const parts = candidate.content === undefined ? [] : candidate.content.parts;
		for (const part of parts) {
			if (part.inlineData !== undefined && part.inlineData.data !== undefined) {
				return Buffer.from(part.inlineData.data, "base64");
			}
		}
	}
	throw new Error("그림이 들어 있지 않습니다: " + JSON.stringify(payload).slice(0, 400));
}


//==============================================================================
// 받은 그림 저장. (굽는 일은 파이썬 쪽이 맡습니다)
//==============================================================================
async function main() {
	const apiKey = readApiKey();
	const imageBuffer = await requestImage(apiKey);
	const rawDirectory = path.join(process.cwd(), ".assets-raw");
	fileSystem.mkdirSync(rawDirectory, { recursive: true });
	const rawPath = path.join(process.cwd(), sheet.raw);
	fileSystem.writeFileSync(rawPath, imageBuffer);
	console.log("받은 그림: " + rawPath + " (" + imageBuffer.length + " 바이트)");
	// 어느 칸이 무엇인지 굽는 쪽이 알 수 있게 차례를 옆에 적어 둡니다. 아틀라스의 차례 표
	// (assets/sprites/wire3d.json) 는 굽는 쪽이 여러 시트를 합치며 갱신하므로 여기서 건드리지 않습니다.
	const listPath = rawPath.replace(/\.png$/, ".json");
	fileSystem.writeFileSync(listPath, JSON.stringify({ ids: SPRITE_IDS }, null, "\t") + "\n", "utf8");
	console.log("칸 차례: " + listPath);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
