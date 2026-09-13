#==============================================================================
# 받은 그림을 팔레트에 맞춰 굽습니다.
#
#   python tools/bake-sprites.py
#
# 화면의 색 수가 설정마다 바뀌므로 받은 색을 그대로 쓰지 않습니다. 낱개마다 밝기를 네 단으로
# 나누어 마스크 네 장을 만들고, 그리는 쪽이 그것을 `Colors` 의 열쇠로 물들여 찍습니다.
#
#   0 단 = 윤곽과 속의 검정. 종이색으로 채워 뒤가 비치지 않게 합니다.
#   1 ~ 3 단 = 어두운 몸에서 밝은 데까지.
#
#   가로 = 낱개 열여섯, 세로 = 밝기 네 단.
#
# 받은 그림의 배경은 흰색일 수도 검정일 수도 있습니다. 칸의 네 귀퉁이를 보고 스스로 정합니다.
#==============================================================================
import io
import json
import os

from PIL import Image
import numpy as np

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RAW_PATH = ".assets-raw/wire3d-sprites-raw.png"
SHEET_PATH = "assets/sprites/wire3d.png"
INDEX_PATH = "assets/sprites/wire3d.json"

index = json.load(io.open(INDEX_PATH, encoding="utf-8"))
CELL_SIZE = index["cellSize"]
LEVEL_COUNT = index["levelCount"]
COLUMNS = index["columns"]
ROWS = index["rows"]
IDS = index["ids"]

# 배경으로 볼 거리. (귀퉁이 색과 이만큼 안쪽이면 배경입니다)
BACKGROUND_DISTANCE = 36
# 담긴 것 둘레에 두는 여백. (내려 찍기 전 원본 자로 잰 값)
CROP_PADDING = 6

source = Image.open(RAW_PATH).convert("RGB")
sourceCellWidth = source.width // COLUMNS
sourceCellHeight = source.height // ROWS

spriteCount = COLUMNS * ROWS
# 따로 받아 뒤에 붙여 둔 낱개가 있으면 그 칸은 건드리지 않습니다. (`tools/bake-single.py`)
if os.path.exists(SHEET_PATH):
	sheet = np.asarray(Image.open(SHEET_PATH).convert("RGBA")).copy()
	# 칸 크기가 바뀌었으면 옛 시트를 이어 쓸 수 없습니다. 새로 깝니다.
	isFitting = sheet.shape[0] == CELL_SIZE * LEVEL_COUNT and sheet.shape[1] >= CELL_SIZE * spriteCount
	if not isFitting:
		sheet = np.zeros((CELL_SIZE * LEVEL_COUNT, CELL_SIZE * spriteCount, 4), np.uint8)
else:
	sheet = np.zeros((CELL_SIZE * LEVEL_COUNT, CELL_SIZE * spriteCount, 4), np.uint8)


def fillInsideHoles(litMask):
	# 테두리에서 시작해 빈 자리를 타고 들어갑니다. 닿지 못한 빈 자리는 속입니다.
	height, width = litMask.shape
	reached = np.zeros(litMask.shape, bool)
	stack = []
	for x in range(width):
		for y in (0, height - 1):
			if not litMask[y, x] and not reached[y, x]:
				reached[y, x] = True
				stack.append((y, x))
	for y in range(height):
		for x in (0, width - 1):
			if not litMask[y, x] and not reached[y, x]:
				reached[y, x] = True
				stack.append((y, x))
	while stack:
		y, x = stack.pop()
		for stepY, stepX in ((1, 0), (-1, 0), (0, 1), (0, -1)):
			nextY = y + stepY
			nextX = x + stepX
			if nextY < 0 or nextX < 0 or nextY >= height or nextX >= width:
				continue
			if litMask[nextY, nextX] or reached[nextY, nextX]:
				continue
			reached[nextY, nextX] = True
			stack.append((nextY, nextX))
	return litMask | (~reached)


def fillRowSpans(litMask):
	# 줄마다 가장 왼쪽과 오른쪽 사이를 채웁니다.
	# 아치의 구멍처럼 아래가 트인 속은 바깥과 이어져 있어 앞의 방법으로는 메워지지 않습니다.
	# 그대로 두면 그 자리로 뒤의 벽이 비칩니다. (사용자 지적, 2026-09-13)
	height, width = litMask.shape
	filled = litMask.copy()
	for y in range(height):
		xs = np.nonzero(litMask[y])[0]
		if xs.size == 0:
			continue
		filled[y, xs[0]:xs[-1] + 1] = True
	return filled


def readBackgroundColor(cellArray):
	# 칸에서 가장 많이 나온 색이 배경입니다. 귀퉁이는 격자 선에 걸릴 수 있어 쓰지 않습니다.
	quantized = (cellArray // 16).reshape(-1, 3)
	keys = quantized[:, 0] * 4096 + quantized[:, 1] * 64 + quantized[:, 2]
	values, counts = np.unique(keys, return_counts=True)
	topKey = values[counts.argmax()]
	red = (topKey // 4096) * 16 + 8
	green = ((topKey // 64) % 64) * 16 + 8
	blue = (topKey % 64) * 16 + 8
	return np.array([red, green, blue])


for spriteIndex in range(spriteCount):
	column = spriteIndex % COLUMNS
	row = spriteIndex // COLUMNS
	box = (column * sourceCellWidth, row * sourceCellHeight,
	       (column + 1) * sourceCellWidth, (row + 1) * sourceCellHeight)
	cell = source.crop(box)
	cellArray = np.asarray(cell).astype(int)
	background = readBackgroundColor(cellArray)
	distance = np.sqrt(((cellArray - background) ** 2).sum(axis=2))
	lit = distance > BACKGROUND_DISTANCE
	if not lit.any():
		continue
	ys, xs = np.where(lit)
	top, bottom = ys.min(), ys.max() + 1
	left, right = xs.min(), xs.max() + 1
	# 담긴 것을 한가운데에 두고 네모로 잘라 냅니다. 낱개마다 크기가 들쭉날쭉해 보이지 않게 합니다.
	side = max(bottom - top, right - left) + CROP_PADDING * 2
	centerY = (top + bottom) // 2
	centerX = (left + right) // 2
	half = side // 2
	# 발이 칸 바닥에 닿도록 아래로 맞춰 자릅니다. 가운데로 맞추면 붕 떠 보입니다.
	# (사용자 지적, 2026-09-13)
	cropTop = bottom + CROP_PADDING - side
	cropLeft = centerX - half
	croppedArray = np.zeros((side, side, 3), int)
	croppedArray[:, :] = background
	sourceTop = max(0, cropTop)
	sourceLeft = max(0, cropLeft)
	sourceBottom = min(cell.height, cropTop + side)
	sourceRight = min(cell.width, cropLeft + side)
	targetTop = sourceTop - cropTop
	targetLeft = sourceLeft - cropLeft
	croppedArray[targetTop:targetTop + (sourceBottom - sourceTop),
	             targetLeft:targetLeft + (sourceRight - sourceLeft)] = cellArray[sourceTop:sourceBottom, sourceLeft:sourceRight]
	cropped = Image.fromarray(croppedArray.astype(np.uint8))
	# 가장 가까운 점으로 내려 찍습니다. 섞어 내리면 흰 배경이 번져 가짜 밝은 테가 생깁니다.
	small = cropped.resize((CELL_SIZE, CELL_SIZE), Image.NEAREST)
	smallArray = np.asarray(small).astype(int)
	smallDistance = np.sqrt(((smallArray - background) ** 2).sum(axis=2))
	smallLit = smallDistance > BACKGROUND_DISTANCE
	if not smallLit.any():
		continue
	# 속에 난 구멍(눈, 틈)은 배경과 같은 색이라 빠져 있습니다. 그대로 두면 뒤가 비칩니다.
	# 테두리에서 닿지 않는 빈 자리는 담긴 것의 속으로 보고 메웁니다. (사용자 지적, 2026-09-13)
	beforeFilling = smallLit.copy()
	smallLit = fillInsideHoles(smallLit)
	smallLit = fillRowSpans(smallLit)
	# 메우느라 새로 켠 자리입니다. 밑색이 밝든 어둡든 늘 검정으로 찍습니다.
	# (사용자 지적, 2026-09-13, "구멍 막아 달랬는데 당연히 검은색으로 채울 줄 알았는데")
	addedByFilling = smallLit & (~beforeFilling)
	luminance = smallArray[:, :, 0] * 0.299 + smallArray[:, :, 1] * 0.587 + smallArray[:, :, 2] * 0.114
	litLuminance = luminance[smallLit]
	lowest = litLuminance.min()
	highest = litLuminance.max()
	span = max(1.0, highest - lowest)
	normalized = (luminance - lowest) / span
	# 네 단으로 나눕니다. 가장 어두운 단은 윤곽과 속의 검정입니다.
	levels = np.clip((normalized * LEVEL_COUNT).astype(int), 0, LEVEL_COUNT - 1)
	levels[addedByFilling] = 0
	for levelIndex in range(LEVEL_COUNT):
		mask = smallLit & (levels == levelIndex)
		top = levelIndex * CELL_SIZE
		left = spriteIndex * CELL_SIZE
		sheet[top:top + CELL_SIZE, left:left + CELL_SIZE, 0] = 255
		sheet[top:top + CELL_SIZE, left:left + CELL_SIZE, 1] = 255
		sheet[top:top + CELL_SIZE, left:left + CELL_SIZE, 2] = 255
		sheet[top:top + CELL_SIZE, left:left + CELL_SIZE, 3] = np.where(mask, 255, 0).astype(np.uint8)

Image.fromarray(sheet).save(SHEET_PATH, optimize=True)
print("구운 그림:", SHEET_PATH, sheet.shape[1], "×", sheet.shape[0])
print("낱개:", ", ".join(IDS[:spriteCount]))
