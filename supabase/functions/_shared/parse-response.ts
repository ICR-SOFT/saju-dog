/**
 * Claude API 응답에서 JSON 파싱
 * Claude가 ```json 블록으로 감쌀 수 있으므로 이를 처리
 */
export function parseClaudeResponse(text: string): any {
  // JSON 블록 추출 시도
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    // 첫 번째 { 부터 마지막 } 까지 추출 시도
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(jsonStr.slice(start, end + 1));
    }
    throw new Error('Claude 응답에서 JSON을 파싱할 수 없습니다');
  }
}
