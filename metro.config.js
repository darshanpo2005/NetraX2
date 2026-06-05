const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle .tflite model files as assets so require() works
config.resolver.assetExts.push('tflite');

module.exports = config;
