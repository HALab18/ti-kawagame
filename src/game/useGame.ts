import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { GRACE_DAYS, PARTNER_IDS } from './config'
import { createInitialState, gameReducer, successRate } from './reducer'
import { moodLabel, partnerView, warnings } from './selectors'
import {
  clearArchive,
  clearGame,
  loadArchive,
  loadGame,
  mergeArchive,
  saveGame,
  type Archive,
} from './storage'
import type { DemandId, EmotionId, GameState, PartnerId, RewardId } from './types'

/**
 * React 側の入口。state はここに閉じ込め、UI は view と操作関数だけを触る。
 * 保存もこの層だけが担当する(reducer は純関数のまま)。
 */
export function useGame(seed = 1) {
  // 中断したセーブがあれば、そこから再開する
  const [state, dispatch] = useReducer(
    gameReducer,
    seed,
    (s) => loadGame() ?? createInitialState(s),
  )
  const [archive, setArchive] = useState<Archive>(() => loadArchive())

  // 1手ごとに自動保存。おわりまで行ったセーブは残さない(次回は新規で始まる)
  useEffect(() => {
    if (state.phase === 'ending') clearGame()
    else saveGame(state)
  }, [state])

  // 1周ぶんの記録を積む。同じ ending で二重に数えないよう1回だけ
  const archived = useRef(false)
  useEffect(() => {
    if (state.phase === 'ending' && !archived.current) {
      archived.current = true
      setArchive((prev) => mergeArchive(prev, state))
    }
    if (state.phase !== 'ending') archived.current = false
  }, [state])

  const partners = useMemo(
    () => PARTNER_IDS.map((id) => partnerView(state, id, GRACE_DAYS)),
    [state],
  )

  const actions = useMemo(
    () => ({
      equip: (emotions: EmotionId[]) => dispatch({ type: 'equip', emotions }),
      work: () => dispatch({ type: 'work' }),
      meet: (partner: PartnerId) => dispatch({ type: 'meet', partner }),
      advance: () => dispatch({ type: 'advance' }),
      rest: () => dispatch({ type: 'rest' }),
      gift: (partner: PartnerId) => dispatch({ type: 'gift', partner }),
      giveSweets: () => dispatch({ type: 'giveSweets' }),
      showKeepsake: (keepsakeId: string) => dispatch({ type: 'showKeepsake', keepsakeId }),
      whisper: () => dispatch({ type: 'whisper' }),
      pisuTalk: () => dispatch({ type: 'pisuTalk' }),
      gacha: () => dispatch({ type: 'gacha' }),
      chooseReward: (reward: RewardId) => dispatch({ type: 'chooseReward', reward }),
      sleep: () => dispatch({ type: 'sleep' }),
      reset: (nextSeed?: number) => {
        clearGame()
        dispatch({ type: 'reset', seed: nextSeed })
      },
    }),
    [],
  )

  /** 攻略メモも含めて全部消す */
  const wipe = useCallback(() => {
    clearGame()
    clearArchive()
    setArchive(loadArchive())
    dispatch({ type: 'reset', seed: Date.now() % 100000 })
  }, [])

  /**
   * 今朝のセリフについて、過去の周回で実際どの要求だったか。
   * 「前はこうだった」が分かるだけで、周回ごとに読みの精度が上がる。
   */
  const lineMemo = useMemo((): Array<{ demand: DemandId; count: number }> => {
    const row = archive.lines[state.demandSaid]
    if (!row) return []
    return (Object.entries(row) as Array<[DemandId, number]>)
      .map(([demand, count]) => ({ demand, count }))
      .sort((a, b) => b.count - a.count)
  }, [archive, state.demandSaid])

  /** おわりの振り返り: 何でごきげんが動いたかの集計 */
  const moodBreakdown = useMemo(() => {
    const sums = new Map<string, { total: number; times: number }>()
    for (const entry of state.moodLog) {
      const cur = sums.get(entry.reason) ?? { total: 0, times: 0 }
      sums.set(entry.reason, { total: cur.total + entry.delta, times: cur.times + 1 })
    }
    const rows = [...sums.entries()].map(([reason, v]) => ({ reason, ...v }))
    return {
      losses: rows.filter((r) => r.total < 0).sort((a, b) => a.total - b.total),
      gains: rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total),
    }
  }, [state.moodLog])

  const exportSave = useCallback(() => JSON.stringify(state), [state])

  return {
    state,
    archive,
    partners,
    warnings: warnings(state),
    moodLabel: moodLabel(state),
    successRate: successRate(state),
    lineMemo,
    moodBreakdown,
    ...actions,
    wipe,
    exportSave,
  }
}

export type Game = ReturnType<typeof useGame>
export type { GameState }
