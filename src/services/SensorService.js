// ============================================================
// WakeWell — Sensor Service
// ============================================================
// Monitors accelerometer/gyroscope to detect sleep movement.
// Falls back gracefully to manual mode when sensors unavailable.
// ============================================================

import {SLEEP_CONFIG} from '../constants';

const {SENSOR} = SLEEP_CONFIG;

/**
 * SensorService — manages accelerometer data collection
 * for sleep movement tracking.
 *
 * Usage:
 *   import SensorService from './SensorService';
 *
 *   // Start tracking
 *   SensorService.startTracking({
 *     onMovement: (data) => console.log(data),
 *     onPhaseEstimate: (phase) => console.log(phase),
 *     onError: (err) => console.error(err),
 *   });
 *
 *   // Stop tracking
 *   SensorService.stopTracking();
 *
 *   // Get movement history
 *   const history = SensorService.getMovementHistory();
 */

class SensorService {
  constructor() {
    this.isTracking = false;
    this.subscription = null;
    this.movementHistory = [];
    this.windowBuffer = [];
    this.callbacks = {};
    this.sensorAvailable = false;
    this.lastReading = null;
  }

  /**
   * Check if accelerometer is available on this device.
   * Call this before startTracking() to determine if sensor
   * mode is possible.
   *
   * @returns {Promise<boolean>}
   */
  async checkAvailability() {
    try {
      // react-native-sensors provides an availability check
      const {accelerometer} = require('react-native-sensors');
      // Try to get a single reading
      return new Promise(resolve => {
        const sub = accelerometer.subscribe(
          () => {
            sub.unsubscribe();
            this.sensorAvailable = true;
            resolve(true);
          },
          () => {
            this.sensorAvailable = false;
            resolve(false);
          },
        );
        // Timeout after 2 seconds
        setTimeout(() => {
          sub.unsubscribe();
          resolve(false);
        }, 2000);
      });
    } catch (error) {
      this.sensorAvailable = false;
      return false;
    }
  }

  /**
   * Start collecting accelerometer data.
   *
   * @param {Object} callbacks
   * @param {Function} callbacks.onMovement - Called each sampling window with aggregated data
   * @param {Function} callbacks.onPhaseEstimate - Called when phase detection updates
   * @param {Function} callbacks.onError - Called on sensor errors
   */
  startTracking(callbacks = {}) {
    if (this.isTracking) {
      console.warn('SensorService: Already tracking');
      return;
    }

    this.callbacks = callbacks;
    this.movementHistory = [];
    this.windowBuffer = [];
    this.isTracking = true;

    try {
      const {
        accelerometer,
        setUpdateIntervalForType,
        SensorTypes,
      } = require('react-native-sensors');

      // Set sampling rate
      setUpdateIntervalForType(
        SensorTypes.accelerometer,
        SENSOR.SAMPLING_RATE_MS,
      );

      this.subscription = accelerometer.subscribe(
        ({x, y, z, timestamp}) => {
          this._processReading(x, y, z, timestamp || Date.now());
        },
        error => {
          console.error('Accelerometer error:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          this._fallbackToManual();
        },
      );
    } catch (error) {
      console.warn(
        'SensorService: Accelerometer unavailable, using manual mode',
      );
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      this._fallbackToManual();
    }
  }

  /**
   * Stop collecting sensor data.
   */
  stopTracking() {
    this.isTracking = false;
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * Get the full movement history.
   * @returns {Array} Movement readings with timestamps
   */
  getMovementHistory() {
    return [...this.movementHistory];
  }

  /**
   * Get movement data aggregated into windows for the sleep cycle engine.
   * @returns {Array} Windowed movement data
   */
  getWindowedData() {
    return this._aggregateToWindows(this.movementHistory);
  }

  /**
   * Get a summary of the night's movement.
   * Useful for analytics.
   */
  getMovementSummary() {
    if (this.movementHistory.length === 0) {
      return {available: false, method: 'none'};
    }

    const magnitudes = this.movementHistory.map(r => r.magnitude);
    const avg = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const max = Math.max(...magnitudes);
    const min = Math.min(...magnitudes);

    // Count restless periods (above threshold)
    const restlessReadings = magnitudes.filter(
      m => m > SENSOR.LIGHT_SLEEP_MOVEMENT_MIN,
    );
    const restlessPercent = (restlessReadings.length / magnitudes.length) * 100;

    // Count stillness periods (deep sleep indicators)
    const stillReadings = magnitudes.filter(
      m => m <= SENSOR.DEEP_SLEEP_MOVEMENT_MAX,
    );
    const deepSleepPercent = (stillReadings.length / magnitudes.length) * 100;

    return {
      available: true,
      method: 'sensor',
      totalReadings: magnitudes.length,
      averageMovement: avg,
      maxMovement: max,
      minMovement: min,
      restlessPercent: Math.round(restlessPercent),
      deepSleepPercent: Math.round(deepSleepPercent),
      estimatedSleepQuality: this._estimateQualityFromMovement(
        avg,
        restlessPercent,
      ),
    };
  }

  // ---- Private Methods ----

  /**
   * Process a raw accelerometer reading.
   * Calculates movement magnitude and buffers for windowing.
   */
  _processReading(x, y, z, timestamp) {
    // Calculate magnitude of acceleration change (subtract gravity ~9.8)
    const rawMagnitude = Math.sqrt(x * x + y * y + z * z);

    // We care about deviation from gravity, not absolute magnitude
    const movementMagnitude = Math.abs(rawMagnitude - 9.81);

    const reading = {
      timestamp,
      x,
      y,
      z,
      magnitude: movementMagnitude,
    };

    this.lastReading = reading;
    this.windowBuffer.push(reading);

    // When we have enough readings for a window, aggregate
    if (this.windowBuffer.length >= SENSOR.WINDOW_SIZE_SEC) {
      const aggregated = this._aggregateWindow(this.windowBuffer);
      this.movementHistory.push(aggregated);
      this.windowBuffer = [];

      if (this.callbacks.onMovement) {
        this.callbacks.onMovement(aggregated);
      }
    }
  }

  /**
   * Aggregate a buffer of raw readings into a single window reading.
   */
  _aggregateWindow(buffer) {
    const magnitudes = buffer.map(r => r.magnitude);
    const avg = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const max = Math.max(...magnitudes);
    const variance =
      magnitudes.reduce((sum, m) => sum + Math.pow(m - avg, 2), 0) /
      magnitudes.length;

    return {
      timestamp: buffer[buffer.length - 1].timestamp,
      magnitude: avg,
      maxMagnitude: max,
      variance,
      readingCount: buffer.length,
      classification: this._classifyMovement(avg, variance),
    };
  }

  /**
   * Classify movement level for display purposes.
   */
  _classifyMovement(avgMagnitude, variance) {
    if (avgMagnitude <= SENSOR.DEEP_SLEEP_MOVEMENT_MAX) return 'still';
    if (avgMagnitude >= SENSOR.LIGHT_SLEEP_MOVEMENT_MIN) return 'restless';
    if (variance >= SENSOR.REM_MOVEMENT_VARIANCE) return 'twitching'; // possible REM
    return 'light';
  }

  /**
   * Aggregate movement history into larger windows.
   */
  _aggregateToWindows(history) {
    // Already windowed at WINDOW_SIZE_SEC level
    return history;
  }

  /**
   * Estimate sleep quality from movement patterns (0–100).
   */
  _estimateQualityFromMovement(avgMovement, restlessPercent) {
    let score = 100;
    // Penalize excessive movement
    if (avgMovement > 0.2) score -= 20;
    else if (avgMovement > 0.1) score -= 10;

    // Penalize restlessness
    if (restlessPercent > 30) score -= 25;
    else if (restlessPercent > 15) score -= 10;

    return Math.max(10, Math.min(100, score));
  }

  /**
   * Fallback when sensors are unavailable.
   * Generates synthetic "no data" markers so the app
   * can gracefully use the time-based model instead.
   */
  _fallbackToManual() {
    this.sensorAvailable = false;
    this.stopTracking();
    // The SleepCycleEngine will use estimatePhaseFromTime()
    // when movementHistory is empty
  }
}

// Export singleton instance
export default new SensorService();
