import type { CharId } from '../game/types'
import type { FacePattern } from '../game/selectors'

/**
 * characters.svg を「体」と「表情差分」に分けて組み立てる。
 * 忘却段階は face("full" | "flat" | "blank") だけで表現し、体は共通。
 */

interface Spec {
  fill: string
  cheek: string
  /** 体の中心と半径 */
  body: { cy: number; r: number }
  feet: { cx: number; cy: number; rx: number; ry: number }
  eye: { x: number; y: number; r: number }
  mouth: { y: number; w: number }
  cheekAt: { x: number; y: number }
}

const SPECS: Record<CharId, Spec> = {
  rimicchi: {
    fill: '#f4e4c1',
    cheek: '#f0c9c9',
    body: { cy: 45, r: 58 },
    feet: { cx: 32, cy: 70, rx: 9, ry: 14 },
    eye: { x: 16, y: 42, r: 4.5 },
    mouth: { y: 56, w: 8 },
    cheekAt: { x: 27, y: 52 },
  },
  pisu: {
    fill: '#fbeaf0',
    cheek: '#f0b8c8',
    body: { cy: 48, r: 54 },
    feet: { cx: 32, cy: 72, rx: 8, ry: 13 },
    eye: { x: 15, y: 46, r: 4.5 },
    mouth: { y: 60, w: 7 },
    cheekAt: { x: 25, y: 56 },
  },
  makiko: {
    fill: '#d8e8e4',
    cheek: '#a9cfc6',
    body: { cy: 45, r: 55 },
    feet: { cx: 32, cy: 72, rx: 8, ry: 13 },
    eye: { x: 15, y: 46, r: 3.5 },
    mouth: { y: 58, w: 7 },
    cheekAt: { x: 26, y: 55 },
  },
  toyoppi: {
    fill: '#fdfaf3',
    cheek: '#f5e0d8',
    body: { cy: 46, r: 56 },
    feet: { cx: 30, cy: 72, rx: 8, ry: 12 },
    eye: { x: 14, y: 46, r: 3 },
    mouth: { y: 58, w: 7 },
    cheekAt: { x: 24, y: 58 },
  },
}

/** キャラ固有の頭部パーツ(耳・線) */
function Head({ id, spec }: { id: CharId; spec: Spec }) {
  switch (id) {
    case 'rimicchi':
      return (
        <>
          <ellipse cx={-40} cy={20} rx={9} ry={6} fill={spec.fill} />
          <ellipse cx={40} cy={20} rx={9} ry={6} fill={spec.fill} />
        </>
      )
    case 'pisu':
      return (
        <>
          <ellipse cx={-16} cy={-8} rx={8} ry={32} fill={spec.fill} transform="rotate(-10 -16 -8)" />
          <ellipse cx={16} cy={-8} rx={8} ry={32} fill={spec.fill} transform="rotate(10 16 -8)" />
        </>
      )
    case 'makiko':
      return (
        <path
          d="M -50 20 Q 0 5 50 20"
          stroke="#8fb5ac"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      )
    case 'toyoppi':
      return null
  }
}

export interface CharacterProps {
  id: CharId
  face?: FacePattern
  /** まばたき・ゆれのアイドルアニメを動かすか */
  animated?: boolean
  /** 会話成功などの一時的な演出 */
  bounce?: boolean
  /** CSS 側で幅を決めるので size は指定しない(レスポンシブ) */
  className?: string
}

export function Character({
  id,
  face = 'full',
  animated = true,
  bounce = false,
  className,
}: CharacterProps) {
  const spec = SPECS[id]
  const { eye, mouth, cheekAt } = spec
  const eyeR = face === 'blank' ? Math.min(eye.r, 3) : eye.r

  return (
    <svg
      viewBox="-70 -50 140 150"
      className={[
        'chr',
        animated ? 'chr--idle' : '',
        bounce ? 'chr--bounce' : '',
        `chr--${face}`,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-hidden="true"
    >
      <g className="chr__feet">
        <ellipse cx={-spec.feet.cx} cy={spec.feet.cy} rx={spec.feet.rx} ry={spec.feet.ry} fill={spec.fill} />
        <ellipse cx={spec.feet.cx} cy={spec.feet.cy} rx={spec.feet.rx} ry={spec.feet.ry} fill={spec.fill} />
      </g>
      <g className="chr__body">
        <circle cx={0} cy={spec.body.cy} r={spec.body.r} fill={spec.fill} />
        <Head id={id} spec={spec} />

        {/* ── 表情差分 ───────────────────── */}
        <g className="chr__eyes">
          <circle cx={-eye.x} cy={eye.y} r={eyeR} fill="#3a3a3a" />
          <circle cx={eye.x} cy={eye.y} r={eyeR} fill="#3a3a3a" />
        </g>

        {face === 'full' && (
          <path
            d={`M ${-mouth.w} ${mouth.y} Q 0 ${mouth.y + 4} ${mouth.w} ${mouth.y}`}
            stroke="#3a3a3a"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {face === 'flat' && (
          <path
            d={`M ${-mouth.w} ${mouth.y} L ${mouth.w} ${mouth.y}`}
            stroke="#3a3a3a"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
        {/* blank は口を描かない */}

        {face === 'full' && (
          <g opacity={0.7}>
            <ellipse cx={-cheekAt.x} cy={cheekAt.y} rx={6} ry={4} fill={spec.cheek} />
            <ellipse cx={cheekAt.x} cy={cheekAt.y} rx={6} ry={4} fill={spec.cheek} />
          </g>
        )}
      </g>
    </svg>
  )
}
