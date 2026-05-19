/**
 * RunningIcon — forward-lean runner silhouette, filled shapes only.
 * Design reference: Strava, Google Fit, Apple Watch Activity.
 * Key: strong forward lean, one arm driving forward, one leg extended back.
 * Reduced to 5 filled shapes — head, torso, front arm, front leg, back leg.
 */
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function RunningIcon({ size = 48, color = '#3a7bbf' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head — positioned forward (right) of body center */}
      <Circle cx="16" cy="4" r="2.0" fill={color} />

      {/* Torso — strong diagonal lean forward, wider at shoulders */}
      <Path
        d="M 15 5.8 L 10 13 L 12.5 13.5 L 17 6.5 Z"
        fill={color}
      />

      {/* Forward arm — punching ahead */}
      <Path
        d="M 13.5 8 L 8.5 6.5 L 8 8 L 13 9.5 Z"
        fill={color}
      />

      {/* Back arm — sweeping behind body */}
      <Path
        d="M 16 8.5 L 19.5 11 L 20 9.8 L 16.5 7.5 Z"
        fill={color}
      />

      {/* Front leg — knee lifted, driving forward */}
      <Path
        d="M 11 13 L 8.5 18 L 10 20 L 12 20 L 10 17.5 L 13 13.5 Z"
        fill={color}
      />

      {/* Back leg — pushing off, extending behind */}
      <Path
        d="M 12.5 13.5 L 14.5 18 L 17.5 17 L 17 15.5 L 15 16 L 13.5 13 Z"
        fill={color}
      />
    </Svg>
  );
}
