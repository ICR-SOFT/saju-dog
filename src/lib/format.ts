const HOUR_NAMES: Record<number, string> = {
  0:'자',1:'자',2:'축',3:'축',4:'인',5:'인',6:'묘',7:'묘',8:'진',9:'진',10:'사',11:'사',
  12:'오',13:'오',14:'미',15:'미',16:'신',17:'신',18:'유',19:'유',20:'술',21:'술',22:'해',23:'해',
};

export function formatBirthDate(dateStr: string) {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  const h = d.getHours();
  const m = d.getMinutes();
  return `${date} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}(${HOUR_NAMES[h] || ''}시)`;
}
