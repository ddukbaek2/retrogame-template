# 파비콘 생성. (도트 그림 — 글자만 떠 있는 옛 모니터 화면, 도스 화면 느낌)
#
# 포트폴리오 페이지가 폴더를 자동으로 싣는 조건이 favicon.ico + index.html <title> 입니다.
# 게임 안에는 그림이 없지만, 브라우저 탭의 아이콘은 그림일 수밖에 없습니다. 32 × 32 도트로 그려 8 배로 키웁니다.
# (사용자 지시, 2026-09-08 — "아이콘은 이미지적으로" · "모니터 화면에 텍스트만 있는 그런 느낌, 아니면 도스 화면")
#
# 사용법: python tools/generate-favicon.py
import os
from PIL import Image, ImageDraw

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_ROOT)

PNG_PATH = "webtemplate/favicon.png"
ICO_PATH = "webtemplate/favicon.ico"
ICON_SIZES = [16, 32, 48, 64, 128, 256]
DOT_SIZE = 32
SCALE = 8
BACKGROUND_COLOR = (14, 14, 18)
BEZEL_COLOR = (214, 204, 180)
BEZEL_SHADOW_COLOR = (150, 140, 118)
SCREEN_COLOR = (4, 22, 8)
TEXT_COLOR = (72, 255, 110)
TEXT_DIM_COLOR = (36, 150, 64)

image = Image.new("RGB", (DOT_SIZE, DOT_SIZE), BACKGROUND_COLOR)
draw = ImageDraw.Draw(image)

# 모니터 몸통(베젤) — 아래쪽 그림자 한 줄.
draw.rectangle((1, 2, 30, 24), fill=BEZEL_COLOR)
draw.rectangle((1, 24, 30, 25), fill=BEZEL_SHADOW_COLOR)
# 화면.
draw.rectangle((4, 5, 27, 21), fill=SCREEN_COLOR)
# 글자 줄들 — 짧은 가로 조각이 글자처럼 늘어섭니다. (프롬프트 · 명령 · 출력 · 출력 · 커서)
draw.rectangle((6, 7, 7, 7), fill=TEXT_COLOR)          # >
draw.rectangle((9, 7, 15, 7), fill=TEXT_COLOR)         # 명령
draw.rectangle((6, 10, 20, 10), fill=TEXT_DIM_COLOR)   # 출력
draw.rectangle((6, 13, 17, 13), fill=TEXT_DIM_COLOR)   # 출력
draw.rectangle((6, 16, 24, 16), fill=TEXT_DIM_COLOR)   # 출력
draw.rectangle((6, 19, 7, 19), fill=TEXT_COLOR)        # >
draw.rectangle((9, 18, 11, 20), fill=TEXT_COLOR)       # 커서 (깜빡이는 네모)
# 받침.
draw.rectangle((13, 26, 18, 27), fill=BEZEL_SHADOW_COLOR)
draw.rectangle((9, 28, 22, 29), fill=BEZEL_COLOR)

big = image.resize((DOT_SIZE * SCALE, DOT_SIZE * SCALE), Image.NEAREST)
big.save(PNG_PATH, optimize=True)
big.save(ICO_PATH, sizes=[(size, size) for size in ICON_SIZES])
print("favicon", PNG_PATH, ICO_PATH)
