/**
 * RootNavigator — matches design.jpg exactly
 *
 * Flow: Auth → Home → (Hiking | Running | MapHistory | Friends | Settings)
 * NO bottom tabs. All navigation from Home page.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HikingScreen } from '../screens/HikingScreen';
import { RunningScreen } from '../screens/RunningScreen';
import { MapHistoryScreen } from '../screens/MapHistoryScreen';
import { MapScreen } from '../screens/MapScreen';
import { RoutesScreen } from '../screens/RoutesScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ARScreen } from '../screens/ARScreen';
import { RouteEditorScreen } from '../screens/RouteEditorScreen';
import { useAppStore } from '../store/useAppStore';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Hiking: undefined;
  Running: undefined;
  MapHistory: { sessionId?: string } | undefined;
  Map: { focusLat?: number; focusLng?: number; focusMarkerId?: string } | undefined;
  Routes: undefined;
  RouteEditor: { routeId?: string; fromSessionId?: string } | undefined;
  Friends: undefined;
  Settings: undefined;
  AR: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isLoggedIn } = useAppStore();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 320,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          customAnimationOnGesture: true,
        }}
      >
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            {/* Card-style screens presented from Home — no transition on web (fade causes scale artifact) */}
            <Stack.Screen name="Hiking"   component={HikingScreen}   options={{ animation: 'none' }} />
            <Stack.Screen name="Running"  component={RunningScreen}  options={{ animation: 'none' }} />
            <Stack.Screen name="Routes"   component={RoutesScreen}   options={{ animation: 'none' }} />
            <Stack.Screen name="Friends"  component={FriendsScreen}  options={{ animation: 'none' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'none' }} />
            <Stack.Screen name="AR"       component={ARScreen}       options={{ animation: 'none' }} />
            {/* Detail / sub-screens — slide from right */}
            <Stack.Screen name="MapHistory"  component={MapHistoryScreen} />
            <Stack.Screen name="Map"         component={MapScreen} />
            <Stack.Screen name="RouteEditor" component={RouteEditorScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
