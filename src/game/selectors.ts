import {
  APATHY_THRESHOLD,
  CHAR_NAMES,
  GACHA,
  GIFT,
  MAX_EQUIPPED,
  MEMORY_NEXT,
  MEMORY_ROLE,
  MEMORY_TRUST,
  MOOD,
  MOOD_MOODS,
  PISU_TALK,
  PLAYER_ID,
  PRIZES,
  PRIZE_IDS,
  STAGE_LABEL,
  STAGE_THRESHOLDS,
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
  /** 相手の名前。こちらが忘れるわけではないので、常に本名を出す */
  name: string
  /**
   * その相手が「こちら」をどう呼ぶか。
   * 記憶度が落ちると りみっち → 「あなた」 になる(忘れられている側はこちら)。
   */
  callsYou: string
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
  /** 覚えていてもらえると何ができるか(記憶度を保つ理由) */
  role: string
  /** 今の段落の見え方。「あなた」呼びなど */
  stageLabel: string
  /** いまこの記憶度で起きていること */
  effect: string
  /** あと何下がると、何を失うか。stage3 では null */
  nextLoss: { drop: number; text: string } | null
}

const FACE_BY_STAGE: Record<ForgetStage, FacePattern> = {
  0: 'full',
  1: 'full',
  2: 'flat',
  3: 'blank',
}

/**
 * その相手の記憶度が、今なにを起こしているか。
 * ゲージの数字だけでは伝わらないので、必ず言葉にして UI に出す。
 */
function memoryEffect(state: GameState, id: PartnerId): string {
  const stage = state.memories[id].stage
  if (id === 'makiko') {
    return `応えたときの喜び ${Math.round(MEMORY_TRUST[stage] * 100)}%`
  }
  if (id === 'pisu') {
    return stage <= GACHA.clearStage
      ? 'ガチャ・取りなしを頼める'
      : `頼みごとが通らない（取りなしは +${PISU_TALK.fadedMoodGain} だけ）`
  }
  return stage <= WHISPER.requiresStage
    ? '「大丈夫だよ」を聞ける'
    : '「大丈夫だよ」は聞けない'
}

/** あと何下がると次の段階に落ちるか。落ちると何を失うか */
function nextLoss(state: GameState, id: PartnerId): PartnerView['nextLoss'] {
  const { value, stage } = state.memories[id]
  if (stage === 3) return null
  const next = (stage + 1) as ForgetStage
  // STAGE_THRESHOLDS[stage] を下回った時点で次の段階に落ちる
  const drop = value - STAGE_THRESHOLDS[stage] + 1
  const text =
    id === 'makiko'
      ? `喜びが ${Math.round(MEMORY_TRUST[next] * 100)}% に落ちる`
      : (MEMORY_NEXT[id][next] ?? STAGE_LABEL[next])
  return { drop: Math.max(0, drop), text }
}

export function partnerView(state: GameState, id: PartnerId, graceDays: number): PartnerView {
  const m = state.memories[id]
  return {
    id,
    name: CHAR_NAMES[id],
    callsYou: m.stage >= 1 ? 'あなた' : CHAR_NAMES[PLAYER_ID],
    memory: m.value,
    stage: m.stage,
    face: FACE_BY_STAGE[m.stage],
    animated: m.stage < 2,
    inGrace: m.stage === 3 && m.resetDay !== null && state.day - m.resetDay <= graceDays,
    invited: state.invitation === id,
    keepsakes: state.keepsakes.filter((k) => k.partner === id),
    role: MEMORY_ROLE[id],
    stageLabel: STAGE_LABEL[m.stage],
    effect: memoryEffect(state, id),
    nextLoss: nextLoss(state, id),
  }
}

/**
 * りみっち(プレイヤー)自身の見え方。
 * 3つの感情ゲージは「彼女の状態」なので、本人と一緒に見せないと
 * 誰の数字なのか分からなくなる。
 */
export interface MeView {
  name: string
  job: string
  face: FacePattern
  animated: boolean
  /** 今の状態から出てくるひとこと */
  line: string
}

export function meView(state: GameState): MeView {
  const { ganbaru, tanoshii, samishii } = state.emotions
  const face: FacePattern = state.apathy ? 'blank' : tanoshii <= 25 ? 'flat' : 'full'
  return {
    name: CHAR_NAMES[PLAYER_ID],
    job: 'お弁当屋',
    face,
    animated: !state.apathy,
    line: state.apathy
      ? '「……もう、なんにも思い出せない」'
      : state.phase === 'ending'
        ? '「30日、なんとかやったと思う」'
        : samishii >= APATHY_THRESHOLD - 20
          ? '「だれかに会いたい」'
          : tanoshii <= 25
            ? '「うまく話せる気がしない」'
            : ganbaru <= 20
              ? '「今日はもう、手が動かない」'
              : state.mood >= MOOD.goodFrom
                ? '「今日のまきこは、たぶん平気」'
                : '「まきこ、何を言いたいんだろう」',
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

/** ガチャはぴすに頼むので、ぴすが覚えていて仕込みが足りているときだけ */
export function canGacha(state: GameState): boolean {
  return (
    canDoNightAction(state) &&
    state.items >= GACHA.itemCost &&
    state.memories.pisu.stage <= GACHA.clearStage
  )
}

/**
 * 好きなもの図鑑。当てた景品だけ名前が分かり、それ以外は「?」のまま。
 * 引いたが好きではなかったものは「ちがった」として除外できる。
 */
export function prizeBook(state: GameState) {
  return PRIZE_IDS.map((id) => ({
    id,
    ...PRIZES[id],
    liked: state.knownLikes.includes(id),
    tried: state.drawnPrizes.includes(id),
  }))
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
  // 記憶度の影響は HUD の記憶ゲージが1行ずつ説明しているので、ここでは繰り返さない
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
