// ============================================================
// WakeWell — Custom React Hooks
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import SensorService from '../services/SensorService';
import { modelSleepCycles, determineOptimalAlarmTime } from '../services/SleepCycleEngine';
import { getCurrentWakeStage, getActiveSounds } from '../services/ProgressiveWakeManager';
import useAppStore from '../store';

/**
 * Hook: Live clock that updates every second.
 * Returns current Date object.
 */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/**
 * Hook: Countdown to a target time.
 * Returns { hours, minutes, seconds, totalSeconds, isReached }.
 */
export function useCountdown(targetDate) {
  const now = useClock();

  if (!targetDate) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isReached: true };
  }

  const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const diffMs = target - now;

  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isReached: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalSeconds, isReached: false };
}

/**
 * Hook: Sleep cycle model for the current alarm.
 * Recalculates when bedtime or alarm time changes.
 */
export function useSleepModel(bedtime, alarmTime) {
  const [model, setModel] = useState(null);

  useEffect(() => {
    if (bedtime && alarmTime) {
      const bed = bedtime instanceof Date ? bedtime : new Date(bedtime);
      const alarm = alarmTime instanceof Date ? alarmTime : new Date(alarmTime);
      const sleepModel = modelSleepCycles(bed, alarm);
      setModel(sleepModel);
    }
  }, [bedtime, alarmTime]);

  return model;
}

/**
 * Hook: Sensor tracking manager.
 * Handles starting/stopping sensors and provides movement data.
 */
export function useSensorTracking() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [movementData, setMovementData] = useState([]);
  const [lastReading, setLastReading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    SensorService.checkAvailability().then(setIsAvailable);
  }, []);

  const start = useCallback(() => {
    SensorService.startTracking({
      onMovement: (data) => {
        setMovementData((prev) => [...prev, data]);
        setLastReading(data);
      },
      onError: (err) => {
        setError(err);
        setIsActive(false);
      },
    });
    setIsActive(true);
    setMovementData([]);
    setError(null);
  }, []);

  const stop = useCallback(() => {
    SensorService.stopTracking();
    setIsActive(false);
  }, []);

  const getSummary = useCallback(() => {
    return SensorService.getMovementSummary();
  }, []);

  return {
    isAvailable,
    isActive,
    movementData,
    lastReading,
    error,
    start,
    stop,
    getSummary,
  };
}

/**
 * Hook: Progressive wake state tracker.
 * Updates every second during the wake sequence.
 */
export function useProgressiveWake(alarmTime, preferences) {
  const now = useClock();
  const [wakeInfo, setWakeInfo] = useState({
    isActive: false,
    stage: null,
    progress: 0,
    volume: 0,
    brightness: 0,
    activeSounds: [],
  });

  useEffect(() => {
    if (!alarmTime) return;

    const alarm = alarmTime instanceof Date ? alarmTime : new Date(alarmTime);
    const stageInfo = getCurrentWakeStage(now, alarm);
    const sounds = getActiveSounds(stageInfo, preferences);

    setWakeInfo({
      isActive: stageInfo.isActive,
      stage: stageInfo.stage,
      progress: stageInfo.progress,
      volume: stageInfo.volume,
      brightness: stageInfo.brightness,
      activeSounds: sounds,
    });
  }, [now, alarmTime, preferences]);

  return wakeInfo;
}

/**
 * Hook: App state listener (foreground/background).
 * Important for resuming tracking after app comes back.
 */
export function useAppStateListener(onForeground, onBackground) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (onForeground) onForeground();
      } else if (nextState.match(/inactive|background/)) {
        if (onBackground) onBackground();
      }
      appState.current = nextState;
    });

    return () => subscription?.remove();
  }, [onForeground, onBackground]);
}

/**
 * Hook: Sleep analytics computed from store.
 */
export function useSleepAnalytics() {
  const getSleepStats = useAppStore((state) => state.getSleepStats);
  const sleepHistory = useAppStore((state) => state.sleepHistory);

  const [stats, setStats] = useState(getSleepStats());

  useEffect(() => {
    setStats(getSleepStats());
  }, [sleepHistory, getSleepStats]);

  return stats;
}
