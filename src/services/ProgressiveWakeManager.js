// ============================================================
// WakeWell — Progressive Wake Manager
// ============================================================
// Orchestrates the multi-stage wake-up experience:
// nature sounds → ambient music → familiar melody → alert.
// Manages volume curves, screen brightness, and sound layering.
// ============================================================

import {WAKE_CONFIG, SOUND_LIBRARY} from '../constants';

/**
 * Calculate interpolated value between start and end based on progress (0–1).
 */
function lerp(start, end, progress) {
  return start + (end - start) * Math.max(0, Math.min(1, progress));
}

/**
 * Determine which stage we're in given current time and alarm time.
 * Returns stage config + progress within that stage.
 */
export function getCurrentWakeStage(currentTime, alarmTime) {
  const stages = WAKE_CONFIG.STAGES;

  for (const stage of stages) {
    const stageStartTime = new Date(
      alarmTime.getTime() - stage.startMinBefore * 60000,
    );
    const stageEndTime = new Date(
      alarmTime.getTime() - stage.endMinBefore * 60000,
    );

    if (currentTime >= stageStartTime && currentTime < stageEndTime) {
      const totalDuration = stageEndTime - stageStartTime;
      const elapsed = currentTime - stageStartTime;
      const progress = totalDuration > 0 ? elapsed / totalDuration : 0;

      return {
        stage,
        progress,
        volume: lerp(stage.volumeStart, stage.volumeEnd, progress),
        brightness: lerp(stage.brightnessStart, stage.brightnessEnd, progress),
        isActive: true,
      };
    }
  }

  // Not in any stage yet
  const firstStageStart = new Date(
    alarmTime.getTime() - stages[0].startMinBefore * 60000,
  );
  if (currentTime < firstStageStart) {
    return {
      stage: null,
      progress: 0,
      volume: 0,
      brightness: 0,
      isActive: false,
    };
  }

  // Past all stages — full alert
  return {
    stage: stages[stages.length - 1],
    progress: 1,
    volume: 1.0,
    brightness: 1.0,
    isActive: true,
  };
}

/**
 * Get the list of sounds that should be playing at the current stage.
 * Layers build up progressively.
 *
 * @param {Object} stageInfo - From getCurrentWakeStage()
 * @param {Object} preferences - User's selected sounds per category
 * @returns {Array} Sound objects with their target volumes
 */
export function getActiveSounds(stageInfo, preferences = {}) {
  if (!stageInfo.isActive || !stageInfo.stage) return [];

  const {stage, volume} = stageInfo;
  const activeSounds = [];

  for (const soundType of stage.soundTypes) {
    const preferredId = preferences[soundType];
    const library = SOUND_LIBRARY[soundType] || [];

    // Find preferred sound or use first in category
    const sound = library.find(s => s.id === preferredId) || library[0];
    if (!sound) continue;

    // Earlier sound types are quieter (background), latest is loudest
    const typeIndex = stage.soundTypes.indexOf(soundType);
    const layerRatio =
      stage.soundTypes.length > 1
        ? 0.4 + 0.6 * (typeIndex / (stage.soundTypes.length - 1))
        : 1.0;

    activeSounds.push({
      ...sound,
      targetVolume: volume * layerRatio,
      isNewLayer: typeIndex === stage.soundTypes.length - 1,
    });
  }

  return activeSounds;
}

/**
 * Generate the full wake timeline for display/preview purposes.
 * Shows what will happen at each minute of the wake sequence.
 *
 * @param {Date} alarmTime - Target alarm time
 * @param {Object} preferences - Sound preferences
 * @returns {Array} Timeline entries
 */
export function generateWakeTimeline(alarmTime, preferences = {}) {
  const timeline = [];
  const totalDuration = WAKE_CONFIG.TOTAL_DURATION_MIN + 5; // +5 for alert stage
  const startTime = new Date(
    alarmTime.getTime() - WAKE_CONFIG.TOTAL_DURATION_MIN * 60000,
  );

  for (let min = 0; min <= totalDuration; min++) {
    const time = new Date(startTime.getTime() + min * 60000);
    const stageInfo = getCurrentWakeStage(time, alarmTime);
    const sounds = getActiveSounds(stageInfo, preferences);

    timeline.push({
      minuteOffset: min - WAKE_CONFIG.TOTAL_DURATION_MIN, // negative = before alarm
      time,
      stageName: stageInfo.stage?.name || 'Waiting',
      stageId: stageInfo.stage?.id || 'waiting',
      volume: Math.round(stageInfo.volume * 100),
      brightness: Math.round(stageInfo.brightness * 100),
      activeSounds: sounds.map(s => s.name),
      description: stageInfo.stage?.description || 'Sequence not started',
    });
  }

  return timeline;
}

/**
 * Dismiss challenge generator.
 * Creates a challenge the user must complete to dismiss the alarm.
 */
export function generateDismissChallenge(type = 'math') {
  const challenges = WAKE_CONFIG.DISMISS_CHALLENGES;
  const config = challenges.find(c => c.id === type) || challenges[0];

  switch (config.id) {
    case 'math': {
      const a = Math.floor(Math.random() * 30) + 10;
      const b = Math.floor(Math.random() * 20) + 5;
      const ops = ['+', '-', '×'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      let answer;
      switch (op) {
        case '+':
          answer = a + b;
          break;
        case '-':
          answer = a - b;
          break;
        case '×':
          answer = a * b;
          break;
        default:
          answer = a + b;
      }
      return {
        type: 'math',
        prompt: `Solve: ${a} ${op} ${b} = ?`,
        answer: answer.toString(),
        validate: input => parseInt(input, 10) === answer,
      };
    }

    case 'breathing': {
      return {
        type: 'breathing',
        prompt: 'Complete a 4-7-8 breathing cycle',
        steps: [
          {instruction: 'Breathe IN through your nose', duration: 4},
          {instruction: 'HOLD your breath', duration: 7},
          {instruction: 'Breathe OUT through your mouth', duration: 8},
        ],
        totalDuration: config.duration || 60,
        validate: completed => completed === true,
      };
    }

    case 'shake': {
      return {
        type: 'shake',
        prompt: `Shake your phone ${config.count} times!`,
        targetCount: config.count || 20,
        currentCount: 0,
        validate: count => count >= (config.count || 20),
      };
    }

    case 'pattern': {
      const gridSize = config.gridSize || 3;
      const patternLength = 4;
      const pattern = [];
      for (let i = 0; i < patternLength; i++) {
        let cell;
        do {
          cell = Math.floor(Math.random() * gridSize * gridSize);
        } while (pattern.includes(cell));
        pattern.push(cell);
      }
      return {
        type: 'pattern',
        prompt: 'Repeat the pattern',
        gridSize,
        pattern,
        validate: input =>
          Array.isArray(input) &&
          input.length === pattern.length &&
          input.every((v, i) => v === pattern[i]),
      };
    }

    default:
      return generateDismissChallenge('math');
  }
}

/**
 * Compute how much to adjust screen brightness (0–1).
 * Respects system brightness and user preferences.
 *
 * @param {number} targetBrightness - Wake stage brightness (0–1)
 * @param {number} userMaxBrightness - User's preferred max brightness (0–1)
 * @returns {number} Adjusted brightness value
 */
export function computeScreenBrightness(
  targetBrightness,
  userMaxBrightness = 1.0,
) {
  // Apply an ease-in curve for more natural brightness ramp
  const eased = targetBrightness * targetBrightness; // quadratic ease-in
  return eased * userMaxBrightness;
}

export default {
  getCurrentWakeStage,
  getActiveSounds,
  generateWakeTimeline,
  generateDismissChallenge,
  computeScreenBrightness,
};
