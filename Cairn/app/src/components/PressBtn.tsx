/**
 * PressBtn — universal pressable wrapper with consistent scale-spring feedback.
 *
 * Use everywhere a TouchableOpacity is currently bare (no scale animation).
 * This is the single source of truth for press feedback in the app.
 *
 * Spring config matches BackButton, ActivityCard, ToolBtn — tension 300, friction 10/8.
 *
 * Usage:
 *   <PressBtn style={styles.cta} onPress={...}>...</PressBtn>      // default scale 0.97
 *   <PressBtn style={...} onPress={...} scaleTo={0.93}>...</PressBtn>  // smaller buttons
 *   <PressBtn style={...} onPress={...} scaleTo={0.88}>...</PressBtn>  // markers / icon buttons
 *
 * Recommended scaleTo values:
 *   - Cards / large CTA           → 0.97
 *   - Small CTA / pill buttons    → 0.95
 *   - Icon buttons / chips        → 0.92
 *   - Map markers / tight icons   → 0.88
 */
import React, { useRef } from 'react';
import { Animated, TouchableOpacity, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';

interface PressBtnProps {
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  scaleTo?: number;
  disabled?: boolean;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}

export function PressBtn({
  onPress, onLongPress, style, children, scaleTo = 0.97, disabled, hitSlop,
}: PressBtnProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, tension: 300, friction: 10 }).start();
  };
  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
        disabled={disabled}
        hitSlop={hitSlop}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
