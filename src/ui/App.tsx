import { useState } from 'react'
import {
  CHAR_NAMES,
  EMOTION_IDS,
  EMOTION_NAMES,
  GIFT,
  KEEPSAKE,
  MAX_EQUIPPED,
  MOOD_MAX,
  PISU_TALK,
  REST,
  REWARDS,
  REWARD_STREAK,
  SWEETS,
  TOTAL_DAYS,
  WHISPER,
} from '../game/config'
import { demandText, has, keepsakeLimit } from '../game/reducer'
import {
  canGift,
  canGiveSweets,
  canPisuTalk,
  canShowKeepsake,
  canWhisper,
  isFaded,
  streakToReward,
} from '../game/selectors'
import type { PartnerView } from '../game/selectors'
import type { EmotionId, EndingId, PartnerId } from '../game/types'
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

type NightMode = 'menu' | 'gift' | 'keepsake'

export function App() {
  const game = useGame()
  const { state } = game

  const [draft, setDraft] = useState<EmotionId[]>([])
  const [picking, setPicking] = useState(false)
  const [nightMode, setNightMode] = useState<NightMode>('menu')
  const [sheet, setSheet] = useState(false)

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
          <button type="button" className="hud__stock" onClick={() => setSheet(true)}>
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
              <h2 className="panel__title">今日はどんな気持ちでいる?</h2>
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
                  <span className="choice__label">お弁当屋の仕事をする</span>
                  <span className="choice__note">
                    仕込みが増える / スイーツを仕入れられることがある(
                    {Math.round(SWEETS.findChance * 100)}%)
                  </span>
                </button>
                <button type="button" className="choice" onClick={() => setPicking(true)}>
                  <span className="choice__icon" aria-hidden="true">💬</span>
                  <span className="choice__label">誰かに会いに行く</span>
                  <span className="choice__note">記憶度が戻る / まきこ以外だと嫉妬されることも</span>
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
                <Character
                  id={state.pending.partner!}
                  face={faceOf(game.partners, state.pending.partner!)}
                  bounce={state.pending.success === true}
                  className="chr--md"
                />
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

            <ul className="deltas">
              {game.partners.map((p) => {
                const d = state.pending?.deltas[p.id] ?? 0
                return (
                  <li key={p.id}>
                    <span className="deltas__name">{p.name}</span>
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
              <p className="result">{state.log.at(-1)?.text}</p>
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
                      🌾{GIFT.itemCost} → 記憶度 +{GIFT.memoryGain}
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
                      記憶度 +{KEEPSAKE.showGain}（所持 {state.keepsakes.length}/
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
                      さみしい -{WHISPER.samishiiDrop} / みんなの記憶度 -{WHISPER.memoryCost}
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

      {sheet && (
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
            <button type="button" className="primary" onClick={() => setSheet(false)}>
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
      <span className="card__bar">
        <span className="card__fill" style={{ width: `${p.memory}%` }} />
      </span>
      {/* 記憶度は「相手がこちらを覚えている度合い」。呼び方の変化で見せる */}
      <span className="card__meta">
        {p.stage === 3
          ? p.inGrace
            ? 'まだ戻せる'
            : 'こちらを知らない'
          : `「${p.callsYou}」と呼ぶ`}
        {p.stage === 2 && <><br />表情がすくない</>}
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
