/**
 * Navigation Controller — orchestrates route tracking, deviation detection,
 * waypoint arrival, and broadcast triggers during an active session.
 *
 * This is the "brain" that runs on each GPS tick during tracking with an active route.
 *
 * Sprint 48 — STORY-00161
 */
import { checkRouteDeviation, isWithinRadius, type Coordinate } from '../utils/geo';
import { announceP0, announceP1, broadcastService } from './broadcastService';
import { useRouteStore, type Route, type Waypoint } from '../store/useRouteStore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface NavigationState {
  isNavigating: boolean;
  activeRoute: Route | null;
  isDeviated: boolean;
  deviationDistanceM: number;
  visitedWaypointIds: Set<string>;
  lastDeviationAlert: number; // timestamp of last deviation announcement
}

// ── Controller ──────────────────────────────────────────────────────────────

const DEVIATION_COOLDOWN_MS = 30000; // Don't repeat deviation alert within 30s
const DEVIATION_THRESHOLD_M = 50;

class NavigationController {
  private state: NavigationState = {
    isNavigating: false,
    activeRoute: null,
    isDeviated: false,
    deviationDistanceM: 0,
    visitedWaypointIds: new Set(),
    lastDeviationAlert: 0,
  };

  /**
   * Start navigation with a route.
   */
  startNavigation(route: Route): void {
    this.state = {
      isNavigating: true,
      activeRoute: route,
      isDeviated: false,
      deviationDistanceM: 0,
      visitedWaypointIds: new Set(),
      lastDeviationAlert: 0,
    };
    announceP1(`Navigation started. Follow route: ${route.name}`);
  }

  /**
   * Stop navigation.
   */
  stopNavigation(): void {
    if (this.state.isNavigating && this.state.activeRoute) {
      // Increment run count
      useRouteStore.getState().incrementRunCount(this.state.activeRoute.id);
    }
    this.state = {
      isNavigating: false,
      activeRoute: null,
      isDeviated: false,
      deviationDistanceM: 0,
      visitedWaypointIds: new Set(),
      lastDeviationAlert: 0,
    };
  }

  /**
   * Process a GPS tick during active navigation.
   * Called on every accepted (Kalman-filtered) GPS point.
   *
   * @returns Navigation feedback for UI (deviation status, nearby waypoint, etc.)
   */
  onGPSTick(position: Coordinate): {
    deviated: boolean;
    deviationM: number;
    arrivedWaypoint: Waypoint | null;
  } {
    const result = {
      deviated: false,
      deviationM: 0,
      arrivedWaypoint: null as Waypoint | null,
    };

    if (!this.state.isNavigating || !this.state.activeRoute) return result;

    const route = this.state.activeRoute;

    // 1. Check route deviation
    const routeCoords: Coordinate[] = route.points.map(p => ({ lat: p.lat, lng: p.lng }));
    const deviation = checkRouteDeviation(position, routeCoords, DEVIATION_THRESHOLD_M);
    result.deviated = deviation.deviated;
    result.deviationM = deviation.distanceM;
    this.state.isDeviated = deviation.deviated;
    this.state.deviationDistanceM = deviation.distanceM;

    // Announce deviation (with cooldown)
    if (deviation.deviated) {
      const now = Date.now();
      if (now - this.state.lastDeviationAlert > DEVIATION_COOLDOWN_MS) {
        const distText = deviation.distanceM > 100
          ? `${Math.round(deviation.distanceM / 10) * 10} meters`
          : `${Math.round(deviation.distanceM)} meters`;
        announceP0(`Off route. You are ${distText} from your planned path.`);
        this.state.lastDeviationAlert = now;
      }
    }

    // 2. Check waypoint arrivals
    for (const waypoint of route.waypoints) {
      if (this.state.visitedWaypointIds.has(waypoint.id)) continue;

      if (isWithinRadius(position, waypoint.lat, waypoint.lng, waypoint.radiusM)) {
        this.state.visitedWaypointIds.add(waypoint.id);
        result.arrivedWaypoint = waypoint;

        if (waypoint.announceOnArrival) {
          announceP1(waypoint.label);
        }
        break; // Only one waypoint arrival per tick
      }
    }

    return result;
  }

  /**
   * Get current navigation state (for UI).
   */
  getState(): Readonly<NavigationState> {
    return this.state;
  }

  /**
   * Check if currently navigating.
   */
  isActive(): boolean {
    return this.state.isNavigating;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const navigationController = new NavigationController();
