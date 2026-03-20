/**
 * 띠 + 별자리 → 이미지 매핑
 *
 * 1순위: /images/zodiac/ganji/{stem}{branch}_{zodiac}.png (60갑자×12별자리 = 720개)
 * 2순위: /images/zodiac/{animal}.png (12띠 기본)
 * fallback: /images/comprehensive.png
 */

const ANIMAL_TO_FILE: Record<string, string> = {
  '쥐': 'rat', '소': 'ox', '호랑이': 'tiger', '토끼': 'rabbit',
  '용': 'dragon', '뱀': 'snake', '말': 'horse', '양': 'sheep',
  '원숭이': 'monkey', '닭': 'rooster', '개': 'dog', '돼지': 'pig',
};

const ZODIAC_TO_FILE: Record<string, string> = {
  '양자리': 'aries', '황소자리': 'taurus', '쌍둥이자리': 'gemini',
  '게자리': 'cancer', '사자자리': 'leo', '처녀자리': 'virgo',
  '천칭자리': 'libra', '전갈자리': 'scorpio', '궁수자리': 'sagittarius',
  '염소자리': 'capricorn', '물병자리': 'aquarius', '물고기자리': 'pisces',
};

/**
 * 갑자(천간+지지) + 별자리에 맞는 이미지 URL 반환
 * @param animal - 띠 동물 ("호랑이", "쥐" 등)
 * @param stem - 천간 ("갑", "을" 등) — optional, 갑자 이미지용
 * @param branch - 지지 ("자", "축" 등) — optional, 갑자 이미지용
 * @param zodiacName - 별자리 ("천칭자리" 등) — optional, 갑자 이미지용
 */
export function getZodiacImageUrl(
  animal: string,
  stem?: string,
  branch?: string,
  zodiacName?: string,
): string {
  // 1순위: 갑자+별자리 개별 이미지
  if (stem && branch && zodiacName) {
    const zodiacFile = ZODIAC_TO_FILE[zodiacName];
    if (zodiacFile) {
      const ganjiPath = `/images/zodiac/ganji/${stem}${branch}_${zodiacFile}.png`;
      return ganjiPath;
    }
  }

  // 2순위: 띠 기본 이미지
  const file = ANIMAL_TO_FILE[animal];
  if (file) return `/images/zodiac/${file}.png`;

  return '/images/comprehensive.png';
}

/** 갑자 이미지 실패 시 띠 기본 이미지로 fallback */
export function getZodiacFallbackUrl(animal: string): string {
  const file = ANIMAL_TO_FILE[animal];
  return file ? `/images/zodiac/${file}.png` : '/images/comprehensive.png';
}

export function getCompatibilityImageUrl(): string {
  return '/images/zodiac/compatibility.png';
}
