# retrogame-template

옛 PC 게임의 결로 게임을 만드는 틀입니다. [vanilla.js](https://github.com/ddukbaek2/vanilla.js) 위에 얹혀 있습니다.

- **1 ~ 8 비트 화면.** 1 비트 단색(녹색, 흰색, 적색, 청색), 2 비트 네 단, 4 비트 16 색, 8 비트 256 색을 설정으로 바꿉니다. 그리는 쪽은 색의 **뜻**만 말하고 실제 값은 표시 장치가 정합니다.
- **브라운관.** 창 전체를 덮는 모니터 그림 안에 게임 화면이 볼록 렌즈로 휘어 들어갑니다. 주사선, 형광 글로우, 형광 마스크가 얹힙니다. 설정으로 끕니다.
- **도트 글꼴.** 백버퍼를 기준 해상도로 고정하고 정수 배로만 키웁니다. 엔진의 글자 안티앨리어싱을 꺼서 구운 글자가 뭉개지지 않습니다.
- **단순한 입력.** 방향 넷과 확인, 취소, 메뉴가 전부입니다. 키보드, 게임패드, 마우스, 손가락이 같은 명령으로 들어옵니다. 손가락으로만 노는 기기에는 화면 아래에 가상 패드가 섭니다.

**한 프로젝트에 게임 한 편입니다.** 이 틀을 복제해 게임 하나를 만듭니다. 여러 편을 한 앱에 담는 구조가 아닙니다.

---

## 시작하기

```bash
git clone --recursive https://github.com/ddukbaek2/retrogame-template.git
cd retrogame-template
npm install
npm run build
```

`--recursive` 를 빠뜨렸으면 `git submodule update --init --recursive` 를 부릅니다.

만든 것은 `build/web` 에 놓입니다. 그 폴더를 정적 서버에 올리면 됩니다. 개발 중에는 `launcher.html` 을 그대로 열어도 됩니다. (묶지 않고 원본을 읽습니다)

| 명령 | 하는 일 |
|---|---|
| `npm run build` | 웹으로 묶습니다. `build/web` |
| `npm run check` | 코드를 살펴봅니다. |
| `npm run build:desktop` | 데스크탑(일렉트론)으로 묶습니다. |
| `npm run build:steam` | 스팀에 올릴 꼴로 묶습니다. |

---

## 게임 만들기

`src/games/sample/` 이 자리 표시입니다. 이것을 갈아 끼웁니다.

**1. 모듈을 만듭니다.** `src/games/<id>/<id>game.js` 에 `GameModule` 을 물려받은 클래스를 씁니다.

```javascript
export class MyGame extends GameModule {
	constructor(scene) {
		super(scene, "my", "내 게임", "한 줄 설명입니다.");
	}

	createScreens() {
		return { play: new PlayScreen(this) };
	}

	getEntryKey() {
		return "play";
	}
}
```

**2. 화면을 만듭니다.** `src/games/<id>/screen/` 에 `ScreenNode` 를 물려받아 `handleCommand` 와 `draw` 를 채웁니다.

**3. 두 곳을 고칩니다.**

- `src/game/gameentry.js` 들여오기와 만들기 (두 줄입니다)
- `src/game/identity.js` 이 게임의 종이 색, 먹 색, 강조색

그다음 `src/games/sample/` 은 지워도 됩니다. 게임 이름과 한 줄 설명은 모듈 생성자에 적습니다.
타이틀에서 **시작**을 고르면 바로 그 게임으로 들어갑니다.

규칙은 `logic/` 에 순수 함수로 둡니다. 엔진도 브라우저 API 도 들이지 않으면 Node 로 돌려 검증할 수 있습니다.

자세한 것은 `docs/게임-모듈-규약.md` 에 있습니다.

---

## 구조

```
src/
  main.js            앱 기동, 씬, 화면 등록
  game/              틀. 표시 장치, 색, 브라운관, 입력, 글자, 소리, 저장
    gameentry.js     **이 프로젝트가 만드는 게임을 가리킵니다**
    identity.js      **이 게임의 색**
  ui/                공용 부품. 화면 노드, 목록, 상자, 자리 잡기
  screen/            타이틀
  panel/             설정
  games/<id>/        게임
libs/vanilla.js      엔진 (git 서브모듈)
assets/
  fonts/             도트 글꼴
  monitor/           브라운관 모니터 그림
tools/               빌드와 그림 굽기 도구
docs/                규약 문서
platforms/           데스크탑, 스팀 묶기
webtemplate/         빌드 결과의 틀
```

---

## 문서

| 문서 | 다루는 것 |
|---|---|
| `docs/게임-모듈-규약.md` | 게임을 이 틀에 얹는 방법, 공통으로 지킬 것 |
| `docs/게임-기본조건.md` | 해상도, 조작, 비주얼 방향 |
| `docs/UI-규약.md` | 화면 시각, 크기, 움직임 |
| `docs/리소스-규약.md` | 글꼴과 그 밖의 자산 |
| `docs/개발-프로세스.md` | 실행, 빌드, 검증, 배포 절차 |
| `docs/엔진-보완-내역.md` | 엔진에 가한 수정 (원본 역이식용) |

---

## 라이선스

ISC
