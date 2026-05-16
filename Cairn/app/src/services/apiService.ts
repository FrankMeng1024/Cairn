/**
 * Authenticated fetch utility.
 * Adds Bearer token header and intercepts 401 responses.
 * On 401: clears token, resets auth state, sets sessionExpired flag.
 *
 * Import and use instead of fetch() for any authenticated endpoint.
 */
import { API_BASE_URL } from '../config/api';
import { getToken, clearToken } from './tokenStore';
import { useAppStore } from '../store/useAppStore';

export async function authenticatedFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    await clearToken();
    const store = useAppStore.getState();
    store.logout();
    store.setSessionExpired(true);
  }

  return res;
}
