import { useCallback, useMemo, useReducer } from 'react'
import { GRACE_DAYS, PARTNER_IDS } from './config'
import { createInitialState, gameReducer, successRate } from './reducer'
import { moodLabel, partnerView, warnings } from './selectors'
import type { EmotionId, GameState, PartnerId, RewardId } from './types'

/**
 * React 側の入口。state はここに閉じ込め、UI は view と操作関数だけを触る。
 * localStorage は使わないので、保存が必要になったら `state` を JSON にして
 * ユーザーに書き出させる(またはサーバへ送る)方針。
 */
export function useGame(seed = 1) {
  const [state, dispatch] = useReducer(gameReducer, seed, createInitialState)

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
      reset: (nextSeed?: number) => dispatch({ type: 'reset', seed: nextSeed }),
    }),
    [],
  )

  const exportSave = useCallback(() => JSON.stringify(state), [state])

  return {
    state,
    partners,
    warnings: warnings(state),
    moodLabel: moodLabel(state),
    successRate: successRate(state),
    ...actions,
    exportSave,
  }
}

export type Game = ReturnType<typeof useGame>
export type { GameState }
