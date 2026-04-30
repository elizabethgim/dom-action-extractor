export function extractNumbers(text: string) {
  const nums = [];
  const re = /\b\d+(\.\d+)?\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    nums.push({ text: m[0], value: Number(m[0]) });
  }
  return nums;
}