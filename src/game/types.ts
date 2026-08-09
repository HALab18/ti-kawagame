/** キャラクターID(characters.svg の <g id> と一致させる) */
export type CharId = 'rimicchi' | 'pisu' | 'makiko' | 'toyoppi'

/** 記憶度を持つ相手。プレイヤー(りみっち)自身は含まない */
export type PartnerId = Exclude<CharId, 'rimicchi'>

export type EmotionId = 'ganbaru' | 'tanoshii' | 'samishii'

/** 1日のどこにいるか。フェーズ遷移は reducer が一方向にのみ進める */
export type Phase = 'morning' | 'day' | 'evening' | 'night' | 'reward' | 'ending'

/**
 * まきこの機嫌を保ち続けると貰える恒久アップグレード。
 * 2択で1つ選ぶ形にして、周回ごとに違う組み立てになるようにしている。
 */
export type RewardId = 'bento' | 'letter' | 'charm' | 'tea' | 'photo' | 'secret'

/** 忘却の3段階。0=通常, 1=「あなた」呼び, 2=固定表情, 3=初対面リセット */
export type ForgetStage = 0 | 1 | 2 | 3

export type EndingId =
  /** まきこの機嫌を最後まで保った(真のクリア) */
  | 'makikoPerfect'
  /** まきこはまあ満足している */
  | 'makikoOk'
  /** まきこが口をきかなくなった */
  | 'makikoCold'
  /** 誰かを完全に忘れさせた */
  | 'forgotten'
  /** とよっぴー隠しエンド */
  | 'toyoppi'
  | 'neutral'

/**
 * まきこの「今日の要求」。
 * 遠回しな言い方で提示されるので、素直に読むと外す。
 */
export type DemandId =
  /** 会いに来てほしい */
  | 'visit'
  /** 贈り物がほしい */
  | 'gift'
  /** 今日はほうっておいてほしい(会いに行くと逆効果) */
  | 'alone'
  /** ぴすと仲良くしているところを見せてほしい */
  | 'showFriend'

/**
 * 夜にできることは1つだけ。何を選んだか。
 * pisuTalk は「昼にぴすに会った日」だけ選べる、ぴすの特技。
 */
export type NightActionId =
  | 'rest'
  | 'gift'
  | 'sweets'
  | 'keepsake'
  | 'whisper'
  | 'pisuTalk'
  | 'gacha'

/** ぴすがガチャガチャで引いてくる景品 */
export type PrizeId =
  | 'kuma'
  | 'usagi'
  | 'neko'
  | 'hoshi'
  | 'hana'
  | 'tsuki'
  | 'ribon'
  | 'ringo'

export interface MemoryState {
  /** 0〜100 */
  value: number
  stage: ForgetStage
  /** stage3 に落ちた日。早期回復(猶予)判定に使う */
  resetDay: number | null
  /** 一度でも stage3 に落ちたか。会話ログの一部保持フラグ */
  everReset: boolean
}

/**
 * 「思い出」。会話がよく通じた日に手に入る収集物。
 * あとで本人に見せると記憶度が大きく戻るが、1回で消える。
 */
export interface Keepsake {
  id: string
  partner: PartnerId
  text: string
  /** 手に入れた日 */
  day: number
}

/** 昼の行動の結果。夕方に可視化するため一時保持する */
export interface DayResult {
  kind: 'work' | 'meet'
  partner: PartnerId | null
  /** 会話成功したか(work のときは null) */
  success: boolean | null
  /** 収穫アイテム数 */
  harvest: number
  /** 作業中に見つけたスイーツ */
  sweetsFound: number
  /** 記憶度の増減。夕方の演出でそのまま使える */
  deltas: Partial<Record<PartnerId, number>>
  /** 忘却段階が変化した相手 */
  stageChanges: Array<{ partner: PartnerId; from: ForgetStage; to: ForgetStage }>
  /** 待っていた相手に応えたか */
  answeredInvitation: boolean
  /** 手に入った思い出 */
  keepsakeGained: Keepsake | null
  /** 会った相手が話題にした第三者(伝聞で少し思い出してもらえる) */
  hearsay: PartnerId | null
}

export interface LogEntry {
  day: number
  text: string
}

export interface GameState {
  day: number
  phase: Phase
  /** 乱数の種。state に持たせることで reducer を純関数に保つ */
  seed: number
  emotions: Record<EmotionId, number>
  /** 同時装備は2つまで */
  equipped: EmotionId[]
  /** さみしいが閾値を超えた無気力状態 */
  apathy: boolean
  memories: Record<PartnerId, MemoryState>
  /** 贈り物に使う収穫物 */
  items: number
  /** まきこの機嫌を直すスイーツ */
  sweets: number
  /** 誰と何回会ったか。隠しエンド判定に使う */
  meetCounts: Record<PartnerId, number>
  /** 今日「待っている」相手。応えると大きく回復する */
  invitation: PartnerId | null
  /** 誘いを無視したまま昼を終えたか(夜に追加の忘却が起きる) */
  ignoredInvitation: boolean
  /** 集めた思い出 */
  keepsakes: Keepsake[]
  /** 夜に選んだ行動(1日1回だけ) */
  nightAction: NightActionId | null
  /** 夜の行動の相手(贈り物・思い出の話) */
  nightTarget: PartnerId | null
  /** まきこの機嫌 0〜100。このゲームの目的 */
  mood: number
  /** まきこの今日の要求(本人しか知らない) */
  demand: DemandId
  /** まきこが実際に言ったセリフ。複数の要求を指しうるので断定できない */
  demandSaid: string
  /** とよっぴーに何日会っていないか。溜まると怒ってまきこの機嫌が下がる */
  toyoNeglect: number
  /** まきこが本当に好きな景品。開始時に決まる隠しパラメータ */
  makikoLikes: PrizeId[]
  /** 引いて反応を見たことで「好きだ」と分かった景品 */
  knownLikes: PrizeId[]
  /** これまでに引いた景品(かぶり判定に使う) */
  drawnPrizes: PrizeId[]
  /** 直近のガチャ結果。夜の演出に使う */
  lastPrize: { prize: PrizeId; hit: boolean; repeat: boolean } | null
  /** 昨夜の機嫌の増減とその理由(朝に見せる) */
  moodReport: Array<{ delta: number; reason: string }>
  /** 今朝起きた突発イベント(たいてい理不尽) */
  event: { text: string; delta: number } | null
  /** 機嫌がいい状態で寝た連続日数 */
  moodStreak: number
  /** 取得済みのご褒美(恒久効果) */
  rewards: RewardId[]
  /** ご褒美の2択。phase === 'reward' のあいだ提示される */
  rewardOffer: RewardId[] | null
  /** とよっぴーの「大丈夫だよ」を聞いた回数 */
  whispers: number
  pending: DayResult | null
  log: LogEntry[]
  ending: EndingId | null
}

export type GameAction =
  /** 朝: 感情を装備して昼へ */
  | { type: 'equip'; emotions: EmotionId[] }
  /** 昼: 一人で作業する */
  | { type: 'work' }
  /** 昼: 誰かに会う */
  | { type: 'meet'; partner: PartnerId }
  /** 夕方: 増減の確認を終えて夜へ */
  | { type: 'advance' }
  /** 夜: 休む(がんばるを回復) */
  | { type: 'rest' }
  /** 夜: 贈り物(アイテム1消費) */
  | { type: 'gift'; partner: PartnerId }
  /** 夜: まきこにスイーツを渡す */
  | { type: 'giveSweets' }
  /** 夜: 思い出を見せる(思い出1消費) */
  | { type: 'showKeepsake'; keepsakeId: string }
  /** 夜: とよっぴーの「忘れても大丈夫だよ」を聞く */
  | { type: 'whisper' }
  /** 夜: ぴすに今日のことを話してもらう(昼にぴすに会った日だけ) */
  | { type: 'pisuTalk' }
  /** 夜: ぴすにガチャガチャを回してもらう */
  | { type: 'gacha' }
  /** ご褒美を1つ選ぶ */
  | { type: 'chooseReward'; reward: RewardId }
  /** 夜: 就寝。自然減少を適用して翌朝へ */
  | { type: 'sleep' }
  | { type: 'reset'; seed?: number }
