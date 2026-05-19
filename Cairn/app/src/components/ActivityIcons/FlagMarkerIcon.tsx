/**
 * FlagMarkerIcon — a hand-planted trail flag: a cairn stone base,
 * a short pole, and a triangular pennant.
 *
 * Used wherever the generic lucide Flag icon appears in trail-marking context.
 * Consistent palette with CairnStoneIcon (sepia brown stones + green flag).
 */
import React from 'react';
import Svg, { Path, Ellipse } from 'react-native-svg';

interface Props {
  size?: number;
  stoneColor?: string;
  flagColor?: string;
}

export function FlagMarkerIcon({
  size = 32,
  stoneColor = '#b5823d',
  flagColor = '#5d7c46',
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Base stone */}
      <Ellipse cx="16" cy="27" rx="8" ry="2.4" fill={stoneColor} fillOpacity="0.9" />
      <Path
        d="M 8 27 a 8 2.4 0 0 0 16 0"
        fill={stoneColor}
        opacity="0.18"
      />

      {/* Middle stone */}
      <Ellipse cx="15.5" cy="22" rx="5.5" ry="2" fill={stoneColor} fillOpacity="0.82" />
      <Path
        d="M 10 22 a 5.5 2 0 0 0 11 0"
        fill={stoneColor}
        opacity="0.22"
      />

      {/* Pole */}
      <Path
        d="M 16 20 L 16 6"
        stroke={stoneColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.80"
      />

      {/* Pennant */}
      <Path
        d="M 16 6 L 26 9 L 16 13 Z"
        fill={flagColor}
        fillOpacity="0.90"
      />
      {/* Pennant shadow edge */}
      <Path
        d="M 16 13 L 26 9"
        stroke={flagColor}
        strokeWidth="0.7"
        strokeOpacity="0.35"
        fill="none"
      />
    </Svg>
  );
}
