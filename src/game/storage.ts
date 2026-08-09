import type { DemandId, EndingId, GameState } from './types'

/**
 * localStorage への保存。
 *
 * 2つに分けている。
 * - SAVE_KEY: 進行中の1周(閉じても続きから遊べる)
 * - ARCHIVE_KEY: 周回をまたいで残る記録(攻略メモ・戦績)
 *
 * reducer は純関数のままにしておきたいので、保存はこの層と useGame だけが担当する。
 * スキーマを変えたら VERSION を上げる。古いデータは黙って捨てる(壊れたセーブで
 * 起動できなくなるのを避けるため)。
 */

const VERSION = 1
const SAVE_KEY = 'kawagame.save.v1'
const ARCHIVE_KEY = 'kawagame.archive.v1'

/** 周回をまたいで残る記録 */
export interface Archive {
  version: number
  /** 遊び終えた回数 */
  runs: number
  /** エンディングごとの到達回数 */
  endings: Partial<Record<EndingId, number>>
  /** これまでの最高ごきげん */
  bestMood: number
  /**
   * 攻略メモ。「この言い方は実際どの要求だったか」の回数。
   * 周回するほど読みの精度が上がる = 続ける動機になる。
   */
  lines: Record<string, Partial<Record<DemandId, number>>>
}

export const emptyArchive = (): Archive => ({
  version: VERSION,
  runs: 0,
  endings: {},
  bestMood: 0,
  lines: {},
})

/** localStorage が使えない環境(プライベートモード等)でも落ちないようにする */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 容量超過や無効化。保存できなくても遊べるので黙って諦める */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 同上 */
  }
}

export function loadGame(): GameState | null {
  const raw = safeGet(SAVE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { version: number; state: GameState }
    if (parsed.version !== VERSION) return null
    // 最低限の健全性チェック。壊れていたら新規で始める
    if (typeof parsed.state?.day !== 'number' || typeof parsed.state?.mood !== 'number') return null
    return parsed.state
  } catch {
    return null
  }
}

export function saveGame(state: GameState): void {
  safeSet(SAVE_KEY, JSON.stringify({ version: VERSION, state }))
}

export function clearGame(): void {
  safeRemove(SAVE_KEY)
}

export function loadArchive(): Archive {
  const raw = safeGet(ARCHIVE_KEY)
  if (!raw) return emptyArchive()
  try {
    const parsed = JSON.parse(raw) as Archive
    if (parsed.version !== VERSION) return emptyArchive()
    return { ...emptyArchive(), ...parsed }
  } catch {
    return emptyArchive()
  }
}

/** 1周終わったときに記録を積む */
export function mergeArchive(archive: Archive, state: GameState): Archive {
  const lines: Archive['lines'] = { ...archive.lines }
  for (const { said, demand } of state.revealedLines) {
    const row = { ...(lines[said] ?? {}) }
    row[demand] = (row[demand] ?? 0) + 1
    lines[said] = row
  }

  const endings = { ...archive.endings }
  if (state.ending) endings[state.ending] = (endings[state.ending] ?? 0) + 1

  const next: Archive = {
    version: VERSION,
    runs: archive.runs + 1,
    endings,
    bestMood: Math.max(archive.bestMood, state.mood),
    lines,
  }
  safeSet(ARCHIVE_KEY, JSON.stringify(next))
  return next
}

export function clearArchive(): void {
  safeRemove(ARCHIVE_KEY)
}
