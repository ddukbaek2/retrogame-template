//==============================================================================
// 데스크탑 판 만들기. (Electron + electron-builder)
//
// 웹 빌드 산출물을 데스크탑 폴더 안으로 옮긴 뒤 실행 파일로 묶습니다.
// 게임 코드는 웹과 완전히 같은 것을 씁니다.
//
// 사용법.
//   node tools/build-desktop.cjs           (실행 파일까지 묶습니다)
//   node tools/build-desktop.cjs --stage   (자산만 옮기고 묶지 않습니다 — 바로 실행해 볼 때)
//
// 실행 파일은 build/desktop/win-unpacked 에 나옵니다. 그 폴더를 통째로
// 스팀 빌드에 올립니다. (steampipe 의 ContentRoot)
//==============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const webBuildDirectory = path.join(projectRoot, "build", "web");
const desktopDirectory = path.join(projectRoot, "platforms", "desktop");
const stagedWebDirectory = path.join(desktopDirectory, "web");


//==============================================================================
// 폴더를 통째로 지웁니다.
//==============================================================================
function removeDirectory(targetPath) {
	if (!fs.existsSync(targetPath)) {
		return;
	}
	fs.rmSync(targetPath, { recursive: true, force: true });
}


//==============================================================================
// 폴더를 통째로 옮겨 적습니다.
//==============================================================================
function copyDirectory(sourcePath, targetPath) {
	if (!fs.existsSync(targetPath)) {
		fs.mkdirSync(targetPath, { recursive: true });
	}
	const entryNames = fs.readdirSync(sourcePath);
	for (const entryName of entryNames) {
		const sourceEntryPath = path.join(sourcePath, entryName);
		const targetEntryPath = path.join(targetPath, entryName);
		const entryStat = fs.statSync(sourceEntryPath);
		if (entryStat.isDirectory()) {
			copyDirectory(sourceEntryPath, targetEntryPath);
			continue;
		}
		fs.copyFileSync(sourceEntryPath, targetEntryPath);
	}
}


//==============================================================================
// 폴더 안의 파일 수와 크기를 셉니다.
//==============================================================================
function measureDirectory(targetPath) {
	let fileCount = 0;
	let totalBytes = 0;
	const entryNames = fs.readdirSync(targetPath);
	for (const entryName of entryNames) {
		const entryPath = path.join(targetPath, entryName);
		const entryStat = fs.statSync(entryPath);
		if (entryStat.isDirectory()) {
			const inner = measureDirectory(entryPath);
			fileCount += inner.fileCount;
			totalBytes += inner.totalBytes;
			continue;
		}
		fileCount += 1;
		totalBytes += entryStat.size;
	}
	return { fileCount: fileCount, totalBytes: totalBytes };
}


//==============================================================================
// 진입점.
//==============================================================================
function main() {
	if (!fs.existsSync(webBuildDirectory)) {
		console.error("웹 빌드가 없습니다. 먼저 npm run build 를 돌립니다.");
		process.exitCode = 1;
		return;
	}

	// 웹 산출물을 데스크탑 폴더 안으로 옮깁니다.
	removeDirectory(stagedWebDirectory);
	copyDirectory(webBuildDirectory, stagedWebDirectory);
	const measured = measureDirectory(stagedWebDirectory);
	console.log("자산 옮김: " + measured.fileCount + "개 · " + (measured.totalBytes / 1024 / 1024).toFixed(2) + " MB");

	const isStageOnly = process.argv.indexOf("--stage") >= 0;
	if (isStageOnly) {
		console.log("자산만 옮겼습니다. 바로 띄워 보려면:");
		console.log("  npm start --prefix platforms/desktop");
		return;
	}

	// 실행 파일로 묶습니다.
	console.log("실행 파일로 묶는 중...");
	const result = childProcess.spawnSync("npm", ["run", "build:win", "--prefix", "platforms/desktop"], {
		cwd: projectRoot,
		stdio: "inherit",
		shell: true,
	});
	if (result.status !== 0) {
		console.error("묶기 실패.");
		process.exitCode = 1;
		return;
	}

	const unpackedDirectory = path.join(projectRoot, "build", "desktop", "win-unpacked");
	if (fs.existsSync(unpackedDirectory)) {
		const unpacked = measureDirectory(unpackedDirectory);
		console.log("");
		console.log("데스크탑 빌드 완료: " + unpackedDirectory);
		console.log("  " + unpacked.fileCount + "개 · " + (unpacked.totalBytes / 1024 / 1024).toFixed(2) + " MB");
		console.log("  이 폴더를 스팀 빌드의 ContentRoot 로 올립니다.");
	}
}

main();
