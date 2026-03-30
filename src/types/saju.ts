// ===== 사주 기본 상수 & 타입 =====

export const STEMS = ['갑','을','병','정','무','기','경','신','임','계'] as const;
export type Stem = typeof STEMS[number];

export const BRANCHES = ['자','축','인','묘','진','사','오','미','신','유','술','해'] as const;
export type Branch = typeof BRANCHES[number];

export const OHAENG = ['목','화','토','금','수'] as const;
export type Ohaeng = typeof OHAENG[number];

export type YinYang = '양' | '음';

export const SIPSIN = ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'] as const;
export type Sipsin = typeof SIPSIN[number];

export const TWELVE_STAGES = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'] as const;
export type TwelveStage = typeof TWELVE_STAGES[number];

export type Gender = 'male' | 'female';
export type CalendarType = 'solar' | 'lunar' | 'lunar_leap';

// ===== 입력 =====

export interface SajuInput {
  name: string;
  birthDate: Date;
  gender: Gender;
  calendarType: CalendarType;
  useTrueSolar: boolean;
  longitude?: number;
  birthCity?: string;
}

// ===== 기둥 (Pillar) =====

export interface JijangganEntry {
  stem: Stem;
  sipsin: Sipsin;
  type: '여기' | '중기' | '정기';
}

export interface Pillar {
  stem: Stem;
  branch: Branch;
  stemIndex: number;
  branchIndex: number;
  stemHanja: string;
  branchHanja: string;
  stemOhaeng: Ohaeng;
  branchOhaeng: Ohaeng;
  stemYinYang: YinYang;
  stemSipsin: Sipsin | '일주';
  branchSipsin: Sipsin;
  twelveStage: TwelveStage;
  jijanggan: JijangganEntry[];
}

// ===== 오행 카운트 =====

export interface OhaengCount {
  목: number;
  화: number;
  토: number;
  금: number;
  수: number;
}

// ===== 대운 =====

export interface DaeunEntry {
  stem: Stem;
  branch: Branch;
  stemHanja: string;
  branchHanja: string;
  startAge: number;
  endAge: number;
  stemSipsin: Sipsin;
  branchSipsin: Sipsin;
  isCurrent: boolean;
}

// ===== 특수 관계 (충/합/형 등) =====

export interface SpecialFormation {
  type: '충' | '합' | '형' | '파' | '해' | '원진' | '방합' | '삼합' | '반합';
  pillars: string[];
  characters: string[];
  description: string;
}

// ===== 사주팔자 결과 =====

// ===== 신살 =====

export interface SinsalInfo {
  pillarSinsal: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };
  pillarRelations: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };
  allSinsal: string[];
  gongmang: Branch[];
  guiin: string[];
}

// ===== 띠 + 별자리 =====

export interface DdiInfo {
  animal: string;
  color: string;
  fullName: string;
}

export interface ZodiacInfo {
  name: string;
  emoji: string;
}

// ===== 사주팔자 결과 =====

export interface SajuPillars {
  input: SajuInput;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
  };
  ohaengCount: OhaengCount;
  daeun: DaeunEntry[];
  currentDaeun: DaeunEntry | null;
  currentYear: {
    year: number;
    stem: Stem;
    branch: Branch;
    stemSipsin: Sipsin;
    branchSipsin: Sipsin;
  };
  specialFormations: SpecialFormation[];
  sinsal: SinsalInfo;
  ddi: DdiInfo;
  zodiac: ZodiacInfo;
}

// ===== 서비스 타입 =====

export type ServiceType = 'comprehensive' | 'compatibility' | 'daeun' | 'yearly' | 'daily' | 'chat'
  | 'business' | 'luckyday' | 'love' | 'wealth' | 'health' | 'career' | 'pastlife' | 'moving'
  | 'mbti' | 'pet' | 'travel' | 'food' | 'color' | 'study' | 'ancestor' | 'child' | 'secret' | 'timing';

// ===== API 응답 =====

export interface SajuChapter {
  id: string;
  title: string;
  emoji: string;
  content: string;
}

export interface SajuApiResponse {
  serviceType: ServiceType;
  summary: string;
  chapters: SajuChapter[];
  advice: string[];
  overallScore?: number;
  luckyItems?: {
    color: string;
    number: string;
    direction: string;
    food: string;
  };
}

// ===== DB 프롬프트 설정 =====

export interface PromptConfig {
  id: string;
  service_type: ServiceType;
  model: string;
  max_tokens: number;
  temperature: number | null;
  use_thinking: boolean;
  thinking_type: string | null;
  system_prompt: string;
  use_prompt_caching: boolean;
  version: string;
  is_active: boolean;
  description: string | null;
}
