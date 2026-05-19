/**
 * Mapbox configuration
 *
 * Access token should be set via environment variable or EAS secrets.
 * Never commit a real token to the repository.
 */
import { Platform } from 'react-native';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

export function initMapbox() {
  if (Platform.OS === 'web') {
    // On web, set token directly on mapbox-gl (async import to avoid SSR issues)
    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN;
    });
  } else {
    // Native only: @rnmapbox/maps API
    const Mapbox = require('@rnmapbox/maps').default;
    Mapbox.setAccessToken(MAPBOX_TOKEN);
    Mapbox.setTelemetryEnabled(false);
  }
}

export const MAP_STYLES = {
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

export type MapStyle = keyof typeof MAP_STYLES;

/**
 * PRD3 E-013 — Cairn Topo style.
 *
 * Custom Mapbox style inspired by NZ Topo50 paper maps:
 *   background  cream  #F7F2E5
 *   contours    sepia  #b5823d  opacity 0.4
 *   vegetation  mint   #c9d9c5  opacity 0.6
 *   water              #8ba8c0
 *   roads       muted (don't compete with terrain)
 *
 * The style is served from Mapbox Studio.  We fall back to
 * `outdoors-v12` if the custom style fails to load (see MapScreen /
 * HikingScreen / RouteEditorScreen).
 *
 * To publish: create a new style in Mapbox Studio, apply the colour
 * tokens above, publish, then replace the placeholder URL below with
 * the real style URL (format: mapbox://styles/<user>/<styleId>).
 *
 * NOTE: Until the Studio style is published, we fall back to
 * `outdoors-v12`.  The constant is exported so all map screens can
 * reference a single source of truth.
 */
export const CAIRN_TOPO_STYLE_URL =
  process.env.EXPO_PUBLIC_CAIRN_TOPO_STYLE_URL ?? MAP_STYLES.outdoors;

/**
 * Resolve the best available map style for primary views.
 * Reads CAIRN_TOPO_STYLE_URL at runtime so that the style can be
 * overridden via environment variable without a code change.
 */
export function getPrimaryMapStyle(): string {
  return CAIRN_TOPO_STYLE_URL;
}
