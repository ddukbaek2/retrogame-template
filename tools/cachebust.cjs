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

// 지문을 붙일 확장자. 그림과 소리는 이름이 바뀔 일이 거의 없어 두지 않습니다.
const BUSTED_EXTENSIONS = [".js", ".css"];
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
