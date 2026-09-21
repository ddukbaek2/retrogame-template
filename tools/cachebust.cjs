//==============================================================================
// 캐시 무효화.
//
// index.html 이 부르는 파일 이름 뒤에 그 파일의 지문을 붙입니다.
// 지문은 파일 내용에서 뽑으므로, 내용이 바뀌어야만 주소가 바뀝니다.
//
// 이게 없으면 고쳐서 배포해도 브라우저가 예전에 받아 둔 것을 계속 씁니다.
// 배포했는데 안 고쳐졌다고 하는 일의 대부분이 이것 때문입니다.
//
// 사용법.
//   node tools/cachebust.cjs                 (build/web)
//   node tools/cachebust.cjs build/other     (다른 폴더)
//==============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const targetDirectory = process.argv[2]
	? path.resolve(process.argv[2])
	: path.join(projectRoot, "build", "web");

// index.html 에서 지문을 붙일 확장자.
const BUSTED_EXTENSIONS = [".js", ".css"];
// 번들 안의 글자로 부르는 자산에서 지문을 붙일 확장자. 스프라이트 시트처럼 코드는 그대로인데 내용만
// 바뀌는 것이 있습니다. 붙이지 않으면 배포해도 브라우저가 예전 그림을 계속 씁니다.
const BUNDLED_ASSET_EXTENSIONS = [".png", ".json", ".wav", ".ogg", ".mp3", ".ttf", ".woff2"];
// 지문 길이. 8 자면 충돌을 걱정할 일이 없습니다.
const FINGERPRINT_LENGTH = 8;


//==============================================================================
// 파일 내용에서 지문을 뽑습니다.
//==============================================================================
function readFingerprint(filePath) {
	const fileBuffer = fs.readFileSync(filePath);
	const hash = crypto.createHash("sha1").update(fileBuffer).digest("hex");
	return hash.slice(0, FINGERPRINT_LENGTH);
}


//==============================================================================
// 진입점.
//==============================================================================
function main() {
	const indexPath = path.join(targetDirectory, "index.html");
	if (!fs.existsSync(indexPath)) {
		console.error("index.html 이 없다: " + indexPath);
		process.exitCode = 1;
		return;
	}

	// 번들 안의 자산 경로부터 손봅니다. 그래야 번들의 지문에 그 바뀜이 담깁니다.
	bustBundledAssets();

	let indexText = fs.readFileSync(indexPath, "utf8");
	let bustedCount = 0;

	// src="..." / href="..." 안의 상대 경로를 훑습니다.
	indexText = indexText.replace(/(src|href)="(\.\/[^"?#]+)"/g, (matched, attributeName, relativePath) => {
		const extensionName = path.extname(relativePath).toLowerCase();
		if (BUSTED_EXTENSIONS.indexOf(extensionName) < 0) {
			return matched;
		}
		const assetPath = path.join(targetDirectory, relativePath.slice(2));
		if (!fs.existsSync(assetPath)) {
			return matched;
		}
		const fingerprint = readFingerprint(assetPath);
		bustedCount += 1;
		console.log("  " + relativePath + " → ?v=" + fingerprint);
		return attributeName + '="' + relativePath + "?v=" + fingerprint + '"';
	});

	fs.writeFileSync(indexPath, indexText, "utf8");
	console.log("캐시 무효화: " + bustedCount + "개");

	writeVersionFile();
}


//==============================================================================
// 번들 안의 자산 경로에 지문을 붙입니다.
//
// 번들의 "./assets/…" 글자를 훑어 그 파일이 있으면 뒤에 ?v=지문을 붙입니다. 경로를 조각으로
// 이어 붙이는 자리는 잡히지 않으므로 그대로 둡니다.
//==============================================================================
function bustBundledAssets() {
	const bundleDirectory = path.join(targetDirectory, "js");
	if (!fs.existsSync(bundleDirectory)) {
		return;
	}
	for (const entryName of fs.readdirSync(bundleDirectory)) {
		if (path.extname(entryName).toLowerCase() !== ".js") {
			continue;
		}
		const bundlePath = path.join(bundleDirectory, entryName);
		let bundleText = fs.readFileSync(bundlePath, "utf8");
		let assetCount = 0;
		bundleText = bundleText.replace(/(["'`])(\.\/assets\/[^"'`?#]+)\1/g, (matched, quote, relativePath) => {
			const extensionName = path.extname(relativePath).toLowerCase();
			if (BUNDLED_ASSET_EXTENSIONS.indexOf(extensionName) < 0) {
				return matched;
			}
			const assetPath = path.join(targetDirectory, relativePath.slice(2));
			if (!fs.existsSync(assetPath)) {
				return matched;
			}
			assetCount += 1;
			return quote + relativePath + "?v=" + readFingerprint(assetPath) + quote;
		});
		fs.writeFileSync(bundlePath, bundleText, "utf8");
		console.log("번들 안의 자산 지문: " + entryName + " " + assetCount + "개");
	}
}


//==============================================================================
// 빌드 표시를 적어 둡니다.
//
// 웹 판에는 붙일 판 번호가 없습니다. 대신 커밋한 날짜와 짧은 해시를 적어,
// 지금 보고 있는 것이 언제 어느 판인지 화면에서 바로 알 수 있게 합니다.
// (런타임이 ./version.json 을 읽어 타이틀 구석에 적습니다)
//==============================================================================
function writeVersionFile() {
	let commitHash = "";
	let commitDate = "";
	try {
		commitHash = execSync("git rev-parse --short HEAD", { cwd: projectRoot }).toString().trim();
		commitDate = execSync("git log -1 --format=%cd --date=format:%Y-%m-%d", { cwd: projectRoot }).toString().trim();
	}
	catch (error) {
		console.log("빌드 표시: git 정보를 읽지 못해 건너뜁니다.");
		return;
	}
	const versionPath = path.join(targetDirectory, "version.json");
	const versionData = { date: commitDate, hash: commitHash };
	fs.writeFileSync(versionPath, JSON.stringify(versionData), "utf8");
	console.log("빌드 표시: " + commitDate + " " + commitHash);
}

main();
