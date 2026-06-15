// The companion ("相棒") — a friendly sprout that grows through stages (1..7)
// and can wear cosmetics (hat / pot / background / accessory). Drawn with
// react-native-svg so it scales and renders on web too.

import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { DEFAULT_OUTFIT, type Outfit } from '../lib/cosmetics';
import { colors } from '../lib/theme';

const BODY = '#6FA86A';
const LEAF_A = '#7DB877';
const LEAF_B = '#8AC183';
const TIP = '#9BCB92';
const EYE = '#2C3A28';

const POTS: Record<string, [string, string]> = {
  pot_coral: ['#E8654E', '#EF7A5E'],
  pot_sky: ['#5B83A6', '#739BBD'],
  pot_wood: ['#A9794B', '#BE8C5C'],
  pot_mint: ['#7FB8A6', '#98C9BA'],
  pot_gold: ['#E0A640', '#ECBC63'],
};

export function BuddySprite({
  stage = 1,
  size = 120,
  happy = true,
  outfit,
}: {
  stage?: number;
  size?: number;
  happy?: boolean;
  outfit?: Partial<Outfit>;
}) {
  const o: Outfit = { ...DEFAULT_OUTFIT, ...outfit };
  const cx = 50;
  const cy = 74; // pot top reference
  const bodyR = 14 + Math.min(stage, 5) * 1.6;
  const bodyCy = cy - 16;
  const headTop = bodyCy - bodyR;
  const [potFill, potRim] = POTS[o.pot] ?? POTS.pot_coral;

  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      {/* background scene */}
      {o.bg !== 'bg_none' ? <Background id={o.bg} /> : null}

      {/* ground shadow */}
      <Ellipse cx={cx} cy={cy + 36} rx={26} ry={6} fill="rgba(59,48,38,0.07)" />

      {/* leaves / crown */}
      <G>
        {stage >= 2 && (
          <Path d={`M ${cx} ${bodyCy - 8} Q ${cx - 26} ${bodyCy - 24} ${cx - 30} ${bodyCy - 2} Q ${cx - 12} ${bodyCy} ${cx} ${bodyCy - 8} Z`} fill={LEAF_A} />
        )}
        {stage >= 3 && (
          <Path d={`M ${cx} ${bodyCy - 10} Q ${cx + 24} ${bodyCy - 26} ${cx + 30} ${bodyCy - 4} Q ${cx + 12} ${bodyCy - 2} ${cx} ${bodyCy - 10} Z`} fill={LEAF_B} />
        )}
        {stage >= 4 && (
          <Path d={`M ${cx - 6} ${bodyCy - 12} Q ${cx - 30} ${bodyCy - 40} ${cx - 16} ${bodyCy - 46} Q ${cx - 6} ${bodyCy - 30} ${cx - 6} ${bodyCy - 12} Z`} fill={LEAF_B} />
        )}
        {stage <= 4 && <Path d={`M ${cx} ${bodyCy - 12} q -4 -16 6 -22 q 4 10 -6 22 Z`} fill={TIP} />}
        {stage === 5 && (
          <G>
            <Path d={`M ${cx} ${bodyCy - 36} q -7 8 0 18 q 7 -10 0 -18 Z`} fill={colors.spark} />
            <Rect x={cx - 1.5} y={bodyCy - 20} width={3} height={12} rx={1.5} fill={LEAF_A} />
          </G>
        )}
        {stage === 6 && (
          <G>
            <Rect x={cx - 1.5} y={bodyCy - 22} width={3} height={14} rx={1.5} fill={LEAF_A} />
            {[0, 72, 144, 216, 288].map((a) => {
              const r = (a * Math.PI) / 180;
              const px = cx + Math.cos(r) * 7;
              const py = bodyCy - 30 + Math.sin(r) * 7;
              return <Ellipse key={a} cx={px} cy={py} rx={5} ry={7} fill={colors.spark} transform={`rotate(${a} ${px} ${py})`} />;
            })}
            <Circle cx={cx} cy={bodyCy - 30} r={4} fill={colors.gold} />
          </G>
        )}
        {stage >= 7 && (
          <G>
            <Path d={`M ${cx} ${bodyCy - 12} Q ${cx + 26} ${bodyCy - 30} ${cx + 30} ${bodyCy - 6} Q ${cx + 12} ${bodyCy - 4} ${cx} ${bodyCy - 12} Z`} fill={LEAF_B} />
            <Circle cx={cx - 10} cy={bodyCy - 30} r={5} fill={colors.gold} />
            <Circle cx={cx + 8} cy={bodyCy - 34} r={5} fill={colors.spark} />
            <Circle cx={cx + 2} cy={bodyCy - 26} r={4.5} fill={colors.gold} />
          </G>
        )}
      </G>

      {/* body */}
      <Circle cx={cx} cy={bodyCy} r={bodyR} fill={BODY} />
      <Circle cx={cx - bodyR * 0.62} cy={bodyCy + 3} r={3} fill="rgba(232,101,78,0.35)" />
      <Circle cx={cx + bodyR * 0.62} cy={bodyCy + 3} r={3} fill="rgba(232,101,78,0.35)" />
      <Circle cx={cx - 6} cy={bodyCy} r={2.4} fill={EYE} />
      <Circle cx={cx + 6} cy={bodyCy} r={2.4} fill={EYE} />
      {happy ? (
        <Path d={`M ${cx - 5} ${bodyCy + 7} Q ${cx} ${bodyCy + 12} ${cx + 5} ${bodyCy + 7}`} stroke={EYE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      ) : (
        <Path d={`M ${cx - 4} ${bodyCy + 9} L ${cx + 4} ${bodyCy + 9}`} stroke={EYE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      )}

      {/* accessory (over the face) */}
      {o.acc === 'acc_glasses' ? (
        <G stroke={EYE} strokeWidth={1.4} fill="none">
          <Circle cx={cx - 6} cy={bodyCy} r={4} />
          <Circle cx={cx + 6} cy={bodyCy} r={4} />
          <Path d={`M ${cx - 2} ${bodyCy} L ${cx + 2} ${bodyCy}`} />
        </G>
      ) : null}
      {o.acc === 'acc_scarf' ? (
        <G>
          <Rect x={cx - bodyR} y={bodyCy + bodyR - 3} width={bodyR * 2} height={7} rx={3.5} fill={colors.spark} />
          <Path d={`M ${cx + bodyR - 4} ${bodyCy + bodyR + 2} l 6 12 l -7 -2 Z`} fill={colors.spark} />
        </G>
      ) : null}

      {/* hat (on the head) */}
      <Hat id={o.hat} cx={cx} top={headTop} />

      {/* pot */}
      <Path
        d={`M ${cx - 22} ${cy + 4} L ${cx + 22} ${cy + 4} L ${cx + 17} ${cy + 30} Q ${cx + 15} ${cy + 35} ${cx + 10} ${cy + 35} L ${cx - 10} ${cy + 35} Q ${cx - 15} ${cy + 35} ${cx - 17} ${cy + 30} Z`}
        fill={potFill}
      />
      <Rect x={cx - 25} y={cy - 2} width={50} height={9} rx={4.5} fill={potRim} />
    </Svg>
  );
}

function Hat({ id, cx, top }: { id: string; cx: number; top: number }) {
  switch (id) {
    case 'hat_straw':
      return (
        <G>
          <Ellipse cx={cx} cy={top + 1} rx={20} ry={5} fill="#E0B062" />
          <Path d={`M ${cx - 11} ${top + 1} Q ${cx} ${top - 16} ${cx + 11} ${top + 1} Z`} fill="#EAC078" />
          <Ellipse cx={cx} cy={top - 2} rx={11} ry={3} fill="#D9A24E" />
        </G>
      );
    case 'hat_beanie':
      return (
        <G>
          <Path d={`M ${cx - 13} ${top + 2} Q ${cx} ${top - 18} ${cx + 13} ${top + 2} Z`} fill="#5B83A6" />
          <Rect x={cx - 13} y={top - 1} width={26} height={5} rx={2.5} fill="#739BBD" />
          <Circle cx={cx} cy={top - 17} r={3} fill="#FFFDF8" />
        </G>
      );
    case 'hat_ribbon':
      return (
        <G fill={colors.spark}>
          <Path d={`M ${cx} ${top} l -10 -6 l 0 12 Z`} />
          <Path d={`M ${cx} ${top} l 10 -6 l 0 12 Z`} />
          <Circle cx={cx} cy={top} r={3} />
        </G>
      );
    case 'hat_flower':
      return (
        <G>
          {[0, 72, 144, 216, 288].map((a) => {
            const r = (a * Math.PI) / 180;
            return <Ellipse key={a} cx={cx + Math.cos(r) * 5} cy={top - 4 + Math.sin(r) * 5} rx={3.5} ry={5} fill="#F2A0C0" transform={`rotate(${a} ${cx + Math.cos(r) * 5} ${top - 4 + Math.sin(r) * 5})`} />;
          })}
          <Circle cx={cx} cy={top - 4} r={3} fill={colors.gold} />
        </G>
      );
    case 'hat_crown':
      return (
        <G>
          <Path d={`M ${cx - 13} ${top + 2} L ${cx - 13} ${top - 8} L ${cx - 6} ${top - 1} L ${cx} ${top - 11} L ${cx + 6} ${top - 1} L ${cx + 13} ${top - 8} L ${cx + 13} ${top + 2} Z`} fill={colors.gold} />
          <Circle cx={cx} cy={top - 9} r={2} fill={colors.spark} />
        </G>
      );
    default:
      return null;
  }
}

function Background({ id }: { id: string }) {
  const clip = { x: 4, y: 2, w: 92, h: 108, r: 18 };
  switch (id) {
    case 'bg_dawn':
      return (
        <G>
          <Rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} rx={clip.r} fill="#FBE0C4" />
          <Rect x={clip.x} y={clip.y + clip.h * 0.55} width={clip.w} height={clip.h * 0.45} rx={clip.r} fill="#F6C9A8" />
          <Circle cx={50} cy={40} r={14} fill="#F6A96B" />
        </G>
      );
    case 'bg_meadow':
      return (
        <G>
          <Rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} rx={clip.r} fill="#D6ECF5" />
          <Rect x={clip.x} y={clip.y + clip.h * 0.6} width={clip.w} height={clip.h * 0.4} rx={clip.r} fill="#CDE6BE" />
          <Circle cx={74} cy={30} r={10} fill="#FBE08A" />
        </G>
      );
    case 'bg_night':
      return (
        <G>
          <Rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} rx={clip.r} fill="#3B4A6B" />
          <Circle cx={70} cy={30} r={10} fill="#F4E7B8" />
          {[[24, 24], [40, 44], [80, 60], [30, 70], [60, 20]].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={1.6} fill="#FFFDF8" />
          ))}
        </G>
      );
    case 'bg_bloom':
      return (
        <G>
          <Rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} rx={clip.r} fill="#FCE7EF" />
          {[[20, 28, '#F2A0C0'], [78, 36, '#F6C36B'], [28, 64, '#A9D89B'], [76, 70, '#F2A0C0']].map(([x, y, c], i) => (
            <Circle key={i} cx={x as number} cy={y as number} r={4} fill={c as string} />
          ))}
        </G>
      );
    default:
      return null;
  }
}
