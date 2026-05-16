/**
 * Auth service — wraps backend API calls for register / login / me / logout.
 * Returns a typed result so callers can handle errors inline without try/catch.
 */
import { API_BASE_URL } from '../config/api';
import { saveToken, clearToken, getToken } from './tokenStore';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  user?: UserProfile;
  token?: string;
  error?: string;
  // 2-step registration: backend sent a code, frontend shows verify screen
  step?: 'verify';
  email?: string;
}

async function post(path: string, body: object): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const res = await post('/api/auth/register', { name, email, password });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || data?.message || 'Registration failed.' };
    }
    // Backend sends a verification code — frontend must show the verify screen
    return { step: 'verify', email: data.email };
  } catch {
    return { error: 'Unable to connect. Please try again.' };
  }
}

export async function verifyCode(email: string, code: string): Promise<AuthResult> {
  try {
    const res = await post('/api/auth/verify', { email, code });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || 'Verification failed.' };
    }
    await saveToken(data.token);
    return { user: data.user, token: data.token };
  } catch {
    return { error: 'Unable to connect. Please try again.' };
  }
}

export async function resendCode(email: string): Promise<{ error?: string }> {
  try {
    const res = await post('/api/auth/resend', { email });
    const data = await res.json();
    if (!res.ok) return { error: data?.error || 'Could not resend code.' };
    return {};
  } catch {
    return { error: 'Unable to connect. Please try again.' };
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await post('/api/auth/login', { email, password });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || data?.message || 'Sign in failed. Check your email and password.' };
    }
    await saveToken(data.token);
    return { user: data.user, token: data.token };
  } catch {
    return { error: 'Unable to connect. Please try again.' };
  }
}

/**
 * Called on app launch to verify stored JWT and get current user profile.
 * Returns null if no token or token is invalid/expired.
 */
export async function getMe(): Promise<UserProfile | null> {
  try {
    const token = await getToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      await clearToken();
      return null;
    }
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function loginWithGoogle(idToken: string): Promise<AuthResult> {
  try {
    const res = await post('/api/auth/google', { id_token: idToken });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || 'Google sign-in failed. Please try again.' };
    }
    await saveToken(data.token);
    return { user: data.user, token: data.token };
  } catch {
    return { error: 'Unable to connect. Please try again.' };
  }
}

export async function logout(): Promise<void> {
  await clearToken();
}
