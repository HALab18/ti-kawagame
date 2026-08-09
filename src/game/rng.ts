/**
 * 種を state に持たせるための純粋な擬似乱数(mulberry32)。
 * Math.random を使わないので、同じ state + 同じ操作列なら必ず同じ結果になる。
 * ローカルストレージが使えない前提のため、state をそのまま JSON にして
 * 手動セーブ/リプレイに回せることを優先した。
 */
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0
  let x = t
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  const value = ((x ^ (x >>> 14)) >>> 0) / 4294967296
  return { value, seed: t }
}

/** 確率 p で true を返す */
export function roll(seed: number, p: number): { hit: boolean; seed: number } {
  const r = nextRandom(seed)
  return { hit: r.value < p, seed: r.seed }
}
