// USD per million tokens (input, output). Used for per-user metering only; update when prices change.
export const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "gemini-2.5-flash": [0.3, 2.5],
  "gemini-2.5-pro": [1.25, 10],
};
export function costMicroUsd(model: string, input: number, output: number): number {
  const [i, o] = PRICES[model] || [2, 10];
  return Math.round(input * i + output * o); // tokens * $/MTok == micro-dollars
}
