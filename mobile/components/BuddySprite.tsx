// The companion ("相棒") — a friendly sprout that visibly grows through stages
// (1..7) as the user levels up. Drawn with react-native-svg so it scales and
// renders on web too.

import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

const POT = '#E8654E';
const POT_RIM = '#EF7A5E';
const BODY = '#6FA86A';
const LEAF_A = '#7DB877';
const LEAF_B = '#8AC183';
const TIP = '#9BCB92';
const EYE = '#2C3A28';

export function BuddySprite({
  stage = 1,
  size = 120,
  happy = true,
}: {
  stage?: number;
  size?: number;
  happy?: boolean;
}) {
  // viewBox 0..100 wide, 0..115 tall. cx=50, pot near bottom.
  const cx = 50;
  const cy = 74; // pot top reference
  const bodyR = 14 + Math.min(stage, 5) * 1.6; // body grows with stage
  const bodyCy = cy - 16;

  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      {/* ground shadow */}
      <Ellipse cx={cx} cy={cy + 36} rx={26} ry={6} fill="rgba(59,48,38,0.07)" />

      {/* leaves / crown — more as the buddy grows */}
      <G>
        {/* base double leaves appear from stage 2 */}
        {stage >= 2 && (
          <Path
            d={`M ${cx} ${bodyCy - 8} Q ${cx - 26} ${bodyCy - 24} ${cx - 30} ${bodyCy - 2} Q ${cx - 12} ${bodyCy} ${cx} ${bodyCy - 8} Z`}
            fill={LEAF_A}
          />
        )}
        {stage >= 3 && (
          <Path
            d={`M ${cx} ${bodyCy - 10} Q ${cx + 24} ${bodyCy - 26} ${cx + 30} ${bodyCy - 4} Q ${cx + 12} ${bodyCy - 2} ${cx} ${bodyCy - 10} Z`}
            fill={LEAF_B}
          />
        )}
        {/* taller side leaves from stage 4 */}
        {stage >= 4 && (
          <Path
            d={`M ${cx - 6} ${bodyCy - 12} Q ${cx - 30} ${bodyCy - 40} ${cx - 16} ${bodyCy - 46} Q ${cx - 6} ${bodyCy - 30} ${cx - 6} ${bodyCy - 12} Z`}
            fill={LEAF_B}
          />
        )}
        {/* sprout tip (stages 1-4) */}
        {stage <= 4 && (
          <Path
            d={`M ${cx} ${bodyCy - 12} q -4 -16 6 -22 q 4 10 -6 22 Z`}
            fill={TIP}
          />
        )}
        {/* bud (stage 5) */}
        {stage === 5 && (
          <G>
            <Path d={`M ${cx} ${bodyCy - 36} q -7 8 0 18 q 7 -10 0 -18 Z`} fill={colors.spark} />
            <Rect x={cx - 1.5} y={bodyCy - 20} width={3} height={12} rx={1.5} fill={LEAF_A} />
          </G>
        )}
        {/* flower (stage 6) */}
        {stage === 6 && (
          <G>
            <Rect x={cx - 1.5} y={bodyCy - 22} width={3} height={14} rx={1.5} fill={LEAF_A} />
            {[0, 72, 144, 216, 288].map((a) => {
              const r = (a * Math.PI) / 180;
              return (
                <Ellipse
                  key={a}
                  cx={cx + Math.cos(r) * 7}
                  cy={bodyCy - 30 + Math.sin(r) * 7}
                  rx={5}
                  ry={7}
                  fill={colors.spark}
                  transform={`rotate(${a} ${cx + Math.cos(r) * 7} ${bodyCy - 30 + Math.sin(r) * 7})`}
                />
              );
            })}
            <Circle cx={cx} cy={bodyCy - 30} r={4} fill={colors.gold} />
          </G>
        )}
        {/* fruit/berries (stage 7) */}
        {stage >= 7 && (
          <G>
            <Path
              d={`M ${cx} ${bodyCy - 12} Q ${cx + 26} ${bodyCy - 30} ${cx + 30} ${bodyCy - 6} Q ${cx + 12} ${bodyCy - 4} ${cx} ${bodyCy - 12} Z`}
              fill={LEAF_B}
            />
            <Circle cx={cx - 10} cy={bodyCy - 30} r={5} fill={colors.gold} />
            <Circle cx={cx + 8} cy={bodyCy - 34} r={5} fill={colors.spark} />
            <Circle cx={cx + 2} cy={bodyCy - 26} r={4.5} fill={colors.gold} />
          </G>
        )}
      </G>

      {/* body */}
      <Circle cx={cx} cy={bodyCy} r={bodyR} fill={BODY} />
      {/* cheeks */}
      <Circle cx={cx - bodyR * 0.62} cy={bodyCy + 3} r={3} fill="rgba(232,101,78,0.35)" />
      <Circle cx={cx + bodyR * 0.62} cy={bodyCy + 3} r={3} fill="rgba(232,101,78,0.35)" />
      {/* eyes */}
      <Circle cx={cx - 6} cy={bodyCy} r={2.4} fill={EYE} />
      <Circle cx={cx + 6} cy={bodyCy} r={2.4} fill={EYE} />
      {/* mouth */}
      {happy ? (
        <Path d={`M ${cx - 5} ${bodyCy + 7} Q ${cx} ${bodyCy + 12} ${cx + 5} ${bodyCy + 7}`} stroke={EYE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      ) : (
        <Path d={`M ${cx - 4} ${bodyCy + 9} L ${cx + 4} ${bodyCy + 9}`} stroke={EYE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      )}

      {/* pot */}
      <Path
        d={`M ${cx - 22} ${cy + 4} L ${cx + 22} ${cy + 4} L ${cx + 17} ${cy + 30} Q ${cx + 15} ${cy + 35} ${cx + 10} ${cy + 35} L ${cx - 10} ${cy + 35} Q ${cx - 15} ${cy + 35} ${cx - 17} ${cy + 30} Z`}
        fill={POT}
      />
      <Rect x={cx - 25} y={cy - 2} width={50} height={9} rx={4.5} fill={POT_RIM} />
    </Svg>
  );
}
