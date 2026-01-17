const fs = require('fs');
const path = require('path');
const LOG_PATH = 'c:\\Users\\prvpa\\OneDrive\\Documents\\2026_Projects\\Reminder_Mobile\\.cursor\\debug.log';

function log(message, data, hypothesisId) {
  const entry = JSON.stringify({
    location: 'babel.config.js',
    message,
    data,
    timestamp: Date.now(),
    sessionId: 'debug-session',
    hypothesisId
  }) + '\n';
  try {
    fs.appendFileSync(LOG_PATH, entry);
  } catch (e) {
    // ignore
  }
}

module.exports = function (api) {
  log('Babel config function started', { apiCache: !!api.cache }, 'A');
  api.cache(true);
  
  try {
    const reanimatedPath = require.resolve('react-native-reanimated/plugin');
    log('Checking for reanimated plugin', { reanimatedPath }, 'B');
  } catch (e) {
    log('Reanimated plugin not found or failed to load', { error: e.message }, 'B');
  }

  try {
    const workletsPath = require.resolve('react-native-worklets/plugin');
    log('Checking for worklets plugin', { workletsPath }, 'C');
  } catch (e) {
    log('Worklets plugin not found', { error: e.message }, 'C');
  }

  return {
    presets: ['babel-preset-expo'],
  };
};
