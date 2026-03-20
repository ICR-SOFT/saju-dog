/**
 * 띠 동물 → 이미지 매핑
 * /public/images/zodiac/{animal}.png
 */

const ANIMAL_TO_FILE: Record<string, string> = {
  '쥐': 'rat',
  '소': 'ox',
  '호랑이': 'tiger',
  '토끼': 'rabbit',
  '용': 'dragon',
  '뱀': 'snake',
  '말': 'horse',
  '양': 'sheep',
  '원숭이': 'monkey',
  '닭': 'rooster',
  '개': 'dog',
  '돼지': 'pig',
};

export function getZodiacImageUrl(animal: string): string {
  const file = ANIMAL_TO_FILE[animal];
  if (!file) return '/images/comprehensive.png'; // fallback
  return `/images/zodiac/${file}.png`;
}

export function getCompatibilityImageUrl(): string {
  return '/images/zodiac/compatibility.png';
}
