import { useState } from 'react'
import {
  CHAR_NAMES,
  DEMAND_HINT,
  EMOTION_IDS,
  EMOTION_NAMES,
  GACHA,
  GIFT,
  KEEPSAKE,
  MAX_EQUIPPED,
  MEET,
  MEMORY_TRUST,
  MOOD,
  MOOD_GOOD,
  MOOD_MAX,
  NIGHT,
  PISU_TALK,
  PRIZES,
  REST,
  REWARDS,
  REWARD_STREAK,
  STAGE_THRESHOLDS,
  SWEETS,
  TOTAL_DAYS,
  WHISPER,
} from '../game/config'
import { demandText, has, keepsakeLimit } from '../game/reducer'
import {
  canGacha,
  canGift,
  canGiveSweets,
  canPisuTalk,
  canShowKeepsake,
  canWhisper,
  isFaded,
  prizeBook,
  streakToReward,
} from '../game/selectors'
import type { PartnerView } from '../game/selectors'
import type { EmotionId, EndingId, ForgetStage, PartnerId } from '../game/types'
import { useGame } from '../game/useGame'
import { Character } from './Character'

const ENDING_TEXT: Record<EndingId, { title: string; body: string }> = {
  makikoPerfect: {
    title: 'まきこはごきげんだった',
    body: '「まあ、あなたがいてくれてよかったかもね」。それだけ言って、まきこは笑った。',
  },
  makikoOk: {
    title: 'まきこはまあ満足している',
    body: '大きな喧嘩はなかった。それだけでも、たいしたことだと思う。',
  },
  makikoCold: {
    title: 'まきこは口をきいてくれない',
    body: '理由は聞けなかった。たぶん、ひとつではないのだろう。',
  },
  forgotten: {
    title: 'それでも島は続く',
    body: 'もう名前で呼ばれることはなかった。島の暮らしは、変わらず続いていく。',
  },
  toyoppi: {
    title: '「忘れても大丈夫だよ」',
    body: 'とよっぴーだけが、最初と同じ顔で笑っていた。だれの機嫌も、もう気にしなくてよかった。',
  },
  neutral: {
    title: 'すこしずつ、あいまいに',
    body: '覚えている顔と、思い出せない顔があった。',
  },
}

const GAUGE_NOTE: Record<EmotionId, string> = {
  ganbaru: '収穫が増える',
  tanoshii: '話が通じやすくなる / 思い出が残りやすい',
  samishii: '会えたときの回復が増える(溜まると無気力)',
}

/** 記憶度バーに引く段階の目盛り。ここを下回ると呼び方や頼めることが変わる */
const STAGE_MARKS = [STAGE_THRESHOLDS[0], STAGE_THRESHOLDS[1], STAGE_THRESHOLDS[2]]

/** 記憶度の段階のはしご。しきい値と、そこで実際に変わることを並べて見せる */
const LADDER: Array<{ stage: ForgetStage; at: string; what: string }> = [
  { stage: 0, at: `${STAGE_THRESHOLDS[0]}〜100`, what: '名前で呼んでくれる。ぜんぶ頼める' },
  {
    stage: 1,
    at: `${STAGE_THRESHOLDS[1]}〜${STAGE_THRESHOLDS[0] - 1}`,
    what: '「あなた」と呼ばれる。とよっぴーの話は聞けない',
  },
  {
    stage: 2,
    at: `${STAGE_THRESHOLDS[2]}〜${STAGE_THRESHOLDS[1] - 1}`,
    what: '表情が消える。ぴすに頼みごとが通らない',
  },
  {
    stage: 3,
    at: `${STAGE_THRESHOLDS[2] - 1} 以下`,
    what: '初対面に戻る。誘ってこない・思い出が色あせる',
  },
].map((row) => ({
  ...row,
  stage: row.stage as ForgetStage,
  // まきこの記憶度は目的に直結しているので、段ごとの目減りも書いておく
  what: `${row.what}（まきこなら喜び ${Math.round(MEMORY_TRUST[row.stage as ForgetStage] * 100)}%）`,
}))

type NightMode = 'menu' | 'gift' | 'keepsake'
/** 下から出るシート。持ち物と、記憶の説明 */
type SheetId = 'stock' | 'memory' | null

export function App() {
  const game = useGame()
  const { state } = game

  const [draft, setDraft] = useState<EmotionId[]>([])
  const [picking, setPicking] = useState(false)
  const [nightMode, setNightMode] = useState<NightMode>('menu')
  const [sheet, setSheet] = useState<SheetId>(null)

  const toggle = (e: EmotionId) =>
    setDraft((prev) =>
      prev.includes(e)
        ? prev.filter((x) => x !== e)
        : prev.length >= MAX_EQUIPPED
          ? prev
          : [...prev, e],
    )

  const invited = state.invitation ? game.partners.find((p) => p.id === state.invitation) : null
  const makiko = game.partners.find((p) => p.id === 'makiko')!
  const demand = demandText(state)

  return (
    <div className="app">
      <header className="hud">
        <div className="hud__row">
          <span className="hud__day">
            {state.day}
            <small> / {TOTAL_DAYS}日</small>
          </span>
          <span className="hud__phase">{phaseLabel(state.phase)}</span>
          <button type="button" className="hud__stock" onClick={() => setSheet('stock')}>
            🌾{state.items} 🍰{state.sweets} 🫧{state.keepsakes.length}
          </button>
        </div>

        {/* まきこの機嫌がこのゲームの目的なので、いちばん大きく出す */}
        <div className={`mood ${state.mood >= 70 ? 'is-good' : ''} ${state.mood < 30 ? 'is-cold' : ''}`}>
          <Character id="makiko" face={makiko.face} animated={makiko.animated} className="chr--xs" />
          <div className="mood__main">
            <div className="mood__head">
              <span>まきこのごきげん</span>
              <span className="mood__label">
                {game.moodLabel} <b>{state.mood}</b>
              </span>
            </div>
            <div className="mood__track">
              <div className="mood__fill" style={{ width: `${(state.mood / MOOD_MAX) * 100}%` }} />
              {/* 目標ラインを出して、どこを目指すのか一目で分かるようにする */}
              <span className="mood__goal" style={{ left: '85%' }} />
            </div>
            <small className="mood__streak">
              {state.mood >= 70
                ? `ごきげん ${state.moodStreak}日連続 / あと${streakToReward(state, REWARD_STREAK)}日でごほうび`
                : 'ごきげんを70以上で保つとごほうびがもらえる'}
            </small>
          </div>
        </div>

        {/* 動かしているのは りみっち。3つのゲージが誰のものか分かるよう本人と並べる */}
        <div className="me">
          <div className="me__who">
            <Character
              id="rimicchi"
              face={game.me.face}
              animated={game.me.animated}
              className="chr--xs"
            />
            <span className="me__name">
              {game.me.name}
              <small>{game.me.job}・あなた</small>
            </span>
            <p className="me__line">{game.me.line}</p>
          </div>
          <div className="gauges">
            {EMOTION_IDS.map((id) => (
              <div key={id} className={`gauge gauge--${id}`}>
                <div className="gauge__head">
                  <span>
                    {EMOTION_NAMES[id]}
                    {state.equipped.includes(id) && <b className="gauge__on">装備中</b>}
                  </span>
                  <span className="gauge__num">{state.emotions[id]}</span>
                </div>
                <div className="gauge__track">
                  <div className="gauge__fill" style={{ width: `${state.emotions[id]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* みんなが「りみっちを覚えている度」。何が起きるかまで常に見せる */}
        <button type="button" className="recall" onClick={() => setSheet('memory')}>
          <span className="recall__title">
            みんなが りみっち を覚えている度<small>タップで説明</small>
          </span>
          {game.partners.map((p) => (
            <span key={p.id} className={`recall__row recall__row--${p.stage}`}>
              <span className="recall__name">{p.name}</span>
              <span className="recall__bar">
                <span className="recall__fill" style={{ width: `${p.memory}%` }} />
              </span>
              <span className="recall__num">{p.memory}</span>
              <span className="recall__effect">{p.effect}</span>
            </span>
          ))}
        </button>

        {game.warnings.length > 0 && (
          <ul className="warn">
            {game.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </header>

      <main className="stage">
        {/* ── ごほうび選択 ─────────────────── */}
        {state.phase === 'reward' && state.rewardOffer && (
          <section className="panel">
            <h2 className="panel__title">まきこがなにか出してきた</h2>
            <p className="panel__note">「……はい。べつに、ごほうびとかじゃないけど」</p>
            <div className="chips">
              {state.rewardOffer.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  onClick={() => game.chooseReward(id)}
                >
                  <span className="chip__name">{REWARDS[id].name}</span>
                  <span className="chip__note">{REWARDS[id].note}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── 朝 ───────────────────────────── */}
        {state.phase === 'morning' && (
          <>
            {state.event && (
              <div className={`event ${state.event.delta > 0 ? 'is-good' : ''}`}>
                <span className="event__label">
                  {state.event.delta > 0 ? '朝から機嫌がいい' : 'ひと悶着'}
                </span>
                <p>{state.event.text}</p>
                <span className="event__delta">
                  ごきげん {state.event.delta > 0 ? `+${state.event.delta}` : state.event.delta}
                </span>
              </div>
            )}

            <div className="demand">
              <span className="demand__label">まきこは今日、こう言っている</span>
              <p className="demand__said">{demand.said}</p>
              {demand.hint ? (
                <span className="demand__hint">→ 本音: {demand.hint}</span>
              ) : (
                <span className="demand__hint demand__hint--vague">
                  → このセリフの意味は
                  {demand.candidates.length > 1
                    ? `${demand.candidates.length}通りある: ${demand.candidates.join(' / ')}`
                    : demand.candidates[0]}
                </span>
              )}

              {/* 前の周回で答え合わせした記録。周回するほど読めるようになる */}
              {game.lineMemo.length > 0 && (
                <span className="demand__memo">
                  📓 前までの記録:{' '}
                  {game.lineMemo
                    .map((m) => `${DEMAND_HINT[m.demand]} ${m.count}回`)
                    .join(' / ')}
                </span>
              )}
            </div>

            {state.moodReport.length > 0 && (
              <ul className="report">
                {state.moodReport.map((r, i) => (
                  <li key={i}>
                    <span>{r.reason}</span>
                    <span className={r.delta > 0 ? 'is-up' : 'is-down'}>
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <section className="panel">
              <h2 className="panel__title">りみっちは今日、どんな気持ちでいる?</h2>
              <p className="panel__note">最大{MAX_EQUIPPED}つまで。選ばずに進んでもいい。</p>
              <div className="chips">
                {EMOTION_IDS.map((id) => {
                  const on = draft.includes(id)
                  const full = !on && draft.length >= MAX_EQUIPPED
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`chip ${on ? 'is-on' : ''}`}
                      aria-pressed={on}
                      disabled={full}
                      onClick={() => toggle(id)}
                    >
                      <span className="chip__name">{EMOTION_NAMES[id]}</span>
                      <span className="chip__note">{GAUGE_NOTE[id]}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ── 昼 ───────────────────────────── */}
        {state.phase === 'day' && !picking && (
          <>
            {invited && (
              <div className="invite">
                <Character
                  id={invited.id}
                  face={invited.face}
                  animated={invited.animated}
                  className="chr--xs"
                />
                <p>
                  <b>{invited.name}</b>が待っているみたい。
                  <small>応えると思い出しやすい / ほうっておくと余計に忘れられる</small>
                </p>
              </div>
            )}
            <section className="panel">
              <h2 className="panel__title">昼になった</h2>
              <p className="panel__note">
                どちらか片方だけ。{demand.said}と言われている。
              </p>
              <div className="choices">
                <button type="button" className="choice" onClick={() => game.work()}>
                  <span className="choice__icon" aria-hidden="true">🍱</span>
                  <span className="choice__label">りみっちのお弁当屋で働く</span>
                  <span className="choice__note">
                    仕込みが増える / スイーツを仕入れられることがある(
                    {Math.round(SWEETS.findChance * 100)}%)
                  </span>
                </button>
                <button type="button" className="choice" onClick={() => setPicking(true)}>
                  <span className="choice__icon" aria-hidden="true">💬</span>
                  <span className="choice__label">誰かに会いに行く</span>
                  <span className="choice__note">
                    りみっちを思い出してもらえる / まきこ以外だと嫉妬されることも
                  </span>
                </button>
              </div>
            </section>
          </>
        )}

        {state.phase === 'day' && picking && (
          <section className="panel">
            <h2 className="panel__title">誰に会う?</h2>
            <div className="cards">
              {game.partners.map((p) => (
                <PartnerCard
                  key={p.id}
                  p={p}
                  onClick={() => {
                    game.meet(p.id)
                    setPicking(false)
                  }}
                />
              ))}
            </div>
            <button type="button" className="link" onClick={() => setPicking(false)}>
              もどる
            </button>
          </section>
        )}

        {/* ── 夕方 ─────────────────────────── */}
        {state.phase === 'evening' && state.pending && (
          <section className="panel">
            <h2 className="panel__title">夕方</h2>

            {state.pending.kind === 'work' ? (
              <p className="result">
                {state.apathy
                  ? '手が動かなかった。'
                  : `仕込みをした。🌾 ${state.pending.harvest} 手に入れた。`}
                {state.pending.sweetsFound > 0 && ' 🍰 スイーツを見つけた。'}
              </p>
            ) : (
              <div className="result result--meet">
                {/* 会いに行ったのは りみっち。二人を並べて「会った」を絵で見せる */}
                <div className="pair">
                  <Character
                    id="rimicchi"
                    face={game.me.face}
                    animated={game.me.animated}
                    bounce={state.pending.success === true}
                    className="chr--md"
                  />
                  <span className="pair__mark" aria-hidden="true">
                    {state.pending.success ? '♪' : '…'}
                  </span>
                  <Character
                    id={state.pending.partner!}
                    face={faceOf(game.partners, state.pending.partner!)}
                    bounce={state.pending.success === true}
                    className="chr--md"
                  />
                </div>
                <p>
                  {CHAR_NAMES[state.pending.partner!]}に会った。
                  <br />
                  {state.pending.success ? '話がよく通じた。' : 'うまく話せなかった。'}
                </p>
                {state.pending.answeredInvitation && (
                  <p className="tag tag--good">待っていてくれた ×1.5</p>
                )}
                {state.pending.hearsay && (
                  <p className="tag">{CHAR_NAMES[state.pending.hearsay]}の話をしてくれた</p>
                )}
              </div>
            )}

            <p className="deltas__title">みんなが りみっち を覚えている度</p>
            <ul className="deltas">
              {game.partners.map((p) => {
                const d = state.pending?.deltas[p.id] ?? 0
                return (
                  <li key={p.id}>
                    <span className="deltas__name">
                      {p.name} <small>{p.memory}</small>
                    </span>
                    <span className="deltas__bar">
                      <span className="deltas__fill" style={{ width: `${p.memory}%` }} />
                    </span>
                    <span className={`deltas__num ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}`}>
                      {d > 0 ? `+${d}` : d < 0 ? d : '±0'}
                    </span>
                  </li>
                )
              })}
            </ul>

            {state.pending.keepsakeGained && (
              <div className="keepsake keepsake--new">
                <span className="keepsake__label">🫧 思い出がひとつ残った</span>
                <p>{state.pending.keepsakeGained.text}</p>
                <small>夜に本人へ話すと、大きく思い出してもらえる(1回で消える)</small>
              </div>
            )}

            {state.pending.stageChanges.map((c) => (
              <p key={c.partner} className="stagechange">
                {c.to > c.from
                  ? `${CHAR_NAMES[c.partner]}の様子が変わった。`
                  : `${CHAR_NAMES[c.partner]}の顔つきが戻った。`}
              </p>
            ))}
          </section>
        )}

        {/* ── 夜 ───────────────────────────── */}
        {state.phase === 'night' && (
          <section className="panel">
            <h2 className="panel__title">夜</h2>

            {state.nightAction !== null ? (
              <>
                {/* ガチャの結果は当たり外れが一目で分かるように大きく出す */}
                {state.nightAction === 'gacha' && state.lastPrize && (
                  <div className={`prize ${state.lastPrize.hit ? 'is-hit' : ''}`}>
                    <span className="prize__emoji" aria-hidden="true">
                      {PRIZES[state.lastPrize.prize].emoji}
                    </span>
                    <span className="prize__name">{PRIZES[state.lastPrize.prize].name}</span>
                    <span className="prize__judge">
                      {state.lastPrize.hit
                        ? state.lastPrize.repeat
                          ? '好きなやつ（でも持ってる）'
                          : 'あたり! これが好きだった'
                        : 'これは好きではなかった'}
                    </span>
                  </div>
                )}
                <p className="result">{state.log.at(-1)?.text}</p>
              </>
            ) : nightMode === 'menu' ? (
              <>
                <p className="panel__note">できるのは、ひとつだけ。</p>
                <div className="choices choices--night">
                  <button
                    type="button"
                    className="choice choice--sweets"
                    disabled={!canGiveSweets(state)}
                    onClick={game.giveSweets}
                  >
                    <span className="choice__icon" aria-hidden="true">🍰</span>
                    <span className="choice__label">スイーツをあげる</span>
                    <span className="choice__note">
                      ごきげん +{SWEETS.moodGain}（所持 {state.sweets}）
                    </span>
                  </button>

                  <button
                    type="button"
                    className="choice choice--gacha"
                    disabled={!canGacha(state)}
                    onClick={game.gacha}
                  >
                    <span className="choice__icon" aria-hidden="true">🎰</span>
                    <span className="choice__label">ぴすにガチャを回してもらう</span>
                    <span className="choice__note">
                      {state.memories.pisu.stage > GACHA.clearStage
                        ? 'ぴすがりみっちを忘れていて、頼みごとが通らない'
                        : `🌾${GACHA.itemCost} → 好きなものを当てれば +${GACHA.hitMood}、はずれは +${GACHA.missMood}`}
                      {state.knownLikes.length > 0 &&
                        `（判明: ${state.knownLikes.map((p) => PRIZES[p].emoji).join('')}）`}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="choice"
                    disabled={!canPisuTalk(state)}
                    onClick={game.pisuTalk}
                  >
                    <span className="choice__icon" aria-hidden="true">🗣️</span>
                    <span className="choice__label">ぴすに話してもらう</span>
                    <span className="choice__note">
                      ごきげん +{PISU_TALK.moodGain} / 嫉妬もなくなる（昼にぴすの店へ行った日だけ）
                    </span>
                  </button>

                  <button type="button" className="choice" onClick={game.rest}>
                    <span className="choice__icon" aria-hidden="true">🛏️</span>
                    <span className="choice__label">休む</span>
                    <span className="choice__note">
                      がんばる +{has(state, 'tea') ? 40 : REST.ganbaruGain}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="choice"
                    disabled={!canGift(state)}
                    onClick={() => setNightMode('gift')}
                  >
                    <span className="choice__icon" aria-hidden="true">🎁</span>
                    <span className="choice__label">贈り物をする</span>
                    <span className="choice__note">
                      🌾{GIFT.itemCost} → 覚えている度 +{GIFT.memoryGain}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="choice"
                    disabled={!canShowKeepsake(state)}
                    onClick={() => setNightMode('keepsake')}
                  >
                    <span className="choice__icon" aria-hidden="true">🫧</span>
                    <span className="choice__label">思い出の話をする</span>
                    <span className="choice__note">
                      覚えている度 +{KEEPSAKE.showGain}（所持 {state.keepsakes.length}/
                      {keepsakeLimit(state)}）
                    </span>
                  </button>

                  <button
                    type="button"
                    className="choice choice--dark"
                    disabled={!canWhisper(state)}
                    onClick={game.whisper}
                  >
                    <span className="choice__icon" aria-hidden="true">🌙</span>
                    <span className="choice__label">とよっぴーの話を聞く</span>
                    <span className="choice__note">
                      さみしい -{WHISPER.samishiiDrop} / みんなの覚えている度 -{WHISPER.memoryCost}
                    </span>
                  </button>
                </div>
              </>
            ) : nightMode === 'gift' ? (
              <>
                <h3 className="panel__sub">誰に渡す?</h3>
                <div className="cards">
                  {game.partners.map((p) => (
                    <PartnerCard
                      key={p.id}
                      p={p}
                      actionLabel={`+${GIFT.memoryGain}`}
                      onClick={() => {
                        game.gift(p.id)
                        setNightMode('menu')
                      }}
                    />
                  ))}
                </div>
                <button type="button" className="link" onClick={() => setNightMode('menu')}>
                  もどる
                </button>
              </>
            ) : (
              <>
                <h3 className="panel__sub">どの思い出を話す?</h3>
                <ul className="keepsakes">
                  {state.keepsakes.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        className={`keepsake ${isFaded(state, k) ? 'is-faded' : ''}`}
                        onClick={() => {
                          game.showKeepsake(k.id)
                          setNightMode('menu')
                        }}
                      >
                        <span className="keepsake__label">
                          {CHAR_NAMES[k.partner]} ・ {k.day}日目
                          {isFaded(state, k) && '（色あせている）'}
                        </span>
                        <span>{k.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="link" onClick={() => setNightMode('menu')}>
                  もどる
                </button>
              </>
            )}
          </section>
        )}

        {/* ── おわり ───────────────────────── */}
        {state.phase === 'ending' && state.ending && (
          <section className="panel panel--ending">
            <h2 className="panel__title">{ENDING_TEXT[state.ending].title}</h2>
            <p className="result">{ENDING_TEXT[state.ending].body}</p>
            <p className="panel__note">
              まきこのごきげん {state.mood} / ごほうび {state.rewards.length}個 / 残った思い出{' '}
              {state.keepsakes.length}つ / 「大丈夫だよ」{state.whispers}回
            </p>

            {/* 何で失点したかを見せる。次の周回の狙いがここで決まる */}
            {game.moodBreakdown.losses.length > 0 && (
              <>
                <h3 className="panel__sub">ごきげんを落とした原因</h3>
                <ul className="rank">
                  {game.moodBreakdown.losses.slice(0, 5).map((r) => (
                    <li key={r.reason}>
                      <span className="rank__reason">{r.reason}</span>
                      <span className="rank__times">{r.times}回</span>
                      <span className="rank__total is-down">{r.total}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {game.moodBreakdown.gains.length > 0 && (
              <>
                <h3 className="panel__sub">効いた手</h3>
                <ul className="rank">
                  {game.moodBreakdown.gains.slice(0, 3).map((r) => (
                    <li key={r.reason}>
                      <span className="rank__reason">{r.reason}</span>
                      <span className="rank__times">{r.times}回</span>
                      <span className="rank__total is-up">+{r.total}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="panel__note">
              これまで {game.archive.runs} 周 / 最高ごきげん {game.archive.bestMood} /
              覚えたセリフ {Object.keys(game.archive.lines).length} 種
            </p>
            <div className="cards">
              {game.partners.map((p) => (
                <PartnerCard key={p.id} p={p} />
              ))}
            </div>
            {state.rewards.length > 0 && (
              <ul className="keepsakes">
                {state.rewards.map((r) => (
                  <li key={r}>
                    <div className="keepsake">
                      <span className="keepsake__label">もらったもの</span>
                      <span>
                        {REWARDS[r].name} — {REWARDS[r].note}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      <nav className="dock">
        {state.phase === 'morning' && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              game.equip(draft)
              setDraft([])
            }}
          >
            この気持ちで出かける
          </button>
        )}
        {state.phase === 'evening' && (
          <button type="button" className="primary" onClick={game.advance}>
            つづける
          </button>
        )}
        {state.phase === 'night' && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              game.sleep()
              setNightMode('menu')
            }}
          >
            {state.nightAction === null ? '何もしないで寝る' : 'ねる'}
          </button>
        )}
        {state.phase === 'ending' && (
          <button type="button" className="primary" onClick={() => game.reset(Date.now() % 100000)}>
            もう一度はじめる
          </button>
        )}
        {state.phase === 'day' && <p className="dock__hint">どちらか選ぶ</p>}
        {state.phase === 'reward' && <p className="dock__hint">どちらか受け取る</p>}
      </nav>

      {sheet === 'stock' && (
        <div className="sheet" role="dialog" aria-label="持ち物">
          <div className="sheet__body">
            <h2 className="panel__title">持ち物</h2>
            <p className="panel__note">
              🌾 仕込み {state.items} ／ 🍰 スイーツ {state.sweets} ／ 🫧 思い出{' '}
              {state.keepsakes.length}/{keepsakeLimit(state)}
            </p>
            {state.rewards.length > 0 && (
              <>
                <h3 className="panel__sub">もらったもの</h3>
                <ul className="keepsakes">
                  {state.rewards.map((r) => (
                    <li key={r}>
                      <div className="keepsake">
                        <span className="keepsake__label">{REWARDS[r].name}</span>
                        <span>{REWARDS[r].note}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="panel__sub">まきこの好きなもの</h3>
            <p className="panel__note">
              当てたものだけ分かる。×は引いてみて違ったもの。
            </p>
            <ul className="book">
              {prizeBook(state).map((p) => (
                <li
                  key={p.id}
                  className={`book__item ${p.liked ? 'is-liked' : p.tried ? 'is-tried' : ''}`}
                >
                  <span aria-hidden="true">{p.emoji}</span>
                  <span className="book__name">
                    {p.liked ? p.name : p.tried ? `${p.name}（ちがった）` : '?'}
                  </span>
                  <span className="book__mark">{p.liked ? '♥' : p.tried ? '×' : ''}</span>
                </li>
              ))}
            </ul>

            <h3 className="panel__sub">思い出</h3>
            <ul className="keepsakes">
              {state.keepsakes.length === 0 && (
                <li className="panel__note">
                  思い出はまだない。会話がよく通じた日に残ることがある。
                </li>
              )}
              {state.keepsakes.map((k) => (
                <li key={k.id}>
                  <div className={`keepsake ${isFaded(state, k) ? 'is-faded' : ''}`}>
                    <span className="keepsake__label">
                      {CHAR_NAMES[k.partner]} ・ {k.day}日目
                      {isFaded(state, k) && '（色あせている）'}
                    </span>
                    <span>{k.text}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="panel__note">
              進行は自動で保存されます（この端末のブラウザ内）。
            </p>
            <button type="button" className="primary" onClick={() => setSheet(null)}>
              とじる
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                if (confirm('この周を捨てて最初からやり直しますか?（攻略メモは残ります）')) {
                  game.reset(Date.now() % 100000)
                  setSheet(null)
                }
              }}
            >
              最初からやり直す
            </button>
          </div>
        </div>
      )}

      {/* ── 記憶のはなし ───────────────────── */}
      {sheet === 'memory' && (
        <div className="sheet" role="dialog" aria-label="記憶のはなし">
          <div className="sheet__body">
            <h2 className="panel__title">記憶のはなし</h2>
            <p className="me__intro">
              忘れられていくのは <b>りみっち</b> のほう。
              <br />
              このゲージは「その人が りみっち を覚えている度」で、下がると呼び方が変わり、
              頼めることが減っていきます。
            </p>

            <ul className="ladder">
              {LADDER.map((row) => (
                <li key={row.stage} className={`ladder__row ladder__row--${row.stage}`}>
                  <span className="ladder__at">{row.at}</span>
                  <span className="ladder__what">{row.what}</span>
                </li>
              ))}
            </ul>

            <h3 className="panel__sub">いま起きていること</h3>
            <ul className="mlist">
              {game.partners.map((p) => (
                <li key={p.id} className="mlist__item">
                  <Character id={p.id} face={p.face} animated={false} className="chr--xs" />
                  <div className="mlist__main">
                    <span className="mlist__name">
                      {p.name} <b>{p.memory}</b>
                      <small>{p.stageLabel}</small>
                    </span>
                    <span className="mlist__role">覚えていてくれると: {p.role}</span>
                    <span className="mlist__effect">いま: {p.effect}</span>
                    {p.nextLoss && (
                      <span className="mlist__next">
                        あと −{p.nextLoss.drop} で{p.nextLoss.text}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="panel__sub">戻す手だて</h3>
            <ul className="mhow">
              <li>会いに行く（+{MEET.memoryGain} / 待っていた相手なら ×1.5）</li>
              <li>夜に贈り物（🌾{GIFT.itemCost} → +{GIFT.memoryGain}）</li>
              <li>夜に思い出の話（+{KEEPSAKE.showGain}・切り札。1回で消える）</li>
              <li>まきこの機嫌が {MOOD.goodFrom} 以上だと、毎晩の忘却が {MOOD_GOOD.decayRelief} ゆるくなる</li>
              <li>何もしない夜は、全員 −{NIGHT.memoryDecay}</li>
            </ul>

            <button type="button" className="primary" onClick={() => setSheet(null)}>
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PartnerCard({
  p,
  onClick,
  disabled,
  actionLabel,
}: {
  p: PartnerView
  onClick?: () => void
  disabled?: boolean
  actionLabel?: string
}) {
  const inner = (
    <>
      {p.invited && <span className="card__badge">待ってる</span>}
      <Character id={p.id} face={p.face} animated={p.animated} className="chr--sm" />
      <span className="card__name">{p.name}</span>
      {/* 記憶度は「相手が りみっち を覚えている度合い」。
          目盛りを引いて、あとどれだけで段階が落ちるかを見えるようにする */}
      <span className="card__bar">
        <span className="card__fill" style={{ width: `${p.memory}%` }} />
        {STAGE_MARKS.map((v) => (
          <i key={v} className="card__tick" style={{ left: `${v}%` }} />
        ))}
      </span>
      <span className="card__meta">
        <b className="card__mem">りみっちを覚えている {p.memory}</b>
        <br />
        {p.stage === 3 && p.inGrace ? 'まだ戻せる' : `「${p.callsYou}」と呼ぶ`}
        <br />
        <span className="card__effect">{p.effect}</span>
        {p.nextLoss && (
          <>
            <br />
            <span className="card__next">
              あと −{p.nextLoss.drop} で{p.nextLoss.text}
            </span>
          </>
        )}
      </span>
      {p.keepsakes.length > 0 && <span className="card__keep">🫧{p.keepsakes.length}</span>}
      {actionLabel && <span className="card__action">{actionLabel}</span>}
    </>
  )

  if (!onClick) return <div className={`card card--${p.stage}`}>{inner}</div>
  return (
    <button
      type="button"
      className={`card card--${p.stage} ${p.invited ? 'is-invited' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {inner}
    </button>
  )
}

function faceOf(partners: PartnerView[], id: PartnerId) {
  return partners.find((p) => p.id === id)?.face ?? 'full'
}

function phaseLabel(phase: string) {
  return (
    {
      morning: '朝',
      day: '昼',
      evening: '夕方',
      night: '夜',
      reward: 'ごほうび',
      ending: 'おわり',
    }[phase] ?? phase
  )
}
