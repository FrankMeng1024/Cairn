/**
 * BackButton — shared back navigation chip used by all screens.
 *
 * variant="pill"   — floating pill chip (white bg + shadow), for screens
 *                    that overlay a map (HikingScreen, MapHistoryScreen)
 * variant="inline" — plain text+icon, for screens with a dedicated top bar
 *                    (SettingsScreen, FriendsScreen, RunningScreen)
 */
import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize, IconSize, Shadow } from './tokens';
import { Icon } from './Icon';

interface BackButtonProps {
  variant?: 'pill' | 'inline';
  label?: string;
  onPress?: () => void;
}

export function BackButton({ variant = 'inline', label = 'Back', onPress }: BackButtonProps) {
  const nav = useNavigation();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }).start();

  const handlePress = () => {
    if (onPress) onPress();
    else nav.goBack();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={variant === 'pill' ? styles.pill : styles.inline}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Icon name="ChevronLeft" size={IconSize.sm} color={Colors.primary} strokeWidth={2.5} />
        <Text style={variant === 'pill' ? styles.pillText : styles.inlineText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    ...Shadow.card,
  },
  pillText: { fontSize: FontSize.small, fontWeight: '600', color: Colors.primary },
  inline: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 6, paddingRight: Spacing.sm,
  },
  inlineText: { fontSize: FontSize.caption, fontWeight: '600', color: Colors.primary },
});
