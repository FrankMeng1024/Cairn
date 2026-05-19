/**
 * RunningIcon — a mid-stride runner, dynamic lean forward,
 * arms driving, one foot off the ground.
 *
 * Replaces lucide PersonStanding for the Running activity card.
 * Same hand-crafted SVG aesthetic as HikingIcon and CairnStoneIcon.
 */
import React from 'react';
import Svg, { Path, Ellipse } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function RunningIcon({ size = 48, color = '#3a7bbf' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Ground shadow */}
      <Ellipse
        cx="24"
        cy="44"
        rx="10"
        ry="2"
        fill={color}
        fillOpacity="0.10"
      />

      {/* Head — leaned forward */}
      <Ellipse cx="28" cy="7.5" rx="3.4" ry="3.4" fill={color} />

      {/* Torso — diagonal lean */}
      <Path
        d="M 27 11 L 20 24"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Left arm — drive forward */}
      <Path
        d="M 24 15 L 17 11"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {/* Right arm — back swing */}
      <Path
        d="M 25 15 L 32 20"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {/* Left leg — push off behind */}
      <Path
        d="M 20 24 L 14 32 L 10 38"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right leg — kick forward, knee lift */}
      <Path
        d="M 20 24 L 24 30 L 30 36"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Motion line — speed dash behind head */}
      <Path
        d="M 20 8 L 14 9"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />
      <Path
        d="M 21 11 L 15 12.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.30"
      />
    </Svg>
  );
}
