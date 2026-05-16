/**
 * API configuration for Cairn backend.
 * Default: localhost:3001 for development.
 * Override via EXPO_PUBLIC_API_BASE_URL env var for production.
 */
export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
  'http://localhost:3001';
