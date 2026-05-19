/**
 * HikingIcon — asymmetric mountain peak silhouette with a single
 * curved trail path crossing it. Premium outdoor app convention:
 * AllTrails / Garmin / Apple Watch all use mountain-as-hiking metaphor,
 * not a human figure. Filled silhouette approach.
 *
 * Geometry: peak offset left of center (~10,4), right shoulder notch at (16,12)
 * to feel like a real mountain, not an equilateral triangle.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function HikingIcon({ size = 48, color = '#5d7c46' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Mountain silhouette — filled, asymmetric peak */}
      <Path
        d="M 2 20 L 10 4 L 14.5 10.5 L 16.5 8 L 22 20 Z"
        fill={color}
        fillOpacity="0.90"
      />
      {/* Trail path — single curved line over the mountain, white cutout feel */}
      <Path
        d="M 4 20 Q 9 14 10.5 11 Q 13 15 15.5 12 Q 18 16 20 20"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="0.55"
      />
    </Svg>
  );
}
