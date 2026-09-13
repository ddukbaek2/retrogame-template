#==============================================================================
# 따로 받은 낱개 그림을 구워 시트에 넣습니다.
#
#   python tools/bake-single.py
#
# 한 장짜리 시트(`tools/generate-sprites.mjs` 로 받은 4 × 4)에서 알아보기 어려운 것은 따로
# 크게 받아 그 칸만 갈아 끼웁니다. 시트에 없는 이름이면 뒤에 한 칸 붙이고 차례 표에도 적습니다.
# (사용자 지시, 2026-09-11)
#
# 굽는 방법은 `tools/bake-sprites.py` 와 같습니다. 밝기를 네 단으로 나누어 마스크 넉 장을
# 만듭니다. 다른 낱개는 건드리지 않습니다.
#
# 주의: `tools/bake-sprites.py` 를 다시 돌리면 시트를 통째로 다시 굽습니다. 그때는 이 도구도
# 다시 돌려야 따로 받은 낱개가 살아납니다.
#==============================================================================
import io
import json
import os

from PIL import Image
import numpy as np

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SHEET_PATH = "assets/sprites/wire3d.png"
INDEX_PATH = "assets/sprites/wire3d.json"

# 따로 받은 낱개들. (받은 그림 → 시트의 낱개 이름)
SINGLES = [
	{"raw": ".assets-raw/wire3d-chest-raw.png", "id": "chest"},
	{"raw": ".assets-raw/wire3d-sign-raw.png", "id": "sign"},
	{"raw": ".assets-raw/wire3d-shop-raw.png", "id": "shop"},
	{"raw": ".assets-raw/wire3d-stairs-raw.png", "id": "stairs"},
	{"raw": ".assets-raw/wire3d-merchantItem-raw.png", "id": "merchantItem"},
	{"raw": ".assets-raw/wire3d-merchantSkill-raw.png", "id": "merchantSkill"},
	{"raw": ".assets-raw/wire3d-merchantGear-raw.png", "id": "merchantGear"},
	{"raw": ".assets-raw/wire3d-merchantBlack-raw.png", "id": "merchantBlack"},
	{"raw": ".assets-raw/wire3d-merchantTrinket-raw.png", "id": "merchantTrinket"},
	{"raw": ".assets-raw/wire3d-storage-raw.png", "id": "storage"},
	{"raw": ".assets-raw/wire3d-elder-raw.png", "id": "elder"},
	{"raw": ".assets-raw/wire3d-warden-raw.png", "id": "warden"},
]

# 배경으로 볼 거리. (배경 색과 이만큼 떨어져 있으면 담긴 것입니다)
BACKGROUND_DISTANCE = 36
# 담긴 것 둘레에 두는 여백. (내려 찍기 전 원본 자로 잰 값)
CROP_PADDING = 6
# 윤곽으로 볼 밝기. (이보다 어두우면 0 단입니다)
DARK_LUMINANCE = 0
DARK_RATIO = 0.28

index = json.load(io.open(INDEX_PATH, encoding="utf-8"))
CELL_SIZE = index["cellSize"]
LEVEL_COUNT = index["levelCount"]
ids = index["ids"]

sheet = np.asarray(Image.open(SHEET_PATH).convert("RGBA")).copy()
if sheet.shape[0] != CELL_SIZE * LEVEL_COUNT:
	raise SystemExit("시트의 칸 크기가 차례 표와 다릅니다. tools/bake-sprites.py 를 먼저 돌리십시오.")
# 시트가 차례 표보다 좁으면 (통째로 다시 구운 뒤입니다) 뒤를 비워 넓힙니다.
if sheet.shape[1] < CELL_SIZE * len(ids):
	widened = np.zeros((sheet.shape[0], CELL_SIZE * len(ids), 4), np.uint8)
	widened[:, :sheet.shape[1]] = sheet
	sheet = widened


def fillInsideHoles(litMask):
	# 테두리에서 시작해 빈 자리를 타고 들어갑니다. 닿지 못한 빈 자리는 속이라 검게 채웁니다.
	# (사용자 지시, 2026-09-13, "안쪽은 투명하지 않게 검은색으로 채우는게 좋겠어")
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


def readBakedLevels(rawPath):
	# 가장 많이 나온 색을 배경으로 보고, 담긴 것을 네모로 잘라 32 × 32 로 내려 찍습니다.
	source = Image.open(rawPath).convert("RGB")
	sourceArray = np.asarray(source).astype(int)
	quantized = (sourceArray // 16).reshape(-1, 3)
	keys = quantized[:, 0] * 4096 + quantized[:, 1] * 64 + quantized[:, 2]
	values, counts = np.unique(keys, return_counts=True)
	topKey = values[counts.argmax()]
	background = np.array([(topKey // 4096) * 16 + 8, ((topKey // 64) % 64) * 16 + 8, (topKey % 64) * 16 + 8])

	distance = np.sqrt(((sourceArray - background) ** 2).sum(axis=2))
	lit = distance > BACKGROUND_DISTANCE
	if not lit.any():
		raise SystemExit(rawPath + ": 그림에서 담긴 것을 찾지 못했습니다.")

	ys, xs = np.where(lit)
	top, bottom = ys.min(), ys.max() + 1
	left, right = xs.min(), xs.max() + 1
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
	sourceBottom = min(source.height, cropTop + side)
	sourceRight = min(source.width, cropLeft + side)
	targetTop = sourceTop - cropTop
	targetLeft = sourceLeft - cropLeft
	croppedArray[targetTop:targetTop + (sourceBottom - sourceTop),
	             targetLeft:targetLeft + (sourceRight - sourceLeft)] = sourceArray[sourceTop:sourceBottom, sourceLeft:sourceRight]
	cropped = Image.fromarray(croppedArray.astype(np.uint8))

	# 담긴 자리를 먼저 가리고, 그 안의 색만 넓이로 고르게 섞어 내려 찍습니다.
	# 점 하나만 집어 내리면(NEAREST) 잔무늬가 얼룩으로 남아 무엇인지 알아보기 어렵습니다.
	# (사용자 지적, 2026-09-13, "너무 줄어들어서 제대로 표현이 잘 안되고 있는데")
	croppedDistance = np.sqrt(((croppedArray - background) ** 2).sum(axis=2))
	croppedLit = croppedDistance > BACKGROUND_DISTANCE
	litImage = Image.fromarray(np.where(croppedLit, 255, 0).astype(np.uint8))
	smallLitRatio = np.asarray(litImage.resize((CELL_SIZE, CELL_SIZE), Image.BOX)).astype(int)
	smallLit = smallLitRatio >= 128
	# 배경 색이 섞이지 않게 담긴 자리의 색만 가지고 섞어 내립니다.
	filled = croppedArray.copy()
	litValues = croppedArray[croppedLit]
	meanColor = litValues.mean(axis=0) if litValues.size > 0 else background
	filled[~croppedLit] = meanColor
	small = Image.fromarray(filled.astype(np.uint8)).resize((CELL_SIZE, CELL_SIZE), Image.BOX)
	smallArray = np.asarray(small).astype(int)
	beforeFilling = smallLit.copy()
	smallLit = fillInsideHoles(smallLit)
	smallLit = fillRowSpans(smallLit)
	# 메우느라 새로 켠 자리입니다. 밑색이 밝든 어둡든 늘 검정으로 찍습니다.
	# 여기를 막는 까닭이 뒤가 비치지 않게 하려는 것뿐이라 밝기를 물려받으면 안 됩니다.
	# (사용자 지적, 2026-09-13, "구멍 막아 달랬는데 당연히 검은색으로 채울 줄 알았는데")
	addedByFilling = smallLit & (~beforeFilling)
	luminance = smallArray[:, :, 0] * 0.299 + smallArray[:, :, 1] * 0.587 + smallArray[:, :, 2] * 0.114
	litLuminance = luminance[smallLit]
	lowest = litLuminance.min()
	highest = litLuminance.max()
	span = max(1.0, highest - lowest)
	# 0 단은 윤곽과 속의 검정입니다. 어두운 쪽만 잘라 냅니다.
	darkLimit = max(DARK_LUMINANCE, lowest + span * DARK_RATIO)
	isDark = luminance < darkLimit
	levels = np.zeros(luminance.shape, int)
	brightMask = smallLit & (~isDark)
	brightValues = luminance[brightMask]
	if brightValues.size > 0:
		# 남은 것을 밝기 차례로 세 몫에 고르게 나눕니다. 밑색이 한쪽에 몰려도 밝게 나옵니다.
		lowCut = np.percentile(brightValues, 100.0 / 3.0)
		highCut = np.percentile(brightValues, 200.0 / 3.0)
		levels[brightMask & (luminance <= lowCut)] = 1
		levels[brightMask & (luminance > lowCut) & (luminance <= highCut)] = 2
		levels[brightMask & (luminance > highCut)] = 3
	levels[addedByFilling] = 0
	return smallLit, levels


for single in SINGLES:
	spriteId = single["id"]
	if spriteId not in ids:
		# 새 낱개는 시트 뒤에 한 칸 붙입니다.
		ids.append(spriteId)
		widened = np.zeros((sheet.shape[0], sheet.shape[1] + CELL_SIZE, 4), np.uint8)
		widened[:, :sheet.shape[1]] = sheet
		sheet = widened
		print("칸을 붙였습니다:", spriteId)
	spriteIndex = ids.index(spriteId)
	smallLit, levels = readBakedLevels(single["raw"])
	for levelIndex in range(LEVEL_COUNT):
		mask = smallLit & (levels == levelIndex)
		cellTop = levelIndex * CELL_SIZE
		cellLeft = spriteIndex * CELL_SIZE
		sheet[cellTop:cellTop + CELL_SIZE, cellLeft:cellLeft + CELL_SIZE, 0] = 255
		sheet[cellTop:cellTop + CELL_SIZE, cellLeft:cellLeft + CELL_SIZE, 1] = 255
		sheet[cellTop:cellTop + CELL_SIZE, cellLeft:cellLeft + CELL_SIZE, 2] = 255
		sheet[cellTop:cellTop + CELL_SIZE, cellLeft:cellLeft + CELL_SIZE, 3] = np.where(mask, 255, 0).astype(np.uint8)
	print("구웠습니다:", spriteId, "(", spriteIndex, ")")

Image.fromarray(sheet).save(SHEET_PATH, optimize=True)
index["ids"] = ids
io.open(INDEX_PATH, "w", encoding="utf-8").write(json.dumps(index, ensure_ascii=False, indent="\t") + "\n")
print("시트:", SHEET_PATH, sheet.shape[1], "×", sheet.shape[0])
print("낱개:", ", ".join(ids))
