/**
 * CairnLogo — the app wordmark logo: three hand-stacked stones
 * matching CairnStoneIcon but optimised for the header bar size.
 *
 * The stones are slightly asymmetric (real cairns aren't machine-stacked).
 * Used in HomeScreen header row.
 */
import React from 'react';
import Svg, { Ellipse, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function CairnLogo({ size = 22, color = '#5d7c46' }: Props) {
  const s = size / 24;
  return (
    <Svg width={size * 0.75} height={size} viewBox="0 0 18 24" fill="none">
      {/* Base stone — widest, slightly off-centre right */}
      <Ellipse cx="9.5" cy="21" rx="7.5" ry="2.4" fill={color} />
      <Path
        d="M 2 21 a 7.5 2.4 0 0 0 15 0"
        fill={color}
        opacity="0.18"
      />
      {/* Middle stone — shifted left */}
      <Ellipse cx="8.5" cy="15" rx="5.5" ry="2.0" fill={color} />
      <Path
        d="M 3 15 a 5.5 2 0 0 0 11 0"
        fill={color}
        opacity="0.22"
      />
      {/* Top stone — smallest, leaning right */}
      <Ellipse cx="11" cy="9.5" rx="3.4" ry="1.7" fill={color} />
      <Path
        d="M 7.6 9.5 a 3.4 1.7 0 0 0 6.8 0"
        fill={color}
        opacity="0.26"
      />
    </Svg>
  );
}
