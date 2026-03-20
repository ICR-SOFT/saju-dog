#!/bin/bash
# 60갑자 × 12별자리 = 720개 이미지 생성
# 실행: bash scripts/generate-zodiac-images.sh

OUTPUT_DIR="public/images/zodiac/ganji"
mkdir -p "$OUTPUT_DIR"

# 천간 (10)
STEMS=("갑" "을" "병" "정" "무" "기" "경" "신" "임" "계")
STEM_COLORS=("blue-green" "blue-green" "red-crimson" "red-crimson" "golden-yellow" "golden-yellow" "white-silver" "white-silver" "black-indigo" "black-indigo")
STEM_PALETTES=(
  "emerald green and teal blue tones"
  "jade green and cyan blue tones"
  "fiery red and crimson tones"
  "warm red and orange tones"
  "rich golden yellow and amber tones"
  "warm ochre yellow and brown tones"
  "pure white and silver metallic tones"
  "pearl white and platinum tones"
  "deep black and midnight indigo tones"
  "dark navy and deep purple tones"
)

# 지지 (12)
BRANCHES=("자" "축" "인" "묘" "진" "사" "오" "미" "신" "유" "술" "해")
ANIMALS=("rat" "ox" "tiger" "rabbit" "dragon" "snake" "horse" "sheep" "monkey" "rooster" "dog" "wild-boar")
ANIMAL_DESCS=(
  "a mystical ornate rat with jeweled eyes"
  "a majestic ornate ox with powerful horns"
  "a fierce ornate tiger with striking stripes"
  "a graceful ornate rabbit among flowers"
  "a magnificent ornate eastern dragon coiling"
  "a mystical ornate snake with scaled patterns"
  "a galloping ornate horse with flowing mane"
  "a serene ornate sheep with curled horns"
  "a clever ornate monkey with expressive face"
  "a proud ornate rooster with elaborate feathers"
  "a loyal ornate dog guardian with noble stance"
  "a noble ornate wild boar with jeweled tusks"
)

# 별자리 (12)
ZODIACS=("aries" "taurus" "gemini" "cancer" "leo" "virgo" "libra" "scorpio" "sagittarius" "capricorn" "aquarius" "pisces")
ZODIAC_ELEMENTS=(
  "ram horns constellation and fire sparks"
  "bull constellation and earth crystals"
  "twin stars constellation and air wisps"
  "crab constellation and water waves"
  "lion constellation and solar flares"
  "maiden constellation and wheat stalks"
  "scales constellation and balanced light"
  "scorpion constellation and dark nebula"
  "archer constellation and shooting stars"
  "sea-goat constellation and mountain peaks"
  "water-bearer constellation and flowing cosmic water"
  "fish constellation and ocean depths"
)

STYLE="Mystical Japanese ukiyo-e pointillism style illustration, intricate ornate patterns on the body, cosmic night sky background with stars, no text, square 512x512"

TOTAL=$((60 * 12))
COUNT=0
FAILED=0

echo "=== 720개 갑자×별자리 이미지 생성 시작 ==="
echo "출력: $OUTPUT_DIR/{stem}{branch}_{zodiac}.png"

for si in $(seq 0 9); do
  for bi in $(seq 0 11); do
    # 60갑자 체크: (si + bi) 가 짝수일 때만 유효 (양간+양지, 음간+음지)
    if (( (si + bi) % 2 != 0 )); then
      continue
    fi

    STEM=${STEMS[$si]}
    BRANCH=${BRANCHES[$bi]}
    COLOR_PALETTE=${STEM_PALETTES[$si]}
    ANIMAL_DESC=${ANIMAL_DESCS[$bi]}

    for zi in $(seq 0 11); do
      ZODIAC=${ZODIACS[$zi]}
      ZODIAC_EL=${ZODIAC_ELEMENTS[$zi]}

      FILENAME="${STEM}${BRANCH}_${ZODIAC}.png"
      FILEPATH="${OUTPUT_DIR}/${FILENAME}"

      # 이미 있으면 스킵
      if [ -f "$FILEPATH" ]; then
        continue
      fi

      COUNT=$((COUNT + 1))
      PROMPT="${ANIMAL_DESC}, ${COLOR_PALETTE}, with ${ZODIAC_EL} in the background sky, ${STYLE}"

      echo "[${COUNT}/${TOTAL}] ${STEM}${BRANCH} × ${ZODIAC}..."
      bash ~/.claude/scripts/gemini-image-gen.sh "$FILEPATH" "$PROMPT" 2>&1 | tail -1

      if [ ! -f "$FILEPATH" ]; then
        FAILED=$((FAILED + 1))
        echo "  ⚠️ FAILED: ${FILENAME}"
      fi

      # Rate limit 방지
      sleep 1
    done
  done
done

echo ""
echo "=== 완료 ==="
echo "생성: $COUNT / 실패: $FAILED"
echo "폴더: $OUTPUT_DIR"
