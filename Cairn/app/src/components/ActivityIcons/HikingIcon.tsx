/**
 * HikingIcon — a striding figure with a walking pole and pack,
 * drawn as a natural silhouette on a soft hill horizon.
 *
 * Replaces lucide Mountain for the Hiking activity card.
 * Designed to echo the CairnStoneIcon aesthetic — hand-crafted paths,
 * sepia-green palette, no rigid geometry.
 */
import React from 'react';
import Svg, { Path, Ellipse, G } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function HikingIcon({ size = 48, color = '#5d7c46' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Hill horizon */}
      <Path
        d="M 2 38 Q 24 26 46 38 L 46 46 L 2 46 Z"
        fill={color}
        fillOpacity="0.12"
      />

      {/* Head */}
      <Ellipse cx="24" cy="8.5" rx="3.6" ry="3.6" fill={color} />

      {/* Backpack hump */}
      <Path
        d="M 26.5 12 Q 32 10 31 16 Q 30 20 27 20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Torso */}
      <Path
        d="M 24 12.5 L 22 26"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Left arm — forward swing */}
      <Path
        d="M 23 15 L 17 20"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Right arm — back with pole */}
      <Path
        d="M 24.5 15.5 L 30 21"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Walking pole */}
      <Path
        d="M 30 21 L 35 36"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />

      {/* Left leg — stride forward */}
      <Path
        d="M 22 26 L 19 35 L 16 38"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right leg — back push */}
      <Path
        d="M 22 26 L 25 33 L 28 36"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Boot left */}
      <Path
        d="M 16 38 Q 13 38 13 40 L 17 40"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        strokeOpacity="0.85"
      />

      {/* Boot right */}
      <Path
        d="M 28 36 Q 28 39 30 39 L 32 39"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        strokeOpacity="0.85"
      />
    </Svg>
  );
}
