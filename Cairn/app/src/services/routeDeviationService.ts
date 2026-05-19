/**
 * RouteDeviationService — monitors GPS position against active route.
 *
 * Logic:
 * - Called on every GPS update during tracking
 * - If deviation > 50m from route polyline → trigger alert
 * - Frequency control: min 2 minutes between alerts
 * - After 5 minutes continuous deviation → prompt to switch to Free mode
 * - Back on route → reset all timers
 *
 * Uses: checkRouteDeviation() from utils/geo.ts
 */
import * as Haptics from 'expo-haptics';
import { checkRouteDeviation, type Coordinate } from '../utils/geo';
import { debugLogger } from './debugLogger';

export type DeviationCallback = (event: DeviationEvent) => void;

export interface DeviationEvent {
  type: 'alert' | 'suggest_free';
  distanceM: number;
  durationS: number;  // how long user has been off-route
}

const DEVIATION_THRESHOLD_M = 50;
const ALERT_COOLDOWN_MS = 2 * 60 * 1000;  // 2 minutes
const SUGGEST_FREE_AFTER_MS = 5 * 60 * 1000;  // 5 minutes

export class RouteDeviationService {
  private routePoints: Coordinate[] = [];
  private routeId: string | null = null;
  private isActive = false;
  private lastAlertTime = 0;
  private deviationStartTime: number | null = null;
  private maxDeviationDistance = 0;
  private suggestedFree = false;
  private onDeviation: DeviationCallback | null = null;

  /**
   * Start monitoring with the given route polyline.
   */
  start(routePoints: Coordinate[], onDeviation: DeviationCallback, routeId: string | null = null) {
    this.routePoints = routePoints;
    this.routeId = routeId;
    this.onDeviation = onDeviation;
    this.isActive = true;
    this.reset();
  }

  /**
   * Stop monitoring (called when tracking stops or route changed).
   */
  stop() {
    this.isActive = false;
    this.routePoints = [];
    this.onDeviation = null;
    this.reset();
  }

  /**
   * Switch to a new route mid-session.
   */
  switchRoute(routePoints: Coordinate[]) {
    this.routePoints = routePoints;
    this.reset();
  }

  /**
   * Called on every GPS update. Checks deviation and triggers alerts.
   */
  check(userPosition: Coordinate): { deviated: boolean; distanceM: number } {
    if (!this.isActive || this.routePoints.length < 2) {
      return { deviated: false, distanceM: 0 };
    }

    const result = checkRouteDeviation(userPosition, this.routePoints, DEVIATION_THRESHOLD_M);

    if (result.deviated) {
      // Start tracking deviation duration
      if (!this.deviationStartTime) {
        this.deviationStartTime = Date.now();
        this.maxDeviationDistance = result.distanceM;
        // Log deviation start
        debugLogger.log({
          ts: Date.now(),
          event: 'deviation_start',
          route_id: this.routeId,
          distance_m: result.distanceM,
          lat: userPosition.lat,
          lon: userPosition.lng,
        });
      } else if (result.distanceM > this.maxDeviationDistance) {
        this.maxDeviationDistance = result.distanceM;
      }

      const deviationDurationMs = Date.now() - this.deviationStartTime;
      const now = Date.now();

      // Check if we should suggest switching to Free mode
      if (deviationDurationMs >= SUGGEST_FREE_AFTER_MS && !this.suggestedFree) {
        this.suggestedFree = true;
        const durationS = Math.round(deviationDurationMs / 1000);
        debugLogger.log({
          ts: Date.now(),
          event: 'deviation_alert',
          alert_type: 'suggest_free',
          distance_m: result.distanceM,
          duration_s: durationS,
        });
        this.onDeviation?.({
          type: 'suggest_free',
          distanceM: result.distanceM,
          durationS,
        });
        return result;
      }

      // Check alert cooldown
      if (now - this.lastAlertTime >= ALERT_COOLDOWN_MS) {
        this.lastAlertTime = now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        const durationS = Math.round(deviationDurationMs / 1000);
        debugLogger.log({
          ts: Date.now(),
          event: 'deviation_alert',
          alert_type: 'alert',
          distance_m: result.distanceM,
          duration_s: durationS,
        });
        this.onDeviation?.({
          type: 'alert',
          distanceM: result.distanceM,
          durationS,
        });
      }
    } else {
      // Back on route — reset everything
      if (this.deviationStartTime) {
        const durationS = Math.round((Date.now() - this.deviationStartTime) / 1000);
        debugLogger.log({
          ts: Date.now(),
          event: 'deviation_end',
          route_id: this.routeId,
          max_distance_m: this.maxDeviationDistance,
          duration_s: durationS,
        });
        this.reset();
      }
    }

    return result;
  }

  /**
   * Reset deviation tracking (user returned to route or switched route).
   */
  private reset() {
    this.deviationStartTime = null;
    this.maxDeviationDistance = 0;
    this.lastAlertTime = 0;
    this.suggestedFree = false;
  }

  /** Whether the service is currently monitoring. */
  get active() { return this.isActive; }
}

// Singleton instance shared across the app
export const routeDeviationService = new RouteDeviationService();
