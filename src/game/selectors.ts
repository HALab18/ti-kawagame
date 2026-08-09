import {
  APATHY_THRESHOLD,
  CHAR_NAMES,
  GIFT,
  MAX_EQUIPPED,
  MOOD,
  MOOD_MOODS,
  TOTAL_DAYS,
  TOYO,
  WHISPER,
} from './config'
import { isMoodCold, isMoodGood, keepsakeLimit, successRate } from './reducer'
import type { EmotionId, ForgetStage, GameState, Keepsake, PartnerId } from './types'

/** 表情パターン。SVG 側は差分パーツをこの値で切り替えるだけにする */
export type FacePattern =
  /** 通常。笑顔・ほお・まばたきあり */
  | 'full'
  /** 表情が減った状態。ほお消灯・口は一本線 */
  | 'flat'
  /** 初対面リセット。点目・無表情 */
  | 'blank'

export interface PartnerView {
  id: PartnerId
  /** 段階1以降は「あなた」呼びになる */
  callName: string
  memory: number
  stage: ForgetStage
  face: FacePattern
  /** まばたき・揺れなどのアイドルアニメを動かすか */
  animated: boolean
  /** 猶予期間中(この日数以内に会えば一気に戻る) */
  inGrace: boolean
  /** 今日「待っている」相手 */
  invited: boolean
  /** この相手の思い出を持っているか */
  keepsakes: Keepsake[]
}

const FACE_BY_STAGE: Record<ForgetStage, FacePattern> = {
  0: 'full',
  1: 'full',
  2: 'flat',
  3: 'blank',
}

export function partnerView(state: GameState, id: PartnerId, graceDays: number): PartnerView {
  const m = state.memories[id]
  return {
    id,
    callName: m.stage >= 1 ? 'あなた' : CHAR_NAMES[id],
    memory: m.value,
    stage: m.stage,
    face: FACE_BY_STAGE[m.stage],
    animated: m.stage < 2,
    inGrace: m.stage === 3 && m.resetDay !== null && state.day - m.resetDay <= graceDays,
    invited: state.invitation === id,
    keepsakes: state.keepsakes.filter((k) => k.partner === id),
  }
}

/** 夜の行動はどれも1日1回。すでに何かした後は選べない */
export function canDoNightAction(state: GameState): boolean {
  return state.phase === 'night' && state.nightAction === null
}

/** まきこの機嫌の言葉 */
export function moodLabel(state: GameState): string {
  return MOOD_MOODS.find((m) => state.mood >= m.from)?.label ?? MOOD_MOODS[MOOD_MOODS.length - 1].label
}

export function canGiveSweets(state: GameState): boolean {
  return canDoNightAction(state) && state.sweets >= 1
}

/** ぴすの特技は、昼にぴすに会った日だけ使える */
export function canPisuTalk(state: GameState): boolean {
  return (
    canDoNightAction(state) &&
    state.pending?.kind === 'meet' &&
    state.pending.partner === 'pisu'
  )
}

export function canShowKeepsake(state: GameState): boolean {
  return canDoNightAction(state) && state.keepsakes.length > 0
}

/** 「忘れても大丈夫だよ」は、とよっぴーがまだ覚えているうちだけ聞ける */
export function canWhisper(state: GameState): boolean {
  return canDoNightAction(state) && state.memories.toyoppi.stage <= WHISPER.requiresStage
}

/**
 * 思い出は、その相手が完全に忘れると色あせる(記憶度が戻れば元に戻る)。
 * 見せれば回復するが、消えてしまう。
 */
export function isFaded(state: GameState, keepsake: Keepsake): boolean {
  return state.memories[keepsake.partner].stage === 3
}

/** 朝の装備選択で、その感情を追加できるか */
export function canEquip(state: GameState, emotion: EmotionId): boolean {
  if (state.phase !== 'morning') return false
  if (state.equipped.includes(emotion)) return true
  return state.equipped.length < MAX_EQUIPPED
}

export function canGift(state: GameState): boolean {
  return canDoNightAction(state) && state.items >= GIFT.itemCost
}

/** UI に出す注意書き。ゲージの意味を数字以外でも伝える */
export function warnings(state: GameState): string[] {
  const out: string[] = []
  if (isMoodCold(state)) out.push('まきこがつっけんどん(会話も記憶も戻りにくい)')
  else if (isMoodGood(state)) out.push('まきこの機嫌がいい(忘却がゆるやか・収穫+1)')
  if (state.apathy) out.push('無気力: 作業ができず、忘却が早まっている')
  else if (state.emotions.samishii >= APATHY_THRESHOLD - 20)
    out.push('さみしいが溜まってきている')
  if (state.emotions.tanoshii <= 20) out.push('たのしいが少ない(会話が通じにくい)')
  if (state.keepsakes.length >= keepsakeLimit(state))
    out.push('思い出が上限。使わないと新しく残らない')
  if (state.toyoNeglect >= TOYO.angerAfterDays)
    out.push(`とよっぴーが怒っている(毎晩まきこのごきげん ${TOYO.moodPenalty})`)
  else if (state.toyoNeglect === TOYO.angerAfterDays - 1)
    out.push('とよっぴーにそろそろ顔を出さないと怒られる')
  return out
}

/** ご褒美まであと何日、機嫌をキープすればよいか */
export function streakToReward(state: GameState, per: number): number {
  return state.mood >= MOOD.goodFrom ? per - (state.moodStreak % per) : per
}

/** 夕方の演出やデバッグ用のスナップショット */
export function summary(state: GameState) {
  return {
    day: `${state.day} / ${TOTAL_DAYS}`,
    phase: state.phase,
    successRate: Math.round(successRate(state) * 100),
    items: state.items,
    memories: Object.fromEntries(
      Object.entries(state.memories).map(([id, m]) => [id, `${m.value}(stage${m.stage})`]),
    ),
  }
}
