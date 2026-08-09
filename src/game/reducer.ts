import {
  APATHY_THRESHOLD,
  BEST_FRIEND,
  CHAR_NAMES,
  DEMAND_HINT,
  DEMAND_LINES,
  demandCandidates,
  ENDING,
  EVENTS,
  EVENT_CHANCE,
  GACHA,
  GAUGE_MAX,
  GAUGE_MIN,
  GIFT,
  GRACE_DAYS,
  GRACE_RECOVERY_TO,
  HEARSAY_GAIN,
  INITIAL_EMOTIONS,
  INITIAL_MEMORY,
  INITIAL_MOOD,
  INVITATION,
  KEEPSAKE,
  KEEPSAKE_TEXTS,
  MAX_EQUIPPED,
  MEET,
  MOOD,
  MOOD_COLD,
  MOOD_GOOD,
  MOOD_MAX,
  NIGHT,
  PARTNER_IDS,
  PISU_TALK,
  PRIZES,
  PRIZE_IDS,
  REST,
  REWARDS,
  REWARD_EFFECT,
  REWARD_STREAK,
  STAGE_THRESHOLDS,
  SWEETS,
  TOTAL_DAYS,
  TOYO,
  WHISPER,
  WORK,
} from './config'
import { nextRandom, roll } from './rng'
import type {
  DayResult,
  DemandId,
  EmotionId,
  EndingId,
  ForgetStage,
  GameAction,
  GameState,
  Keepsake,
  MemoryState,
  PartnerId,
  PrizeId,
  RewardId,
} from './types'

const clamp = (n: number) => Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, Math.round(n)))
const clampMood = (n: number) => Math.min(MOOD_MAX, Math.max(0, Math.round(n)))

/** ご褒美を持っているか */
export function has(state: GameState, reward: RewardId): boolean {
  return state.rewards.includes(reward)
}

export function stageOf(value: number): ForgetStage {
  if (value >= STAGE_THRESHOLDS[0]) return 0
  if (value >= STAGE_THRESHOLDS[1]) return 1
  if (value >= STAGE_THRESHOLDS[2]) return 2
  return 3
}

/** まきこは機嫌がいい / 悪い */
export const isMoodGood = (state: GameState) => state.mood >= MOOD.goodFrom
export const isMoodCold = (state: GameState) => state.mood < MOOD.coldBelow

/** 思い出の所持上限(写真で増える) */
export function keepsakeLimit(state: GameState): number {
  return KEEPSAKE.maxHeld + (has(state, 'photo') ? REWARD_EFFECT.photoSlots : 0)
}

/** 記憶度が最も低い相手(同値なら定義順) */
function lowestMemory(state: GameState, from: readonly PartnerId[]): PartnerId | null {
  if (from.length === 0) return null
  return from.reduce((a, b) => (state.memories[b].value < state.memories[a].value ? b : a))
}

/**
 * 翌日の「待っている相手」を決める。
 * stage3 の相手は誘ってこない(こちらを知らないので)。
 */
function pickInvitation(state: GameState): { partner: PartnerId | null; seed: number } {
  const eligible = PARTNER_IDS.filter((id) => state.memories[id].stage < 3)
  if (eligible.length === 0) return { partner: null, seed: state.seed }

  const bias = roll(state.seed, INVITATION.lowestBias)
  if (bias.hit) return { partner: lowestMemory(state, eligible), seed: bias.seed }

  const pick = nextRandom(bias.seed)
  const index = Math.floor(pick.value * eligible.length) % eligible.length
  return { partner: eligible[index], seed: pick.seed }
}

const DEMAND_IDS: readonly DemandId[] = ['visit', 'gift', 'alone', 'showFriend']

/**
 * まきこの翌日の要求と、その言い方を決める。
 * セリフは「その要求を指しうる言い方」からさらに抽選するので、
 * プレイヤーはセリフだけから要求を一意に特定できない。
 */
function pickDemand(seed: number): { demand: DemandId; said: string; seed: number } {
  const a = nextRandom(seed)
  const demand = DEMAND_IDS[Math.floor(a.value * DEMAND_IDS.length) % DEMAND_IDS.length]
  const lines = DEMAND_LINES.filter((l) => l.for.includes(demand))
  const b = nextRandom(a.seed)
  const said = lines[Math.floor(b.value * lines.length) % lines.length].text
  return { demand, said, seed: b.seed }
}

/** 朝の突発イベント */
function pickEvent(seed: number): { event: GameState['event']; seed: number } {
  const gate = roll(seed, EVENT_CHANCE)
  if (!gate.hit) return { event: null, seed: gate.seed }
  const r = nextRandom(gate.seed)
  const e = EVENTS[Math.floor(r.value * EVENTS.length) % EVENTS.length]
  return { event: { text: e.text, delta: e.delta }, seed: r.seed }
}

/** ご褒美の2択。まだ持っていないものから選ぶ */
function pickRewardOffer(state: GameState, seed: number): { offer: RewardId[] | null; seed: number } {
  const pool = (Object.keys(REWARDS) as RewardId[]).filter((id) => !state.rewards.includes(id))
  if (pool.length === 0) return { offer: null, seed }
  if (pool.length === 1) return { offer: [pool[0]], seed }

  const a = nextRandom(seed)
  const first = pool[Math.floor(a.value * pool.length) % pool.length]
  const rest = pool.filter((id) => id !== first)
  const b = nextRandom(a.seed)
  const second = rest[Math.floor(b.value * rest.length) % rest.length]
  return { offer: [first, second], seed: b.seed }
}

/** まきこが好きな景品を決める。プレイヤーには見えない */
function pickLikes(seed: number): { likes: PrizeId[]; seed: number } {
  const pool = [...PRIZE_IDS]
  const likes: PrizeId[] = []
  let s = seed
  for (let i = 0; i < GACHA.likeCount && pool.length > 0; i++) {
    const r = nextRandom(s)
    s = r.seed
    likes.push(pool.splice(Math.floor(r.value * pool.length) % pool.length, 1)[0])
  }
  return { likes, seed: s }
}

export function createInitialState(seed = 1): GameState {
  const memories = {} as Record<PartnerId, MemoryState>
  const meetCounts = {} as Record<PartnerId, number>
  for (const id of PARTNER_IDS) {
    memories[id] = {
      value: INITIAL_MEMORY,
      stage: stageOf(INITIAL_MEMORY),
      resetDay: null,
      everReset: false,
    }
    meetCounts[id] = 0
  }
  const base: GameState = {
    day: 1,
    phase: 'morning',
    seed,
    emotions: { ...INITIAL_EMOTIONS },
    equipped: [],
    apathy: false,
    memories,
    items: 0,
    sweets: 0,
    meetCounts,
    invitation: null,
    ignoredInvitation: false,
    keepsakes: [],
    nightAction: null,
    nightTarget: null,
    mood: INITIAL_MOOD,
    demand: 'visit',
    demandSaid: DEMAND_LINES[0].text,
    toyoNeglect: 0,
    makikoLikes: [],
    knownLikes: [],
    drawnPrizes: [],
    lastPrize: null,
    moodReport: [],
    event: null,
    moodStreak: 0,
    rewards: [],
    rewardOffer: null,
    whispers: 0,
    pending: null,
    log: [],
    ending: null,
  }
  const first = pickInvitation(base)
  const d = pickDemand(first.seed)
  const likes = pickLikes(d.seed)
  return {
    ...base,
    invitation: first.partner,
    demand: d.demand,
    demandSaid: d.said,
    makikoLikes: likes.likes,
    seed: likes.seed,
  }
}

/**
 * 会話成功率。相手を渡すと、まきこの機嫌の影響まで含めて返す。
 */
export function successRate(state: GameState, partner?: PartnerId): number {
  let p =
    MEET.baseSuccess +
    state.emotions.tanoshii * MEET.tanoshiiSuccessScale +
    (state.equipped.includes('tanoshii') ? MEET.tanoshiiEquipBonus : 0) +
    (has(state, 'charm') ? REWARD_EFFECT.charmSuccess : 0)
  if (state.apathy) p *= MEET.apathySuccessRate
  if (partner === 'makiko' && isMoodCold(state)) p *= MOOD_COLD.successMultiplier
  return Math.min(1, Math.max(0, p))
}

/** 作業の収穫量。無気力だと手が動かない */
export function harvestAmount(state: GameState): number {
  if (state.apathy) return 0
  const base = WORK.baseHarvest * (1 + state.emotions.ganbaru / GAUGE_MAX)
  const mult = state.equipped.includes('ganbaru') ? WORK.equipMultiplier : 1
  const bonus =
    (has(state, 'bento') ? REWARD_EFFECT.bentoHarvest : 0) +
    (isMoodGood(state) ? MOOD_GOOD.harvestBonus : 0)
  return Math.max(0, Math.round(base * mult) + bonus)
}

/** 記憶度を加算し、段階変化と早期回復(猶予)を反映した新しい MemoryState を返す */
function applyMemory(
  memory: MemoryState,
  delta: number,
  day: number,
): { memory: MemoryState; from: ForgetStage; to: ForgetStage; applied: number } {
  const from = memory.stage
  let next = memory.value + delta

  const inGrace =
    delta > 0 && memory.everReset && memory.resetDay !== null && day - memory.resetDay <= GRACE_DAYS
  if (inGrace) next = Math.max(next, GRACE_RECOVERY_TO)

  const value = clamp(next)
  const to = stageOf(value)
  const justReset = to === 3 && from !== 3
  return {
    memory: {
      value,
      stage: to,
      resetDay: justReset ? day : to === 3 ? memory.resetDay : null,
      everReset: memory.everReset || justReset,
    },
    from,
    to,
    applied: value - memory.value,
  }
}

/** 複数人にまとめて増減を適用する */
function applyMany(
  state: GameState,
  deltas: Partial<Record<PartnerId, number>>,
  day = state.day,
): Pick<GameState, 'memories'> & Pick<DayResult, 'deltas' | 'stageChanges'> {
  const memories = { ...state.memories }
  const applied: Partial<Record<PartnerId, number>> = {}
  const stageChanges: DayResult['stageChanges'] = []

  for (const id of PARTNER_IDS) {
    const delta = deltas[id]
    if (delta === undefined || delta === 0) continue
    const next = applyMemory(memories[id], delta, day)
    memories[id] = next.memory
    applied[id] = next.applied
    if (next.from !== next.to) stageChanges.push({ partner: id, from: next.from, to: next.to })
  }
  return { memories, deltas: applied, stageChanges }
}

function judgeEnding(state: GameState): EndingId {
  const totalMeets = PARTNER_IDS.reduce((sum, id) => sum + state.meetCounts[id], 0)
  const toyoppiShare = totalMeets > 0 ? state.meetCounts.toyoppi / totalMeets : 0
  const toyoppiRoute =
    toyoppiShare >= ENDING.toyoppiShare || state.whispers >= ENDING.whisperCount

  if (toyoppiRoute && state.memories.toyoppi.value >= ENDING.toyoppiMemoryMin) {
    return 'toyoppi'
  }
  if (state.mood >= ENDING.moodPerfect) return 'makikoPerfect'
  if (state.mood <= ENDING.moodCold) return 'makikoCold'
  if (PARTNER_IDS.some((id) => state.memories[id].stage === 3)) return 'forgotten'
  if (state.mood >= ENDING.moodOk) return 'makikoOk'
  return 'neutral'
}

function logged(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, { day: state.day, text }] }
}

/** 夜の行動は1日1回。共通のガード */
function nightGuard(state: GameState): boolean {
  return state.phase === 'night' && state.nightAction === null
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'reset':
      return createInitialState(action.seed ?? state.seed)

    // ── 朝: 感情装備 ───────────────────────────────
    case 'equip': {
      if (state.phase !== 'morning') return state
      const equipped = [...new Set(action.emotions)].slice(0, MAX_EQUIPPED) as EmotionId[]
      return { ...state, equipped, phase: 'day' }
    }

    // ── 昼: 一人で作業する ─────────────────────────
    case 'work': {
      if (state.phase !== 'day') return state
      const harvest = harvestAmount(state)
      const tanoshiiDrop =
        WORK.tanoshiiDrop *
        (state.equipped.includes('tanoshii') ? WORK.tanoshiiDropEquippedRate : 1)

      // スイーツ探し。まきこの機嫌を直す仕込みは作業の日にしかできない
      const sweetRoll = state.apathy
        ? { hit: false, seed: state.seed }
        : roll(
            state.seed,
            state.equipped.includes('ganbaru') ? SWEETS.findChanceEquipped : SWEETS.findChance,
          )

      const result: DayResult = {
        kind: 'work',
        partner: null,
        success: null,
        harvest,
        sweetsFound: sweetRoll.hit ? 1 : 0,
        deltas: {},
        stageChanges: [],
        answeredInvitation: false,
        keepsakeGained: null,
        hearsay: null,
      }
      return logged(
        {
          ...state,
          phase: 'evening',
          seed: sweetRoll.seed,
          items: state.items + harvest,
          sweets: state.sweets + result.sweetsFound,
          ignoredInvitation: state.invitation !== null,
          emotions: {
            ganbaru: clamp(state.emotions.ganbaru - WORK.ganbaruDrop),
            tanoshii: clamp(state.emotions.tanoshii - tanoshiiDrop),
            samishii: clamp(state.emotions.samishii + WORK.samishiiGain),
          },
          pending: result,
        },
        state.apathy
          ? '手は動かなかった。ずっと畑を見ていた。'
          : `一人で作業した。収穫 ${harvest}。${sweetRoll.hit ? 'スイーツを見つけた。' : ''}`,
      )
    }

    // ── 昼: 誰かに会う ─────────────────────────────
    case 'meet': {
      if (state.phase !== 'day') return state
      const partner = action.partner
      const answered = state.invitation === partner

      const attempt = roll(state.seed, successRate(state, partner))
      let seed = attempt.seed

      const base = attempt.hit ? MEET.memoryGain : MEET.memoryGainOnFail
      // まきこは機嫌が悪いと素直に思い出してくれない
      const moodMult =
        partner === 'makiko'
          ? isMoodCold(state)
            ? MOOD_COLD.memoryMultiplier
            : isMoodGood(state)
              ? MOOD_GOOD.memoryMultiplier
              : 1
          : 1
      const gain = Math.round(
        base *
          (state.equipped.includes('samishii') ? MEET.samishiiEquipBonus : 1) *
          (answered ? INVITATION.answerMultiplier : 1) *
          moodMult,
      )

      const friend = attempt.hit ? BEST_FRIEND[partner] : null
      const deltas: Partial<Record<PartnerId, number>> = { [partner]: gain }
      if (friend) deltas[friend] = HEARSAY_GAIN

      const moved = applyMany(state, deltas)

      let keepsakeGained: Keepsake | null = null
      if (attempt.hit && state.keepsakes.length < keepsakeLimit(state)) {
        const chance = KEEPSAKE.baseChance + state.emotions.tanoshii * KEEPSAKE.tanoshiiScale
        const lottery = roll(seed, chance)
        seed = lottery.seed
        if (lottery.hit) {
          const texts = KEEPSAKE_TEXTS[partner]
          const pick = nextRandom(seed)
          seed = pick.seed
          keepsakeGained = {
            id: `${partner}-${state.day}-${state.keepsakes.length}`,
            partner,
            text: texts[Math.floor(pick.value * texts.length) % texts.length],
            day: state.day,
          }
        }
      }

      const result: DayResult = {
        kind: 'meet',
        partner,
        success: attempt.hit,
        harvest: answered ? INVITATION.answerHarvest : 0,
        sweetsFound: 0,
        deltas: moved.deltas,
        stageChanges: moved.stageChanges,
        answeredInvitation: answered,
        keepsakeGained,
        hearsay: friend,
      }

      return logged(
        {
          ...state,
          phase: 'evening',
          seed,
          memories: moved.memories,
          meetCounts: { ...state.meetCounts, [partner]: state.meetCounts[partner] + 1 },
          items: state.items + result.harvest,
          ignoredInvitation: state.invitation !== null && !answered,
          keepsakes: keepsakeGained ? [...state.keepsakes, keepsakeGained] : state.keepsakes,
          emotions: {
            ganbaru: clamp(state.emotions.ganbaru - MEET.ganbaruDrop),
            tanoshii: clamp(state.emotions.tanoshii + MEET.tanoshiiGain),
            samishii: clamp(state.emotions.samishii - MEET.samishiiDrop),
          },
          pending: result,
        },
        `${CHAR_NAMES[partner]}に会った。${attempt.hit ? '話がよく通じた。' : 'うまく話せなかった。'}`,
      )
    }

    // ── 夕方: 増減を見終えて夜へ ───────────────────
    case 'advance': {
      if (state.phase !== 'evening') return state
      return { ...state, phase: 'night' }
    }

    // ── 夜: 休む ───────────────────────────────────
    case 'rest': {
      if (!nightGuard(state)) return state
      const gain = has(state, 'tea') ? REWARD_EFFECT.teaGanbaru : REST.ganbaruGain
      return logged(
        {
          ...state,
          nightAction: 'rest',
          emotions: {
            ...state.emotions,
            ganbaru: clamp(state.emotions.ganbaru + gain),
            samishii: clamp(state.emotions.samishii - REST.samishiiDrop),
          },
        },
        '何もしないで休んだ。',
      )
    }

    // ── 夜: 贈り物 ─────────────────────────────────
    case 'gift': {
      if (!nightGuard(state) || state.items < GIFT.itemCost) return state
      const moved = applyMany(state, { [action.partner]: GIFT.memoryGain })
      return logged(
        {
          ...state,
          nightAction: 'gift',
          nightTarget: action.partner,
          items: state.items - GIFT.itemCost,
          memories: moved.memories,
        },
        `${CHAR_NAMES[action.partner]}に贈り物を用意した。`,
      )
    }

    // ── 夜: スイーツを渡す ─────────────────────────
    case 'giveSweets': {
      if (!nightGuard(state) || state.sweets < 1) return state
      const gain = SWEETS.moodGain + (state.demand === 'gift' ? SWEETS.demandBonus : 0)
      return logged(
        {
          ...state,
          nightAction: 'sweets',
          nightTarget: 'makiko',
          sweets: state.sweets - 1,
          mood: clampMood(state.mood + gain),
          moodReport: [...state.moodReport, { delta: gain, reason: 'スイーツをもらった' }],
        },
        'まきこにスイーツを渡した。だいぶ機嫌が直った。',
      )
    }

    // ── 夜: 思い出を見せる ─────────────────────────
    case 'showKeepsake': {
      if (!nightGuard(state)) return state
      const keepsake = state.keepsakes.find((k) => k.id === action.keepsakeId)
      if (!keepsake) return state
      const moved = applyMany(state, { [keepsake.partner]: KEEPSAKE.showGain })
      return logged(
        {
          ...state,
          nightAction: 'keepsake',
          nightTarget: keepsake.partner,
          memories: moved.memories,
          keepsakes: state.keepsakes.filter((k) => k.id !== keepsake.id),
        },
        `${CHAR_NAMES[keepsake.partner]}に思い出の話をした。「${keepsake.text}」`,
      )
    }

    // ── 夜: ぴすが今日のことを話してくれる ─────────
    case 'pisuTalk': {
      if (!nightGuard(state)) return state
      // 昼にぴすに会った日だけ、話すネタがある
      if (state.pending?.kind !== 'meet' || state.pending.partner !== 'pisu') return state
      const clear = state.memories.pisu.stage <= PISU_TALK.clearStage
      const gain = clear ? PISU_TALK.moodGain : PISU_TALK.fadedMoodGain
      return logged(
        {
          ...state,
          nightAction: 'pisuTalk',
          nightTarget: 'pisu',
          mood: clampMood(state.mood + gain),
          moodReport: [
            ...state.moodReport,
            { delta: gain, reason: 'ぴすが今日のことを話してくれた' },
          ],
        },
        clear
          ? 'ぴすが今日あったことを、まきこに話してくれた。まきこは笑っていた。'
          : 'ぴすが話してくれたが、うまく思い出せないようだった。',
      )
    }

    // ── 夜: ぴすにガチャを回してもらう ─────────────
    case 'gacha': {
      if (!nightGuard(state) || state.items < GACHA.itemCost) return state
      // ぴすが忘れかけていると、頼みごとが通らない
      if (state.memories.pisu.stage > GACHA.clearStage) return state

      const r = nextRandom(state.seed)
      const prize = PRIZE_IDS[Math.floor(r.value * PRIZE_IDS.length) % PRIZE_IDS.length]
      const hit = state.makikoLikes.includes(prize)
      const repeat = state.drawnPrizes.includes(prize)
      const gain = hit ? (repeat ? GACHA.repeatHitMood : GACHA.hitMood) : GACHA.missMood

      return logged(
        {
          ...state,
          nightAction: 'gacha',
          nightTarget: 'pisu',
          seed: r.seed,
          items: state.items - GACHA.itemCost,
          mood: clampMood(state.mood + gain),
          drawnPrizes: repeat ? state.drawnPrizes : [...state.drawnPrizes, prize],
          // 当たったものだけ「好きだ」と判明する
          knownLikes:
            hit && !state.knownLikes.includes(prize)
              ? [...state.knownLikes, prize]
              : state.knownLikes,
          lastPrize: { prize, hit, repeat },
          moodReport: [
            ...state.moodReport,
            { delta: gain, reason: `ぴすが${PRIZES[prize].name}を引いてきた` },
          ],
        },
        hit
          ? repeat
            ? `ぴすが${PRIZES[prize].name}を引いてきた。まきこは「持ってるけど」と言いつつ受け取った。`
            : `ぴすが${PRIZES[prize].name}を引いてきた。まきこの目が変わった。これは好きなやつだ。`
          : `ぴすが${PRIZES[prize].name}を引いてきた。まきこは「ありがとう」とだけ言った。`,
      )
    }

    // ── 夜: 「忘れても大丈夫だよ」を聞く ───────────
    case 'whisper': {
      if (!nightGuard(state)) return state
      if (state.memories.toyoppi.stage > WHISPER.requiresStage) return state
      const cost: Partial<Record<PartnerId, number>> = {}
      for (const id of PARTNER_IDS) cost[id] = -WHISPER.memoryCost
      const moved = applyMany(state, cost)
      return logged(
        {
          ...state,
          nightAction: 'whisper',
          whispers: state.whispers + 1,
          memories: moved.memories,
          emotions: {
            ...state.emotions,
            samishii: clamp(state.emotions.samishii - WHISPER.samishiiDrop),
          },
        },
        'とよっぴーが「忘れても大丈夫だよ」と言った。すこし楽になった。',
      )
    }

    // ── ご褒美を選ぶ ───────────────────────────────
    case 'chooseReward': {
      if (state.phase !== 'reward') return state
      if (!state.rewardOffer?.includes(action.reward)) return state
      return logged(
        {
          ...state,
          phase: 'morning',
          rewards: [...state.rewards, action.reward],
          rewardOffer: null,
        },
        `まきこから「${REWARDS[action.reward].name}」をもらった。`,
      )
    }

    // ── 夜: 就寝 ───────────────────────────────────
    case 'sleep': {
      if (state.phase !== 'night') return state

      const nextDay = state.day + 1
      const metPartner = state.pending?.kind === 'meet' ? state.pending.partner : null
      const gaveMakiko =
        (state.nightAction === 'gift' && state.nightTarget === 'makiko') ||
        state.nightAction === 'sweets'

      // ① 要求を満たせたかを判定する
      const report: GameState['moodReport'] = []
      const push = (delta: number, reason: string) => report.push({ delta, reason })

      switch (state.demand) {
        case 'visit':
          if (metPartner === 'makiko') push(MOOD.satisfied, '会いに来てくれた')
          else push(MOOD.ignored, '結局、来てくれなかった')
          break
        case 'gift':
          if (gaveMakiko) push(MOOD.satisfied, 'ちゃんと用意してくれた')
          else push(MOOD.ignored, 'やっぱり何もくれなかった')
          break
        case 'alone':
          if (metPartner === 'makiko') push(MOOD.intruded, 'いいと言ったのに来た')
          else push(MOOD.satisfied, 'そっとしておいてくれた')
          break
        case 'showFriend':
          if (metPartner === 'pisu') push(MOOD.showFriend, 'ぴすと仲良くしていた')
          else push(MOOD.showFriendMissed, 'ぴすとは話さなかった')
          break
      }

      // ② 嫉妬。母(とよっぴー)に会うのは怒られない。ぴすが取りなした日も起きない
      const jealousDemand = state.demand === 'visit' || state.demand === 'gift'
      if (
        jealousDemand &&
        metPartner !== null &&
        metPartner !== 'makiko' &&
        metPartner !== 'toyoppi' &&
        state.nightAction !== 'pisuTalk'
      ) {
        push(MOOD.jealousy, `${CHAR_NAMES[metPartner]}のほうを選んだ`)
      }

      // ③ とよっぴー(まきこの母)。顔を出さないと怒り、まきこがその分を被る
      const toyoNeglect = metPartner === 'toyoppi' ? 0 : state.toyoNeglect + 1
      if (metPartner === 'toyoppi') {
        push(TOYO.visitMoodGain, 'とよっぴーに顔を出した')
      } else if (toyoNeglect >= TOYO.angerAfterDays) {
        push(TOYO.moodPenalty, `とよっぴーが怒っている(${toyoNeglect}日会っていない)`)
      }

      const moodDelta = report.reduce((sum, r) => sum + r.delta, 0)
      const mood = clampMood(state.mood + moodDelta)

      // ③ 記憶度の自然減少。機嫌がよいと、まきこが皆に声をかけてくれる
      const relief =
        (mood >= MOOD.goodFrom ? MOOD_GOOD.decayRelief : 0) +
        (has(state, 'letter') ? REWARD_EFFECT.letterRelief : 0)
      const decay =
        Math.max(0, NIGHT.memoryDecay - relief) * (state.apathy ? NIGHT.apathyDecayMultiplier : 1)

      const deltas: Partial<Record<PartnerId, number>> = {}
      for (const id of PARTNER_IDS) {
        const extra =
          state.ignoredInvitation && state.invitation === id ? INVITATION.ignorePenalty : 0
        deltas[id] = -(decay + extra)
      }
      const moved = applyMany({ ...state, day: nextDay }, deltas, nextDay)

      const samishii = clamp(
        state.emotions.samishii +
          (state.equipped.includes('samishii') ? NIGHT.samishiiEquipGain : 0),
      )

      // ④ 機嫌がいい状態で寝た連続日数
      const moodStreak = mood >= MOOD.goodFrom ? state.moodStreak + 1 : 0

      const slept: GameState = {
        ...state,
        day: nextDay,
        phase: 'morning',
        memories: moved.memories,
        equipped: [],
        pending: null,
        nightAction: null,
        nightTarget: null,
        ignoredInvitation: false,
        apathy: samishii >= APATHY_THRESHOLD,
        mood,
        moodReport: report,
        moodStreak,
        toyoNeglect,
        emotions: {
          ganbaru: clamp(state.emotions.ganbaru - NIGHT.ganbaruDecay),
          tanoshii: state.emotions.tanoshii,
          samishii,
        },
      }

      if (nextDay > TOTAL_DAYS) {
        return { ...slept, day: state.day, phase: 'ending', ending: judgeEnding(slept) }
      }

      // ⑤ 翌朝の突発イベント(たいてい理不尽)
      const ev = pickEvent(slept.seed)
      const withEvent: GameState = ev.event
        ? {
            ...slept,
            seed: ev.seed,
            mood: clampMood(slept.mood + ev.event.delta),
            event: ev.event,
            moodReport: [...report, { delta: ev.event.delta, reason: '朝からひと悶着' }],
            // 機嫌が落ちたらストリークは切れる
            moodStreak: clampMood(slept.mood + ev.event.delta) >= MOOD.goodFrom ? moodStreak : 0,
          }
        : { ...slept, seed: ev.seed, event: null }

      // ⑥ 誘いと要求を決める
      const invited = pickInvitation(withEvent)
      const d = pickDemand(invited.seed)
      const nextMorning: GameState = {
        ...withEvent,
        invitation: invited.partner,
        demand: d.demand,
        demandSaid: d.said,
        seed: d.seed,
      }

      // ⑦ 機嫌をキープできていればご褒美(2択)
      if (nextMorning.moodStreak > 0 && nextMorning.moodStreak % REWARD_STREAK === 0) {
        const offer = pickRewardOffer(nextMorning, nextMorning.seed)
        if (offer.offer) {
          return { ...nextMorning, seed: offer.seed, rewardOffer: offer.offer, phase: 'reward' }
        }
      }
      return nextMorning
    }
  }
}

/**
 * まきこの今日の言い方と、そこから考えられる要求。
 * ご褒美「本音メモ」を持っていると、本当の要求まで分かる。
 */
export function demandText(state: GameState): {
  said: string
  hint: string | null
  candidates: string[]
} {
  return {
    said: state.demandSaid,
    hint: has(state, 'secret') ? DEMAND_HINT[state.demand] : null,
    candidates: demandCandidates(state.demandSaid).map((d) => DEMAND_HINT[d]),
  }
}
