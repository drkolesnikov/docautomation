export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}
