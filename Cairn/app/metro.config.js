// metro.config.js
// Fixes lucide-react-native: force CJS build instead of ESM .mjs barrel
// which Metro cannot resolve on web/RN platforms.
// Strategy: extraNodeModules maps the bare module name to the CJS file
// BEFORE package.json field resolution runs — this beats the "react-native"
// field that points to the broken ESM barrel.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Map lucide-react-native directly to its CJS barrel — bypasses package.json fields
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'lucide-react-native': path.resolve(
    __dirname,
    'node_modules/lucide-react-native/dist/cjs/lucide-react-native.js'
  ),
};

module.exports = config;
