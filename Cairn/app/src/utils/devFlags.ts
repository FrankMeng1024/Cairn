/**
 * devFlags.ts — feature flags.
 *
 * TEMPORARY DIAGNOSTIC MODE: bypass forced ON in this build so the user
 * can land on Home directly (sidestepping any login-flow crash) and then
 * exercise sign-out / login to capture the real failure path via
 * crashLogger + telemetry. After the diagnostic build is on the device
 * and crash logs collected, this will be reverted to:
 *   __DEV__ && process.env.EXPO_PUBLIC_PLAYWRIGHT_BYPASS === 'true'
 */

export const isPlaywrightBypass: boolean = true;

