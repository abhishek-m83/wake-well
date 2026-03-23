// ============================================================
// WakeWell — Sleep Cycle Engine
// ============================================================
// The brain of the app. Models sleep cycles, calculates optimal
// wake windows, and integrates sensor data for phase detection.
// ============================================================

import { SLEEP_CONFIG } from '../constants';

const {
  CYCLE_DURATION_MIN,
  FALL_ASLEEP_TIME_MIN,
  SMART_WINDOW_MIN,
  PHASES,
  OPTIMAL_WAKE_PHASES,
} = SLEEP_CONFIG;

/**
 * Calculate sleep cycles from bedtime to alarm time.
 * Returns an array of cycles, each with phase breakdowns
 * and timestamps.
 *
 * @param {Date} bedtime - When the user goes to bed
 * @param {Date} alarmTime - Target alarm time
 * @returns {Object} Full sleep cycle model
 */
export function modelSleepCycles(bedtime, alarmTime) {
  const sleepOnset = new Date(bedtime.getTime() + FALL_ASLEEP_TIME_MIN * 60000);
  const totalSleepMs = alarmTime.getTime() - sleepOnset.getTime();
  const totalSleepMin = totalSleepMs / 60000;
  const numFullCycles = Math.floor(totalSleepMin / CYCLE_DURATION_MIN);
  const remainderMin = totalSleepMin % CYCLE_DURATION_MIN;

  const cycles = [];
  let currentTime = new Date(sleepOnset);

  for (let i = 0; i < numFullCycles; i++) {
    const cycle = buildCycle(i + 1, currentTime, false);
    cycles.push(cycle);
    currentTime = new Date(currentTime.getTime() + CYCLE_DURATION_MIN * 60000);
  }

  // If there's a partial cycle at the end, model it
  if (remainderMin > 10) {
    const partialCycle = buildPartialCycle(numFullCycles + 1, currentTime, remainderMin);
    cycles.push(partialCycle);
  }

  return {
    bedtime,
    sleepOnset,
    alarmTime,
    totalSleepMin,
    numFullCycles,
    cycles,
    optimalWakeWindows: calculateOptimalWakeWindows(cycles, alarmTime),
    sleepScore: calculatePreSleepScore(totalSleepMin),
  };
}

/**
 * Build a complete 90-minute sleep cycle with phase timestamps.
 */
function buildCycle(cycleNumber, startTime, isPartial = false) {
  const phases = [];
  let phaseStart = new Date(startTime);

  // Later cycles have more REM, less deep sleep
  const depthModifier = Math.min(cycleNumber - 1, 3) * 0.15;
  const phaseOrder = ['LIGHT_1', 'LIGHT_2', 'DEEP', 'REM'];

  for (const phaseKey of phaseOrder) {
    const phaseConfig = PHASES[phaseKey];
    let adjustedDuration = phaseConfig.duration;

    // As night progresses: less deep sleep, more REM
    if (phaseKey === 'DEEP') {
      adjustedDuration = Math.max(10, adjustedDuration - (cycleNumber - 1) * 8);
    } else if (phaseKey === 'REM') {
      adjustedDuration = Math.min(45, adjustedDuration + (cycleNumber - 1) * 5);
    }

    const phaseEnd = new Date(phaseStart.getTime() + adjustedDuration * 60000);

    phases.push({
      key: phaseKey,
      name: phaseConfig.name,
      depth: phaseConfig.depth,
      adjustedDepth: Math.max(1, phaseConfig.depth - depthModifier),
      startTime: new Date(phaseStart),
      endTime: phaseEnd,
      durationMin: adjustedDuration,
      isOptimalWake: OPTIMAL_WAKE_PHASES.includes(phaseKey),
    });

    phaseStart = phaseEnd;
  }

  const endTime = phases[phases.length - 1].endTime;

  return {
    cycleNumber,
    startTime: new Date(startTime),
    endTime,
    durationMin: (endTime - startTime) / 60000,
    phases,
    isPartial: false,
  };
}

/**
 * Build a partial cycle (when remaining time < 90 min).
 */
function buildPartialCycle(cycleNumber, startTime, remainderMin) {
  const phases = [];
  let phaseStart = new Date(startTime);
  let remainingMin = remainderMin;
  const phaseOrder = ['LIGHT_1', 'LIGHT_2', 'DEEP', 'REM'];

  for (const phaseKey of phaseOrder) {
    if (remainingMin <= 0) break;

    const phaseConfig = PHASES[phaseKey];
    const duration = Math.min(phaseConfig.duration, remainingMin);
    const phaseEnd = new Date(phaseStart.getTime() + duration * 60000);

    phases.push({
      key: phaseKey,
      name: phaseConfig.name,
      depth: phaseConfig.depth,
      adjustedDepth: phaseConfig.depth,
      startTime: new Date(phaseStart),
      endTime: phaseEnd,
      durationMin: duration,
      isOptimalWake: OPTIMAL_WAKE_PHASES.includes(phaseKey),
    });

    remainingMin -= duration;
    phaseStart = phaseEnd;
  }

  const endTime = phases[phases.length - 1].endTime;

  return {
    cycleNumber,
    startTime: new Date(startTime),
    endTime,
    durationMin: (endTime - startTime) / 60000,
    phases,
    isPartial: true,
  };
}

/**
 * Find optimal wake windows within the smart alarm window.
 * Returns times when the user is most likely in light sleep,
 * sorted by preference (lightest first).
 *
 * @param {Array} cycles - Array of sleep cycles from modelSleepCycles
 * @param {Date} alarmTime - Target alarm time
 * @returns {Array} Sorted optimal wake windows
 */
function calculateOptimalWakeWindows(cycles, alarmTime) {
  const windowStart = new Date(alarmTime.getTime() - SMART_WINDOW_MIN * 60000);
  const windows = [];

  for (const cycle of cycles) {
    for (const phase of cycle.phases) {
      // Check if this phase overlaps with the smart window
      if (phase.endTime > windowStart && phase.startTime < alarmTime) {
        if (phase.isOptimalWake) {
          // Calculate the ideal point within this phase
          const overlapStart = new Date(Math.max(phase.startTime.getTime(), windowStart.getTime()));
          const overlapEnd = new Date(Math.min(phase.endTime.getTime(), alarmTime.getTime()));

          windows.push({
            time: overlapStart,
            endTime: overlapEnd,
            phase: phase.key,
            phaseName: phase.name,
            depth: phase.adjustedDepth,
            // Score: lower = better (lighter sleep, closer to alarm)
            score: phase.adjustedDepth + (alarmTime - overlapStart) / (SMART_WINDOW_MIN * 60000),
          });
        }
      }
    }
  }

  // Sort by score (best wake opportunity first)
  return windows.sort((a, b) => a.score - b.score);
}

/**
 * Pre-sleep score based on projected duration.
 */
function calculatePreSleepScore(totalSleepMin) {
  const hours = totalSleepMin / 60;
  if (hours < SLEEP_CONFIG.MIN_SLEEP_HOURS) return Math.max(20, hours / SLEEP_CONFIG.MIN_SLEEP_HOURS * 60);
  if (hours <= SLEEP_CONFIG.RECOMMENDED_SLEEP_HOURS) return 60 + (hours - SLEEP_CONFIG.MIN_SLEEP_HOURS) / (SLEEP_CONFIG.RECOMMENDED_SLEEP_HOURS - SLEEP_CONFIG.MIN_SLEEP_HOURS) * 40;
  if (hours <= SLEEP_CONFIG.MAX_SLEEP_HOURS) return 100;
  return Math.max(70, 100 - (hours - SLEEP_CONFIG.MAX_SLEEP_HOURS) * 10); // Oversleep penalty
}

/**
 * Suggest optimal bedtimes given a wake-up time.
 * Returns multiple options aligned with complete sleep cycles.
 *
 * @param {Date} wakeTime - Desired wake-up time
 * @param {number} numSuggestions - How many options to provide (default 4)
 * @returns {Array} Bedtime suggestions with cycle counts
 */
export function suggestBedtimes(wakeTime, numSuggestions = 4) {
  const suggestions = [];

  // Work backwards from wake time: 4, 5, 6, 7 full cycles
  for (let cycles = 4; cycles <= 4 + numSuggestions - 1; cycles++) {
    const sleepDurationMin = cycles * CYCLE_DURATION_MIN;
    const totalTimeMin = sleepDurationMin + FALL_ASLEEP_TIME_MIN;
    const bedtime = new Date(wakeTime.getTime() - totalTimeMin * 60000);
    const sleepHours = sleepDurationMin / 60;

    let recommendation = 'okay';
    if (sleepHours >= 7 && sleepHours <= 8) recommendation = 'recommended';
    else if (sleepHours >= 8.5) recommendation = 'generous';
    else if (sleepHours < 6) recommendation = 'insufficient';

    suggestions.push({
      bedtime,
      cycles,
      sleepDurationMin,
      sleepHours,
      recommendation,
      label: `${cycles} cycles · ${sleepHours}h sleep`,
    });
  }

  return suggestions;
}

/**
 * Given current sensor data, estimate which sleep phase the user is in.
 * Uses accelerometer movement patterns to distinguish phases.
 *
 * @param {Array} movementHistory - Recent movement readings [{timestamp, magnitude}]
 * @param {Date} sleepOnset - When the user fell asleep
 * @param {Date} currentTime - Current time
 * @returns {Object} Estimated current phase
 */
export function estimateCurrentPhase(movementHistory, sleepOnset, currentTime) {
  const { SENSOR } = SLEEP_CONFIG;

  if (!movementHistory || movementHistory.length < 5) {
    // Not enough data — fall back to algorithmic model
    return estimatePhaseFromTime(sleepOnset, currentTime);
  }

  // Calculate recent movement statistics
  const recentWindow = movementHistory.slice(-SENSOR.WINDOW_SIZE_SEC);
  const avgMovement = recentWindow.reduce((sum, r) => sum + r.magnitude, 0) / recentWindow.length;
  const variance = recentWindow.reduce((sum, r) => sum + Math.pow(r.magnitude - avgMovement, 2), 0) / recentWindow.length;

  // Classify based on movement patterns
  if (avgMovement <= SENSOR.DEEP_SLEEP_MOVEMENT_MAX && variance < 0.01) {
    return {
      phase: 'DEEP',
      confidence: 0.75,
      method: 'sensor',
      movement: avgMovement,
      recommendation: 'NOT a good time to wake — deep sleep detected',
    };
  }

  if (avgMovement >= SENSOR.LIGHT_SLEEP_MOVEMENT_MIN) {
    return {
      phase: 'LIGHT_2',
      confidence: 0.65,
      method: 'sensor',
      movement: avgMovement,
      recommendation: 'Good time to wake — light sleep with movement',
    };
  }

  if (variance >= SENSOR.REM_MOVEMENT_VARIANCE && avgMovement < SENSOR.LIGHT_SLEEP_MOVEMENT_MIN) {
    return {
      phase: 'REM',
      confidence: 0.55,
      method: 'sensor',
      movement: avgMovement,
      recommendation: 'Acceptable to wake — REM sleep (may recall dreams)',
    };
  }

  // Ambiguous — blend sensor with time model
  const timeEstimate = estimatePhaseFromTime(sleepOnset, currentTime);
  return {
    ...timeEstimate,
    confidence: 0.45,
    method: 'blended',
    movement: avgMovement,
  };
}

/**
 * Fallback: estimate sleep phase purely from elapsed time.
 */
function estimatePhaseFromTime(sleepOnset, currentTime) {
  const elapsedMin = (currentTime - sleepOnset) / 60000;
  const cyclePosition = elapsedMin % CYCLE_DURATION_MIN;
  const cycleNumber = Math.floor(elapsedMin / CYCLE_DURATION_MIN) + 1;

  // Map position within cycle to phase
  if (cyclePosition < 5) {
    return { phase: 'LIGHT_1', confidence: 0.5, method: 'time', cycleNumber };
  } else if (cyclePosition < 30) {
    return { phase: 'LIGHT_2', confidence: 0.5, method: 'time', cycleNumber };
  } else if (cyclePosition < 65) {
    return { phase: 'DEEP', confidence: 0.5, method: 'time', cycleNumber };
  } else {
    return { phase: 'REM', confidence: 0.5, method: 'time', cycleNumber };
  }
}

/**
 * Determine the actual optimal alarm time based on sensor + algorithm.
 * This is called by the alarm scheduler to decide when to trigger.
 *
 * @param {Object} sleepModel - From modelSleepCycles()
 * @param {Array} movementHistory - Sensor data (or empty for manual mode)
 * @returns {Date} Optimized alarm time
 */
export function determineOptimalAlarmTime(sleepModel, movementHistory = []) {
  const { alarmTime, optimalWakeWindows } = sleepModel;
  const now = new Date();
  const windowStart = new Date(alarmTime.getTime() - SMART_WINDOW_MIN * 60000);

  // If we're not yet in the smart window, return the first optimal window
  if (now < windowStart) {
    return optimalWakeWindows.length > 0 ? optimalWakeWindows[0].time : alarmTime;
  }

  // We're inside the smart window — use sensor data if available
  if (movementHistory.length > 10) {
    const currentPhase = estimateCurrentPhase(movementHistory, sleepModel.sleepOnset, now);

    if (currentPhase.phase === 'LIGHT_1' || currentPhase.phase === 'LIGHT_2') {
      // User is in light sleep NOW — trigger immediately!
      return now;
    }

    if (currentPhase.phase === 'REM') {
      // REM is acceptable but not ideal — wait a few minutes for transition
      const waitTime = new Date(now.getTime() + 3 * 60000);
      return waitTime < alarmTime ? waitTime : alarmTime;
    }

    // Deep sleep — wait for the next light phase or hit the hard deadline
    return alarmTime;
  }

  // No sensor data — use algorithmic windows
  if (optimalWakeWindows.length > 0) {
    // Find the first window that's still in the future
    const futureWindows = optimalWakeWindows.filter(w => w.time > now);
    if (futureWindows.length > 0) {
      return futureWindows[0].time;
    }
  }

  // Fallback: alarm fires at target time
  return alarmTime;
}

export default {
  modelSleepCycles,
  suggestBedtimes,
  estimateCurrentPhase,
  determineOptimalAlarmTime,
};
