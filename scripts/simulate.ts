/**
 * バランス確認用のヘッドレス試行。
 * 数値を config.ts で触ったあと、想定どおりのエンディング分布になるか確かめる。
 *
 *   npm run sim
 */
import { PARTNER_IDS, REWARDS, TOTAL_DAYS } from '../src/game/config'
import { createInitialState, gameReducer } from '../src/game/reducer'
import type { EmotionId, GameAction, GameState, PartnerId, RewardId } from '../src/game/types'

/** その日の朝・昼・夜をどう選ぶかの方針 */
interface Strategy {
  name: string
  equip: (s: GameState) => EmotionId[]
  /** null なら作業 */
  meet: (s: GameState) => PartnerId | null
  night: (s: GameState) => GameAction | null
}

/** 記憶度がいちばん低い相手 */
const lowest = (s: GameState): PartnerId =>
  [...PARTNER_IDS].sort((a, b) => s.memories[a].value - s.memories[b].value)[0]

/** まきこの要求どおりに昼を動く */
function obey(s: GameState): PartnerId | null {
  switch (s.demand) {
    case 'visit':
      return 'makiko'
    case 'showFriend':
      return 'pisu'
    case 'gift':
      // 夜に渡すものが要る。手持ちがなければ作業して調達する
      return s.sweets > 0 || s.items > 0 ? 'makiko' : null
    case 'alone':
      // まきこ以外なら怒られない。忘れかけている相手に回す
      return lowest(s) === 'makiko' ? null : lowest(s)
  }
}

/** 機嫌を最優先する夜の使い方 */
function moodNight(s: GameState): GameAction {
  // ぴすに会った日は取りなしてもらうのがいちばん効く
  if (s.pending?.kind === 'meet' && s.pending.partner === 'pisu') return { type: 'pisuTalk' }
  if (s.demand === 'gift' && s.sweets > 0) return { type: 'giveSweets' }
  // 機嫌が落ちているならスイーツで立て直す
  if (s.mood < 70 && s.sweets > 0) return { type: 'giveSweets' }
  const target = lowest(s)
  const keepsake = s.keepsakes.find((k) => k.partner === target)
  if (keepsake && s.memories[target].value < 45) {
    return { type: 'showKeepsake', keepsakeId: keepsake.id }
  }
  if (s.emotions.ganbaru < 30) return { type: 'rest' }
  if (s.items > 0 && s.memories[target].value < 60) return { type: 'gift', partner: target }
  return { type: 'rest' }
}

const strategies: Strategy[] = [
  {
    name: '放置(作業だけ・夜は休む)',
    equip: () => ['ganbaru'],
    meet: () => null,
    night: () => ({ type: 'rest' }),
  },
  {
    name: '要求を無視して忘却だけ防ぐ',
    equip: () => ['tanoshii'],
    meet: (s) => lowest(s),
    night: () => ({ type: 'rest' }),
  },
  {
    name: 'ご機嫌とり(要求どおり+スイーツ+ぴす)',
    equip: () => ['tanoshii'],
    meet: obey,
    night: moodNight,
  },
  {
    name: 'ご機嫌とり + がんばる装備',
    equip: () => ['tanoshii', 'ganbaru'],
    meet: obey,
    night: moodNight,
  },
  {
    name: 'スイーツだけで機嫌をとる',
    equip: () => ['ganbaru'],
    meet: () => null,
    night: (s) => (s.sweets > 0 ? { type: 'giveSweets' } : { type: 'rest' }),
  },
  {
    name: 'とよっぴーに逃げる',
    equip: () => ['tanoshii'],
    meet: () => 'toyoppi',
    night: (s) => (s.memories.toyoppi.stage === 0 ? { type: 'whisper' } : { type: 'rest' }),
  },
]

function play(strategy: Strategy, seed: number): GameState {
  let s = createInitialState(seed)
  const step = (a: GameAction) => {
    s = gameReducer(s, a)
  }

  for (let guard = 0; s.phase !== 'ending' && guard < TOTAL_DAYS * 10; guard++) {
    switch (s.phase) {
      case 'morning':
        step({ type: 'equip', emotions: strategy.equip(s) })
        break
      case 'day': {
        const target = strategy.meet(s)
        step(target ? { type: 'meet', partner: target } : { type: 'work' })
        break
      }
      case 'evening':
        step({ type: 'advance' })
        break
      case 'night': {
        const choice = strategy.night(s)
        if (choice) step(choice)
        step({ type: 'sleep' })
        break
      }
      case 'reward': {
        // いちばん効果が分かりやすいものから取る
        const order: RewardId[] = ['secret', 'letter', 'charm', 'bento', 'tea', 'photo']
        const pick = order.find((r) => s.rewardOffer?.includes(r)) ?? s.rewardOffer?.[0]
        if (pick) step({ type: 'chooseReward', reward: pick })
        break
      }
    }
  }
  return s
}

for (const strategy of strategies) {
  const runs = [1, 7, 42, 1234, 99999].map((seed) => play(strategy, seed))
  const last = runs[0]
  console.log(`\n■ ${strategy.name}`)
  console.log(`  エンディング: ${runs.map((r) => r.ending).join(', ')}`)
  console.log(`  ごきげん: ${runs.map((r) => r.mood).join(', ')}`)
  console.log(
    `  seed=1: 記憶度 ${PARTNER_IDS.map((id) => `${id}:${last.memories[id].value}`).join(' ')}`,
  )
  console.log(
    `  seed=1: ごほうび ${last.rewards.map((r) => REWARDS[r].name).join('/') || 'なし'}` +
      ` / スイーツ${last.sweets} / がんばる${last.emotions.ganbaru}`,
  )
}
