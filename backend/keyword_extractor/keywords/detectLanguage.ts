export function detectLanguage(text: string): "ko" | "en" {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text) ? "ko" : "en";
}