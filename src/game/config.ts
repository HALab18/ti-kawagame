import type {
  CharId,
  DemandId,
  EmotionId,
  ForgetStage,
  PartnerId,
  PrizeId,
  RewardId,
} from './types'

/**
 * 数値はすべてここに集約する。バランス調整でロジックを触らないための境界。
 */

export const PLAYER_ID: CharId = 'rimicchi'
export const PARTNER_IDS: readonly PartnerId[] = ['pisu', 'makiko', 'toyoppi']
export const EMOTION_IDS: readonly EmotionId[] = ['ganbaru', 'tanoshii', 'samishii']

export const CHAR_NAMES: Record<CharId, string> = {
  rimicchi: 'りみっち',
  pisu: 'ぴす',
  makiko: 'まきこ',
  toyoppi: 'とよっぴー',
}

export const EMOTION_NAMES: Record<EmotionId, string> = {
  ganbaru: 'がんばる',
  tanoshii: 'たのしい',
  samishii: 'さみしい',
}

export const MAX_EQUIPPED = 2
export const TOTAL_DAYS = 30

/** ゲージ・記憶度の共通上下限 */
export const GAUGE_MIN = 0
export const GAUGE_MAX = 100

export const INITIAL_EMOTIONS: Record<EmotionId, number> = {
  ganbaru: 60,
  tanoshii: 55,
  samishii: 20,
}

export const INITIAL_MEMORY = 85

/**
 * ══ 記憶度 ══
 * 「その相手が **りみっち** を覚えている度合い」。忘れられる側はこちら。
 *
 * ゲージだけ置いても意味が伝わらないので、次の2点を必ず守る:
 *  1. 段階ごとに「今できなくなること」が1つ以上ある(MEMORY_NEXT)
 *  2. 目的(まきこの機嫌)に直結する経路がある(MEMORY_TRUST)
 */

/**
 * まきこがこちらを忘れているほど、要求に応えても喜ばない。
 * これが「記憶度を保つ理由」の本線。
 */
export const MEMORY_TRUST: Record<ForgetStage, number> = {
  0: 1,
  1: 0.6,
  2: 0.35,
  3: 0.2,
}

/** 忘却段階の見え方 */
export const STAGE_LABEL: Record<ForgetStage, string> = {
  0: '名前で呼んでくれる',
  1: '「あなた」と呼ぶ',
  2: '表情がすくない',
  3: 'こちらを知らない',
}

/** 相手ごとに「覚えていてもらえると何ができるか」 */
export const MEMORY_ROLE: Record<PartnerId, string> = {
  pisu: 'ガチャと取りなしを頼める',
  makiko: '応えたときに喜んでくれる',
  toyoppi: '「大丈夫だよ」を聞ける',
}

/**
 * その段階に落ちたとき、実際に失うもの。
 * まきこは MEMORY_TRUST から文言を組むので持たない。
 */
export const MEMORY_NEXT: Record<PartnerId, Partial<Record<ForgetStage, string>>> = {
  pisu: {
    1: '名前で呼ばれなくなる',
    2: 'ガチャも取りなしも頼めなくなる',
    3: '誘ってこなくなる',
  },
  makiko: {},
  toyoppi: {
    1: '「大丈夫だよ」が聞けなくなる',
    2: '表情がなくなる',
    3: '誘ってこなくなる',
  },
}

/** 作業(WORK)時のゲージ変動 */
export const WORK = {
  /** 基礎収穫量。がんばるゲージと装備で増える */
  baseHarvest: 2,
  /** がんばる装備時の収穫倍率 */
  equipMultiplier: 1.5,
  /** 一人で作業するので「たのしい」が減る */
  tanoshiiDrop: 12,
  /** たのしい装備中は減りが半分 */
  tanoshiiDropEquippedRate: 0.5,
  /** 誰にも会っていないので「さみしい」が増える */
  samishiiGain: 14,
  /** 時間経過で「がんばる」が減る */
  ganbaruDrop: 8,
} as const

/** 会う(MEET)時のゲージ・記憶度変動 */
export const MEET = {
  /** 会話成功時の記憶度回復 */
  memoryGain: 28,
  /** 失敗時でも顔を合わせた分は回復する */
  memoryGainOnFail: 10,
  /** さみしい装備中は「会いたい」が強いので回復が伸びる(ハイリスク側の見返り) */
  samishiiEquipBonus: 1.4,
  /** 会話成功率の基礎値 */
  baseSuccess: 0.45,
  /** たのしいゲージ100で +0.5 */
  tanoshiiSuccessScale: 0.005,
  /** たのしい装備時の上乗せ */
  tanoshiiEquipBonus: 0.15,
  /** 無気力状態では会話が噛み合わない */
  apathySuccessRate: 0.5,
  /** 接触したので「たのしい」が回復する(回復手段はこれだけ) */
  tanoshiiGain: 20,
  samishiiDrop: 30,
  ganbaruDrop: 8,
} as const

/**
 * 「待っている相手」。朝に1人だけ提示され、応えると大きく回復する。
 * stage3(初対面リセット)の相手は誘ってこない = 放置すると誘いそのものが減る。
 */
export const INVITATION = {
  /** 応えたときの記憶度倍率 */
  answerMultiplier: 1.5,
  /** 応えたときのおまけ収穫 */
  answerHarvest: 1,
  /** 無視して寝たときの追加忘却 */
  ignorePenalty: 5,
  /** 誘い主を選ぶとき、記憶度が最も低い相手が選ばれる確率 */
  lowestBias: 0.6,
} as const

/** 会った相手が話題にする相手。伝聞で少しだけ思い出してもらえる */
export const BEST_FRIEND: Record<PartnerId, PartnerId | null> = {
  pisu: 'makiko',
  makiko: 'pisu',
  /** とよっぴーは誰の話もしない */
  toyoppi: null,
}
export const HEARSAY_GAIN = 5

/** 思い出(収集物) */
export const KEEPSAKE = {
  /** 入手判定の基礎確率。会話成功時のみ抽選する */
  baseChance: 0.12,
  /** たのしいゲージ100で +0.2 */
  tanoshiiScale: 0.002,
  /** 本人に見せたときの回復量。忘却段階を一気に戻せる切り札 */
  showGain: 40,
  /**
   * 同時に持てる上限。溜め込みを禁じることで
   * 「今使うか、もっと危ない日まで取っておくか」を毎晩の判断にする。
   */
  maxHeld: 3,
} as const

/** 思い出のテキスト。入手時に種で1つ選ぶ */
export const KEEPSAKE_TEXTS: Record<PartnerId, readonly string[]> = {
  pisu: [
    'まかないの炒飯を、鍋ごと持ってきた',
    '「うちの火力すごいから」と、三回言った',
    '出汁の取り方を教わったのに、量が全部どんぶり単位だった',
  ],
  makiko: [
    '黙って弁当の詰め方を直してくれていた',
    'こちらの分の休憩まで数に入れていた',
    '「無理してない?」だけ聞いて、あとは黙っていた',
  ],
  toyoppi: [
    'ずっと同じ場所で、同じ顔で待っていた',
    '「まきこは昔からああなの」と、笑って言った',
    'こちらの名前を、一度も間違えなかった',
  ],
}

/** 夜の贈り物 */
export const GIFT = {
  itemCost: 1,
  memoryGain: 12,
} as const

/** 夜: 休む。がんばるの唯一の回復手段 */
export const REST = {
  ganbaruGain: 25,
  samishiiDrop: 5,
} as const

/**
 * ぴすのガチャガチャ。
 * まきこが本当に好きなものは開始時にランダムで決まり、プレイヤーには見えない。
 * 引いた反応(機嫌の伸び)で「これは好きだ」と分かっていくので、
 * 周回するほど狙って当てられるようになる。
 */
export const GACHA = {
  /** 仕込みをこれだけ渡して回してもらう */
  itemCost: 2,
  /** 好きなものを初めて引いたとき */
  hitMood: 25,
  /** 好きなものだが、すでに持っているとき(喜びは薄れる) */
  repeatHitMood: 8,
  /** 好きではなかったとき。それでも気持ちは伝わる */
  missMood: 3,
  /** ぴすがこの段階を超えて忘れていると頼めない */
  clearStage: 1,
  /** まきこが好きな景品の数 */
  likeCount: 2,
} as const

export const PRIZES: Record<PrizeId, { name: string; emoji: string }> = {
  kuma: { name: 'くまのフィギュア', emoji: '🧸' },
  usagi: { name: 'うさぎのキーホルダー', emoji: '🐰' },
  neko: { name: 'ねこのマスコット', emoji: '🐱' },
  hoshi: { name: '星のブローチ', emoji: '⭐' },
  hana: { name: '花のヘアピン', emoji: '🌸' },
  tsuki: { name: '月のチャーム', emoji: '🌙' },
  ribon: { name: 'リボンのバッジ', emoji: '🎀' },
  ringo: { name: 'りんごのミニポーチ', emoji: '🍎' },
}

export const PRIZE_IDS = Object.keys(PRIZES) as PrizeId[]

/**
 * とよっぴーは まきこの母。
 * 顔を出さないと怒り、その矛先はこちらではなく **まきこの機嫌** に向かう。
 * 「まきこの要求に応える」と「とよっぴーにも顔を出す」の板挟みがこのゲームの芯。
 */
export const TOYO = {
  /** 何日会わないと怒るか */
  angerAfterDays: 4,
  /** 怒っているあいだ、毎晩まきこの機嫌が下がる */
  moodPenalty: -12,
  /** 顔を出した日は、まきこも助かる */
  visitMoodGain: 8,
} as const

/**
 * 夜: とよっぴーの「忘れても大丈夫だよ」を聞く。
 * さみしいが即座に軽くなる代わりに、全員の記憶度がわずかに削れる。
 * 短期的には得だが、繰り返すと隠しエンドへ寄っていく。
 */
export const WHISPER = {
  samishiiDrop: 35,
  memoryCost: 4,
  /** とよっぴーがこの段階以下(=まだ覚えている)でないと聞けない */
  requiresStage: 0,
} as const

/**
 * ══ まきこ ══
 * このゲームの目的は「まきこの機嫌を保つこと」。
 * まきこは要求を遠回しにしか言わず、こちらが正解を当てないと機嫌が下がる。
 * さらに理由を言わずに不機嫌になる日がある。
 */
export const MOOD_MAX = 100
export const INITIAL_MOOD = 50

/** 要求を満たした/外したときの機嫌の増減 */
export const MOOD = {
  /** 要求どおりにできた */
  satisfied: 14,
  /** 要求を無視した */
  ignored: -12,
  /** 「ひとりにして」の日に会いに行った(いちばん怒る) */
  intruded: -20,
  /** 「ぴすと仲良くして」に応えた */
  showFriend: 12,
  /** 「ぴすと仲良くして」を無視した */
  showFriendMissed: -8,
  /** まきこ以外に会った日の嫉妬(visit / gift の日だけ) */
  jealousy: -5,
  /** 理由のない不機嫌 */
  moody: -8,
  /** 理由のない不機嫌が起きる確率 */
  moodyChance: 0.15,
  /** この値以上で「機嫌がいい」 */
  goodFrom: 70,
  /** この値未満で「つっけんどん」 */
  coldBelow: 30,
} as const

/** 機嫌がいいときの見返り */
export const MOOD_GOOD = {
  /** まきこが皆に声をかけてくれるので、全員の忘却がゆるやかになる */
  decayRelief: 3,
  /** 手伝ってくれるので収穫が増える */
  harvestBonus: 1,
  /** まきこ自身との会話も伸びる */
  memoryMultiplier: 1.2,
} as const

/** 機嫌が悪いときの罰 */
export const MOOD_COLD = {
  /** つっけんどんなので会話が通じにくい */
  successMultiplier: 0.6,
  /** 会えても記憶度が戻りにくい */
  memoryMultiplier: 0.5,
} as const

/** 要求ごとの「正解の行動」の説明。ご褒美「本音メモ」があると読める */
export const DEMAND_HINT: Record<DemandId, string> = {
  visit: 'まきこに会いに行く',
  gift: '夜にまきこへ贈り物かスイーツ',
  alone: 'まきこには会わない（会うといちばん怒る）',
  showFriend: 'ぴすに会いに行く',
}

/**
 * まきこの言い方。
 * **1つのセリフが複数の意味を持つ**のがこのゲームの核心で、
 * 「今日はひま」が「来て」なのか「ほっといて」なのかは本人しか知らない。
 * 言い方から要求を一意に当てられないので、ご褒美の「本音メモ」に価値が出る。
 */
export const DEMAND_LINES: ReadonlyArray<{ text: string; for: readonly DemandId[] }> = [
  { text: '「今日はひま。……べつに来なくてもいいけど」', for: ['visit', 'alone'] },
  { text: '「べつに、いい」', for: ['visit', 'alone'] },
  { text: '「……なんでもない」', for: ['visit', 'alone', 'gift'] },
  { text: '「今日はいそがしいから、いい」', for: ['alone'] },
  { text: '「たまには一人の時間がほしいかも」', for: ['alone', 'showFriend'] },
  { text: '「そういえば最近、なんにもくれないよね」', for: ['gift'] },
  { text: '「あのお店の前、通った?」', for: ['gift', 'visit'] },
  { text: '「ぴすと仲良くしてるとこ、見たことないかも」', for: ['showFriend'] },
  { text: '「ぴすは元気にしてるの?」', for: ['showFriend', 'visit'] },
]

/** そのセリフがありうる要求の一覧(UIの「たぶんこう?」表示に使う) */
export function demandCandidates(said: string): readonly DemandId[] {
  return DEMAND_LINES.find((l) => l.text === said)?.for ?? []
}

/**
 * スイーツ。作業中に見つかる。夜に渡すと機嫌が直る、いちばん素直な手段。
 * 「まきこに会わない日(=嫉妬される日)」に仕込みができる、という形にしてある。
 */
export const SWEETS = {
  /** 作業でスイーツが見つかる確率 */
  findChance: 0.35,
  /** がんばる装備中はよく見つかる */
  findChanceEquipped: 0.5,
  /** 渡したときの機嫌 */
  moodGain: 20,
  /** 「なんにもくれない」の日に渡すと、贈り物より喜ぶ */
  demandBonus: 6,
} as const

/**
 * ぴすの特技。昼にぴすに会った夜だけ選べる。
 * 「今日あったこと」をぴすがまきこに話して取りなしてくれる。
 * 要求を外した日のリカバリーになるが、夜の1回を使う。
 */
export const PISU_TALK = {
  moodGain: 14,
  /** ぴす自身が忘れかけていると、うまく話せない */
  fadedMoodGain: 5,
  /** この段階を超えると fadedMoodGain になる */
  clearStage: 1,
} as const

/**
 * 突発イベント。朝に起きていて、たいてい理不尽。
 * これがあるので「完璧な立ち回り」だけでは機嫌を維持できない。
 */
export const EVENTS: ReadonlyArray<{ text: string; delta: number }> = [
  {
    text: '洗濯機にティッシュが入っていた。まきこが怒っている。全部やり直しだ。',
    delta: -15,
  },
  { text: 'まきこが「昨日の言い方、ちょっと気になってた」と言い出した。', delta: -10 },
  { text: '干しておいた洗濯物が落ちていた。まきこは何も言わないが、目が合わない。', delta: -8 },
  { text: 'まきこの分のお茶を、うっかり自分が飲んでいた。', delta: -7 },
  { text: 'まきこが早起きしていて、こちらが寝ていたことを根に持っている。', delta: -6 },
  { text: 'まきこは理由を言わないが、なんだか不機嫌だ。', delta: -8 },
  /** 救いも少しだけ入れる(引き続けたくなるように) */
  { text: 'まきこの好きな花が咲いていた。機嫌がいい。', delta: 10 },
  { text: 'まきこが朝ごはんを多めに作っていた。', delta: 8 },
]
/** 朝にイベントが起きる確率 */
export const EVENT_CHANCE = 0.3

/**
 * ご褒美。機嫌がいい状態で寝続けると、3日ごとに2択で1つ選べる。
 * 恒久効果なので、続けるほど攻略が楽になる。
 */
export const REWARD_STREAK = 4

export const REWARDS: Record<RewardId, { name: string; note: string }> = {
  bento: { name: 'おべんとう', note: '作業の収穫 +2' },
  letter: { name: '交換日記', note: '毎晩の忘却が 2 ゆるやかになる' },
  charm: { name: 'おまもり', note: '会話が通じる確率 +15%' },
  tea: { name: 'お茶の時間', note: '「休む」で がんばる +40 になる' },
  photo: { name: '写真', note: '思い出を 2 つ多く持てる' },
  secret: { name: 'まきこの本音メモ', note: '要求が遠回しでなく、はっきり分かる' },
}

export const REWARD_EFFECT = {
  bentoHarvest: 2,
  letterRelief: 2,
  charmSuccess: 0.15,
  teaGanbaru: 40,
  photoSlots: 2,
} as const

/** 機嫌の段階ごとのまきこの態度 */
export const MOOD_MOODS: ReadonlyArray<{ from: number; label: string }> = [
  { from: 85, label: 'ごきげん' },
  { from: 70, label: 'わるくない' },
  { from: 45, label: 'ふつう' },
  { from: 30, label: 'ちょっと不満' },
  { from: 1, label: 'つっけんどん' },
  { from: 0, label: '口をきかない' },
]

/** 就寝時の自然減少 */
export const NIGHT = {
  /**
   * 6 だと交互(作業/会う)で全員維持できてしまい二者択一が緊張しない。
   * 10 にすると「毎日会う」だけでは足りず、さみしい装備の賭けが必要になる。
   * scripts/simulate.ts で検証済み。
   */
  memoryDecay: 10,
  /** 無気力状態だと忘却が加速する */
  apathyDecayMultiplier: 2,
  ganbaruDecay: 5,
  /** さみしい装備中は寝ても寂しさが残る */
  samishiiEquipGain: 10,
} as const

/** さみしいがこの値以上で無気力状態に入る */
export const APATHY_THRESHOLD = 80

/**
 * 忘却段階の下限しきい値。value >= thresholds[stage] なら その stage。
 * 0:通常 / 1:「あなた」呼び / 2:固定表情 / 3:初対面リセット
 */
export const STAGE_THRESHOLDS: Record<Exclude<ForgetStage, 3>, number> = {
  0: 70,
  1: 40,
  2: 15,
}

/** stage3 に落ちてから この日数以内なら早期回復できる(会話ログの一部保持) */
export const GRACE_DAYS = 5
/** 猶予内に会えたときの記憶度の底上げ先 */
export const GRACE_RECOVERY_TO = 45

/** エンディング判定 */
export const ENDING = {
  /** まきこの機嫌がこれ以上で真のクリア */
  moodPerfect: 85,
  /** これ以上ならまあ満足 */
  moodOk: 55,
  /** これ以下だと口をきいてもらえない */
  moodCold: 25,
  /** とよっぴールート: 総会話数のこの割合以上をとよっぴーに使った */
  toyoppiShare: 0.6,
  toyoppiMemoryMin: 80,
  /** 「大丈夫だよ」をこの回数以上聞いてもルートに入る */
  whisperCount: 8,
} as const

/**
 * ══ 目的の言い方 ══
 * 目的は「30日後のまきこのごきげん」ひとつだけ。
 * 記憶度・仕込み・スイーツは、ぜんぶそのための手だて。
 *
 * 表現がぶれると「どっちが目的なのか」が分からなくなるので、
 * UI で目的に触れるときは必ずここの文言を使う。
 */
export const GOAL_TEXT = {
  aim: `30日後、まきこのごきげんを ${ENDING.moodPerfect} 以上にする`,
  short: `めあて ${ENDING.moodPerfect}`,
  pass: `${ENDING.moodOk} 以上なら「まあ満足」`,
  read: 'まきこは要求を遠回しにしか言わない。当てると機嫌が上がる',
  means: '記憶度・仕込み・スイーツは、ぜんぶ機嫌をとるための手だて',
  memoryIsMeans: '忘れられると、機嫌をとる手が減る',
} as const
