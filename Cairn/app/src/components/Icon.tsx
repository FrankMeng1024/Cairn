/**
 * Icon — SVG icons via lucide-react-native.
 * metro.config.js overrides resolution to use CJS dist
 * instead of the ESM react-native field (which breaks Metro web).
 */
import React from 'react';
import {
  Mountain, PersonStanding, Map, Users, Settings2,
  ChevronRight, ChevronLeft, Play, Square, Flag,
  AlertTriangle, Star, Navigation, Lock, Unlock,
  Target, Timer, Heart, Zap, MapPin, Route,
} from 'lucide-react-native';
import { IconSize } from './tokens';

const ICON_MAP = {
  Mountain, PersonStanding, Map, Users, Settings2,
  ChevronRight, ChevronLeft, Play, Square, Flag,
  AlertTriangle, Star, Navigation, Lock, Unlock,
  Target, Timer, Heart, Zap, MapPin, Route,
} as const;

export type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = IconSize.md, color = '#000000', strokeWidth = 2 }: IconProps) {
  const LucideIcon = ICON_MAP[name] as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  if (!LucideIcon) return null;
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} />;
}
