/**
 * Mapbox configuration
 *
 * Access token should be set via environment variable or EAS secrets.
 * Never commit a real token to the repository.
 */
import Mapbox from '@rnmapbox/maps';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || 'MAPBOX_TOKEN_PLACEHOLDER';

export function initMapbox() {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
  Mapbox.setTelemetryEnabled(false);
}

export const MAP_STYLES = {
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

export type MapStyle = keyof typeof MAP_STYLES;
