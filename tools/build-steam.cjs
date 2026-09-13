//==============================================================================
// 스팀 올리기 준비.
//
// 데스크탑 실행 파일을 만든 뒤, 스팀 빌드 정의(vdf)에 앱 번호를 채워 넣고
// 올릴 때 칠 명령을 알려 줍니다. 실제 업로드는 계정이 필요해 여기서 하지 않습니다.
//
// 사용법.
//   node tools/build-steam.cjs --appid 1234567
//   node tools/build-steam.cjs --appid 1234567 --depot 1234568
//   node tools/build-steam.cjs --appid 1234567 --skip-build   (이미 만들어 둔 것 사용)
//
// 디포 번호를 안 적으면 앱 번호 + 1 로 잡습니다. 스팀웍스의 기본값입니다.
//==============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const steamDirectory = path.join(projectRoot, "platforms", "steam");
const unpackedDirectory = path.join(projectRoot, "build", "desktop", "win-unpacked");
const outputDirectory = path.join(projectRoot, "build", "steam", "output");


//==============================================================================
// 명령줄에서 값 하나 읽기.
//==============================================================================
function readArgument(argumentName) {
	const argumentIndex = process.argv.indexOf(argumentName);
	if (argumentIndex < 0 || argumentIndex + 1 >= process.argv.length) {
		return "";
	}
	return process.argv[argumentIndex + 1];
}


//==============================================================================
// vdf 안의 번호를 바꿔 적습니다.
//==============================================================================
function writeBuildDefinition(fileName, replacements) {
	const filePath = path.join(steamDirectory, fileName);
	let fileText = fs.readFileSync(filePath, "utf8");
	for (const replacement of replacements) {
		fileText = fileText.replace(replacement.from, replacement.to);
	}
	fs.writeFileSync(filePath, fileText, "utf8");
}


//==============================================================================
// 진입점.
//==============================================================================
function main() {
	const appId = readArgument("--appid");
	if (appId === "") {
		console.error("앱 번호가 없습니다. 스팀웍스에서 받은 번호를 넣습니다.");
		console.error("  node tools/build-steam.cjs --appid 1234567");
		process.exitCode = 1;
		return;
	}
	let depotId = readArgument("--depot");
	if (depotId === "") {
		depotId = String(Number(appId) + 1);
	}

	// 실행 파일 만들기.
	const isSkipBuild = process.argv.indexOf("--skip-build") >= 0;
	if (!isSkipBuild) {
		const result = childProcess.spawnSync("node", [path.join(projectRoot, "tools", "build-desktop.cjs")], {
			cwd: projectRoot,
			stdio: "inherit",
		});
		if (result.status !== 0) {
			console.error("데스크탑 빌드 실패.");
			process.exitCode = 1;
			return;
		}
	}
	if (!fs.existsSync(unpackedDirectory)) {
		console.error("올릴 것이 없습니다: " + unpackedDirectory);
		process.exitCode = 1;
		return;
	}

	// 스팀에서 로컬로 띄워 볼 때 필요한 표시. 실행 파일 옆에 둡니다.
	fs.writeFileSync(path.join(unpackedDirectory, "steam_appid.txt"), appId + "\n", "utf8");

	// 빌드 정의에 번호를 채웁니다.
	writeBuildDefinition("app_build.vdf", [
		{ from: /"appid"\s+"\d+"/, to: '"appid"\t\t"' + appId + '"' },
		{ from: /"0"\s+"depot_build\.vdf"/, to: '"' + depotId + '"\t"depot_build.vdf"' },
		{ from: /"\d+"\s+"depot_build\.vdf"/, to: '"' + depotId + '"\t"depot_build.vdf"' },
	]);
	writeBuildDefinition("depot_build.vdf", [
		{ from: /"DepotID"\s+"\d+"/, to: '"DepotID"\t"' + depotId + '"' },
	]);

	if (!fs.existsSync(outputDirectory)) {
		fs.mkdirSync(outputDirectory, { recursive: true });
	}

	const appBuildPath = path.join(steamDirectory, "app_build.vdf");
	console.log("");
	console.log("스팀 올릴 준비 끝.");
	console.log("  앱 번호   : " + appId);
	console.log("  디포 번호 : " + depotId);
	console.log("  올릴 폴더 : " + unpackedDirectory);
	console.log("");
	console.log("이제 이걸 칩니다.");
	console.log("  steamcmd +login <스팀계정> +run_app_build \"" + appBuildPath + "\" +quit");
	console.log("");
	console.log("처음 올리는 것이면 app_build.vdf 의 setlive 를 비워 둔 채 올리고,");
	console.log("스팀웍스에서 눈으로 확인한 뒤 기본 브랜치에 올립니다.");
}

main();
