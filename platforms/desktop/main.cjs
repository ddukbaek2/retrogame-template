//==============================================================================
// 데스크탑 판 진입점. (Electron)
//
// 웹 빌드 산출물(build/web)을 창 하나에 그대로 띄웁니다. 게임 코드는 웹과 완전히
// 같은 것을 씁니다. 데스크탑에서만 다르게 굴어야 하는 것은 여기서만 손댑니다.
//
// 스팀에 올릴 때는 electron-builder 가 이 폴더를 묶어 실행 파일로 만듭니다.
// 스팀덱은 1280 × 800 이 곧 화면이라 전체 화면이 기준 해상도 그대로입니다.
//==============================================================================
"use strict";
const { app, BrowserWindow, Menu, globalShortcut } = require("electron");
const path = require("path");

// 기준 해상도. 웹 판과 같은 16:10 입니다.
const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 800;
// 창을 이보다 작게 줄이지 못하게 합니다. 글자가 읽히지 않기 시작하는 크기입니다.
const MINIMUM_WIDTH = 640;
const MINIMUM_HEIGHT = 400;

let mainWindow = null;


//==============================================================================
// 창 만들기.
//==============================================================================
function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: REFERENCE_WIDTH,
		height: REFERENCE_HEIGHT,
		minWidth: MINIMUM_WIDTH,
		minHeight: MINIMUM_HEIGHT,
		useContentSize: true,
		// 게임 화면 밖은 검습니다. 창이 뜨는 순간 흰 판이 번쩍이지 않게 미리 맞춰 둡니다.
		backgroundColor: "#000000",
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			// 게임은 노드를 쓰지 않습니다. 열어 둘 이유가 없습니다.
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	// 메뉴 막대를 아예 없앱니다. 게임 창에 파일 · 편집 메뉴가 있을 이유가 없습니다.
	Menu.setApplicationMenu(null);

	const indexPath = path.join(__dirname, "web", "index.html");
	mainWindow.loadFile(indexPath);

	// 다 그려진 뒤에 보여 줍니다. 빈 창이 먼저 뜨는 것을 막습니다.
	mainWindow.once("ready-to-show", () => {
		mainWindow.show();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}


//==============================================================================
// 전체 화면 넣고 빼기.
//==============================================================================
function toggleFullScreen() {
	if (mainWindow === null) {
		return;
	}
	const isFullScreen = mainWindow.isFullScreen();
	mainWindow.setFullScreen(!isFullScreen);
}


//==============================================================================
// 진입점.
//==============================================================================
// 창을 두 개 띄우지 않습니다. 두 번째로 실행하면 이미 떠 있는 창을 앞으로 올립니다.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
	app.quit();
}
else {
	app.on("second-instance", () => {
		if (mainWindow === null) {
			return;
		}
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.focus();
	});

	app.whenReady().then(() => {
		createMainWindow();

		// F11 · Alt+Enter 전체 화면. 게임 안에 창 조작 UI 를 두지 않으므로 여기서 받습니다.
		globalShortcut.register("F11", toggleFullScreen);
		globalShortcut.register("Alt+Enter", toggleFullScreen);

		app.on("activate", () => {
			const windowCount = BrowserWindow.getAllWindows().length;
			if (windowCount === 0) {
				createMainWindow();
			}
		});
	});

	app.on("will-quit", () => {
		globalShortcut.unregisterAll();
	});

	app.on("window-all-closed", () => {
		// 맥이 아니면 창을 다 닫는 것이 곧 종료입니다.
		if (process.platform !== "darwin") {
			app.quit();
		}
	});
}
