import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import { AuthScreen } from '../screens/AuthScreen';
import { MapScreen } from '../screens/MapScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { RoutesScreen } from '../screens/RoutesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppStore } from '../store/useAppStore';
import { Colors, FontSize } from '../components/tokens';

// ── Tab Icon ─────────────────────────────────────────────────────────────────
function TabIcon({ emoji, label, focused, isGuided }: { emoji: string; label: string; focused: boolean; isGuided: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 2 }}>
      <Text style={{ fontSize: isGuided ? 20 : 22 }}>{emoji}</Text>
      {isGuided && (
        <Text style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '400',
          color: focused ? Colors.primary : Colors.textMuted,
          marginTop: 1,
        }}>
          {label}
        </Text>
      )}
    </View>
  );
}

// ── Bottom Tabs ───────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { uiMode } = useAppStore();
  const isGuided = uiMode === 'guided';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: isGuided ? 64 : 54,
          paddingBottom: isGuided ? 8 : 4,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🗺️" label="地图" focused={focused} isGuided={isGuided} />
          ),
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👥" label="好友" focused={focused} isGuided={isGuided} />
          ),
        }}
      />
      <Tab.Screen
        name="Routes"
        component={RoutesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📍" label="路线" focused={focused} isGuided={isGuided} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" label="设置" focused={focused} isGuided={isGuided} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Auth Stack ────────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { isLoggedIn } = useAppStore();

  if (!isLoggedIn) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth">
            {() => <AuthScreen onAuth={() => {}} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}
