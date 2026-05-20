/**
 * crashLogger — global JS error handler that captures crashes BEFORE they
 * surface to the native layer.
 *
 * Why: native iOS crash logs (.ips files) only show C++ frames, not JS
 * source. Without this, every crash report is uninterpretable. With this,
 * we capture the JS error + stack + lifecycle context and either:
 *   1. Persist to AsyncStorage under `cairn_last_crash` for next-launch upload
 *   2. Write to debugLogger (which telemetryUploader auto-uploads)
 *
 * Triggers:
 *   - Uncaught JS exceptions: ErrorUtils.setGlobalHandler
 *   - Unhandled promise rejections: process listener
 *
 * Setup: call install() once at App.tsx top level.
 */
import { Platform } from 'react-native';
import { storage } from '../store/storage';
import { debugLogger } from './debugLogger';

const CRASH_KEY = 'cairn_last_crash';

interface CrashReport {
  ts: number;
  type: 'js_error' | 'unhandled_rejection';
  message: string;
  stack: string;
  isFatal?: boolean;
  appState?: string;
  reactNativeVersion?: string;
  // Last few logger events before crash (helps identify what user was doing)
  lastEvents?: string[];
}

// Module-level ring buffer — captures last 20 events even if logger session is off
let recentEvents: string[] = [];
const MAX_RECENT = 20;

function recordRecent(line: string): void {
  recentEvents.push(`${new Date().toISOString()} ${line}`);
  if (recentEvents.length > MAX_RECENT) recentEvents.shift();
}

async function persistCrash(report: CrashReport): Promise<void> {
  try {
    await storage.setItem(CRASH_KEY, JSON.stringify(report));
  } catch {
    /* nothing more we can do */
  }
  // Also push into debugLogger if a session is active — telemetry uploader
  // will auto-flush this to backend on next foreground.
  try {
    debugLogger.log({
      ts: report.ts,
      event: 'error',
      source: report.type,
      message: report.message,
      stack: report.stack,
      fatal: report.isFatal ?? true,
    } as any);
  } catch {
    /* logger may be off — persistence above is the fallback */
  }
}

export const crashLogger = {
  /**
   * Install global error + rejection handlers. Idempotent.
   */
  install(): void {
    if ((global as any).__cairnCrashLoggerInstalled) return;
    (global as any).__cairnCrashLoggerInstalled = true;

    // 1. Uncaught JS exceptions
    const ErrorUtils = (global as any).ErrorUtils;
    if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
      const prevHandler = ErrorUtils.getGlobalHandler?.();
      ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        const report: CrashReport = {
          ts: Date.now(),
          type: 'js_error',
          message: error?.message ?? String(error),
          stack: error?.stack ?? 'no stack',
          isFatal,
          reactNativeVersion: Platform.constants?.reactNativeVersion
            ? JSON.stringify(Platform.constants.reactNativeVersion)
            : undefined,
          lastEvents: [...recentEvents],
        };
        // Persist FIRST (sync-ish via Promise — RN may still kill us mid-flight,
        // but AsyncStorage on iOS uses fast NSUserDefaults for small writes).
        persistCrash(report);
        // Then defer to RN's default handler so the redbox / native crash
        // still surfaces to the user (don't swallow fatal errors).
        if (prevHandler) prevHandler(error, isFatal);
      });
    }

    // 2. Unhandled promise rejections
    const p = (global as any).process;
    if (p && typeof p.on === 'function') {
      p.on('unhandledRejection', (reason: any) => {
        const report: CrashReport = {
          ts: Date.now(),
          type: 'unhandled_rejection',
          message: reason?.message ?? String(reason),
          stack: reason?.stack ?? 'no stack',
          lastEvents: [...recentEvents],
        };
        persistCrash(report);
      });
    }
  },

  /**
   * Add a breadcrumb to the recent-events ring buffer.
   * Call from key user actions (screen navigation, button taps, etc.)
   * so the crash report shows what the user was doing.
   */
  breadcrumb(line: string): void {
    recordRecent(line);
  },

  /**
   * Read & clear the last persisted crash. Call on app startup;
   * if a crash was persisted, send it to backend telemetry.
   */
  async drainLastCrash(): Promise<CrashReport | null> {
    try {
      const raw = await storage.getItem(CRASH_KEY);
      if (!raw) return null;
      const report = JSON.parse(raw) as CrashReport;
      await storage.removeItem(CRASH_KEY);
      return report;
    } catch {
      return null;
    }
  },
};
