/**
 * Pixel Art Service Icons - SVG based
 * 16x16 pixel grid rendered at any size
 */

interface IconProps {
  size?: number;
  className?: string;
}

function PixelGrid({ pixels, colors, size = 32, className }: { pixels: number[][]; colors: Record<number, string>; size?: number; className?: string }) {
  const grid = 16;
  const cell = size / grid;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} style={{ imageRendering: 'pixelated' }}>
      {pixels.map((row, y) =>
        row.map((c, x) =>
          c > 0 ? <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={colors[c]} /> : null
        )
      )}
    </svg>
  );
}

// Color palettes
const C = {
  black: '#1A1A1A',
  brown: '#D4763C',
  brownLight: '#E8A849',
  brownDark: '#A05A28',
  white: '#FFFFFF',
  cream: '#FFF3E8',
  pink: '#FF6B8A',
  red: '#F44336',
  blue: '#2196F3',
  green: '#4CAF50',
  purple: '#9C27B0',
  gold: '#FFD700',
  teal: '#009688',
  orange: '#FF9800',
  indigo: '#3F51B5',
  cyan: '#00BCD4',
  amber: '#FFC107',
  gray: '#9E9E9E',
  skin: '#FFCC80',
};

// 🔮 종합 사주 - Crystal ball
export function IconComprehensive({ size = 32, className }: IconProps) {
  const p = [
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,5,5,5,5,1,1,0,0,0,0],
    [0,0,0,1,5,5,6,5,5,5,5,5,1,0,0,0],
    [0,0,1,5,6,6,5,5,5,5,5,5,5,1,0,0],
    [0,1,5,6,5,5,5,5,5,5,5,5,5,5,1,0],
    [0,1,5,5,5,5,2,5,5,2,5,5,5,5,1,0],
    [0,1,5,5,5,2,2,2,2,2,2,5,5,5,1,0],
    [0,1,5,5,5,5,2,5,5,2,5,5,5,5,1,0],
    [0,1,5,5,5,5,5,5,5,5,5,5,5,5,1,0],
    [0,0,1,5,5,5,5,5,5,5,5,5,5,1,0,0],
    [0,0,0,1,5,5,5,5,5,5,5,5,1,0,0,0],
    [0,0,0,0,1,1,5,5,5,5,1,1,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];
  return <PixelGrid pixels={p} colors={{ 1: C.black, 2: C.purple, 5: '#E0D0FF', 6: '#FFFFFF' }} size={size} className={className} />;
}

// 💕 궁합 - Two hearts
export function IconCompatibility({ size = 32, className }: IconProps) {
  const p = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,2,2,0,2,2,0,0,2,2,0,2,2,0,0],
    [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
    [0,2,2,3,2,2,2,2,2,2,3,2,2,2,2,0],
    [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
    [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
    [0,0,0,2,2,2,2,2,2,2,2,2,2,0,0,0],
    [0,0,0,0,2,2,2,2,2,2,2,2,0,0,0,0],
    [0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0],
    [0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];
  return <PixelGrid pixels={p} colors={{ 2: C.pink, 3: '#FFFFFF' }} size={size} className={className} />;
}

// Simple colored square icons for services
function SimpleIcon({ color, symbol, size = 32, className }: { color: string; symbol: string; size?: number; className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center border-2 border-[var(--pixel-border)] ${className || ''}`}
      style={{ width: size, height: size, backgroundColor: color, imageRendering: 'pixelated' }}
    >
      <span className="font-pixel" style={{ fontSize: size * 0.4, lineHeight: 1 }}>{symbol}</span>
    </div>
  );
}

// Service icon map
const SERVICE_ICON_MAP: Record<string, { color: string; symbol: string }> = {
  comprehensive: { color: '#E0D0FF', symbol: '占' },
  compatibility: { color: '#FFE0EB', symbol: '♥' },
  daeun: { color: '#E0F0FF', symbol: '運' },
  yearly: { color: '#E8E0FF', symbol: '年' },
  daily: { color: '#FFF3E0', symbol: '日' },
  love: { color: '#FFE0E8', symbol: '愛' },
  wealth: { color: '#FFF8E0', symbol: '財' },
  health: { color: '#E8F5E9', symbol: '健' },
  career: { color: '#E3F2FD', symbol: '職' },
  business: { color: '#E8EAF6', symbol: '業' },
  luckyday: { color: '#FFFDE7', symbol: '吉' },
  pastlife: { color: '#F3E5F5', symbol: '前' },
  moving: { color: '#EFEBE9', symbol: '移' },
  mbti: { color: '#FCE4EC', symbol: 'MB' },
  pet: { color: '#FFF3E0', symbol: '🐾' },
  travel: { color: '#E0F7FA', symbol: '旅' },
  food: { color: '#FBE9E7', symbol: '食' },
  color: { color: '#F3E5F5', symbol: '色' },
  study: { color: '#E3F2FD', symbol: '學' },
  ancestor: { color: '#FFF8E1', symbol: '祖' },
  child: { color: '#FCE4EC', symbol: '子' },
  secret: { color: '#EDE7F6', symbol: '秘' },
  timing: { color: '#FFF9C4', symbol: '時' },
  chat: { color: '#E8F5E9', symbol: '談' },
};

export function ServiceIcon({ type, size = 32, className }: { type: string; size?: number; className?: string }) {
  const config = SERVICE_ICON_MAP[type];
  if (!config) return <SimpleIcon color="#F5F5F5" symbol="?" size={size} className={className} />;
  return <SimpleIcon color={config.color} symbol={config.symbol} size={size} className={className} />;
}

// Dog mascot pixel art (simplified)
export function MascotIcon({ size = 64, className }: IconProps) {
  const p = [
    [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
    [0,0,1,3,3,1,0,0,0,0,1,3,3,1,0,0],
    [0,1,3,3,3,3,1,1,1,1,3,3,3,3,1,0],
    [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
    [1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1],
    [1,3,3,1,1,3,3,3,3,3,3,1,1,3,3,1],
    [1,3,3,1,1,3,3,3,3,3,3,1,1,3,3,1],
    [1,3,3,3,3,3,3,1,1,3,3,3,3,3,3,1],
    [1,3,3,3,3,3,1,3,3,1,3,3,3,3,3,1],
    [0,1,3,3,3,3,3,1,1,3,3,3,3,3,1,0],
    [0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0],
    [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
    [0,0,0,0,1,1,3,3,3,3,1,1,0,0,0,0],
    [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
    [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  ];
  return <PixelGrid pixels={p} colors={{ 1: C.black, 3: C.brownLight }} size={size} className={className} />;
}
