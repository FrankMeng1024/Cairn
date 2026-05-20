/**
 * RootNavigator — matches design.jpg exactly
 *
 * Flow: Auth → Home → (Hiking | Running | MapHistory | Friends | Settings)
 * NO bottom tabs. All navigation from Home page.
 */
import React, { useRef } from 'react';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
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
import { DebugScreen } from '../screens/DebugScreen';
import { useAppStore } from '../store/useAppStore';
import { crashLogger } from '../services/crashLogger';

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
  Debug: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isLoggedIn } = useAppStore();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const lastRouteName = useRef<string | undefined>(undefined);

  return (
    <NavigationContainer
      ref={navRef}
      onReady={() => {
        const route = navRef.current?.getCurrentRoute();
        lastRouteName.current = route?.name;
        crashLogger.breadcrumb(`nav_ready:${route?.name ?? 'unknown'}`);
      }}
      onStateChange={() => {
        const route = navRef.current?.getCurrentRoute();
        if (route?.name && route.name !== lastRouteName.current) {
          crashLogger.breadcrumb(`nav:${lastRouteName.current ?? '?'}->${route.name}`);
          lastRouteName.current = route.name;
        }
      }}
    >
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
            {/* All non-Home screens use the global ios_from_right transition.
                Symmetric in both directions — entering slides in from the right,
                back gesture/button slides it back out the same way. */}
            <Stack.Screen name="Hiking"      component={HikingScreen} />
            <Stack.Screen name="Running"     component={RunningScreen} />
            <Stack.Screen name="Routes"      component={RoutesScreen} />
            <Stack.Screen name="Friends"     component={FriendsScreen} />
            <Stack.Screen name="Settings"    component={SettingsScreen} />
            <Stack.Screen name="AR"          component={ARScreen} />
            <Stack.Screen name="MapHistory"  component={MapHistoryScreen} />
            <Stack.Screen name="Map"         component={MapScreen} />
            <Stack.Screen name="RouteEditor" component={RouteEditorScreen} />
            <Stack.Screen name="Debug"       component={DebugScreen} />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ animation: 'fade', animationDuration: 280 }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
