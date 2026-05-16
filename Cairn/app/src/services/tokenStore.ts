/**
 * Thin abstraction over token storage.
 * - Native (iOS/Android): expo-secure-store
 * - Web: localStorage
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'cairn_jwt';

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    return SecureStore.getItemAsync(TOKEN_KEY);
  } else {
    return localStorage.getItem(TOKEN_KEY);
  }
}

export async function clearToken(): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
