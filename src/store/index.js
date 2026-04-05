// ============================================================
// WakeWell — State Management (Zustand)
// ============================================================
// Central app state using Zustand with AsyncStorage persistence.
// Manages alarms, sleep records, settings, and UI state.
// ============================================================

import {create} from 'zustand';
import {ANALYTICS_CONFIG, SLEEP_CONFIG} from '../constants';

/**
 * Main app store.
 * In production, wrap with zustand/middleware `persist` + AsyncStorage.
 */
export const useAppStore = create((set, get) => ({
  // ---- Alarm State ----
  alarms: [],
  activeAlarmId: null,

  addAlarm: alarm =>
    set(state => ({
      alarms: [
        ...state.alarms,
        {
          id: alarm.id || `alarm_${Date.now()}`,
          time: alarm.time, // { hour, minute }
          label: alarm.label || 'Wake Up',
          repeatDays: alarm.repeatDays || [], // [0=Sun..6=Sat]
          isEnabled: true,
          smartAlarmEnabled: alarm.smartAlarmEnabled ?? true,
          smartWindowMin: alarm.smartWindowMin || SLEEP_CONFIG.SMART_WINDOW_MIN,
          soundPreferences: alarm.soundPreferences || {
            nature: 'birds_morning',
            ambient: 'piano_soft',
            familiar: 'melodic_rise',
            alert: 'chime_bright',
          },
          dismissChallenge: alarm.dismissChallenge || 'math',
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  updateAlarm: (id, updates) =>
    set(state => ({
      alarms: state.alarms.map(a => (a.id === id ? {...a, ...updates} : a)),
    })),

  removeAlarm: id =>
    set(state => ({
      alarms: state.alarms.filter(a => a.id !== id),
    })),

  toggleAlarm: id =>
    set(state => ({
      alarms: state.alarms.map(a =>
        a.id === id ? {...a, isEnabled: !a.isEnabled} : a,
      ),
    })),

  setActiveAlarm: id => set({activeAlarmId: id}),

  // ---- Sleep Tracking State ----
  isTracking: false,
  currentSession: null,

  startSleepSession: alarmId =>
    set({
      isTracking: true,
      currentSession: {
        alarmId,
        bedtime: new Date().toISOString(),
        sleepOnset: null,
        wakeTime: null,
        sensorData: [],
        phases: [],
      },
    }),

  updateSession: updates =>
    set(state => ({
      currentSession: state.currentSession
        ? {...state.currentSession, ...updates}
        : null,
    })),

  endSleepSession: freshnessRating => {
    const session = get().currentSession;
    if (!session) return;

    const record = {
      ...session,
      wakeTime: new Date().toISOString(),
      freshnessRating: freshnessRating || 3,
      completedAt: new Date().toISOString(),
    };

    set(state => ({
      isTracking: false,
      currentSession: null,
      sleepHistory: [record, ...state.sleepHistory].slice(
        0,
        ANALYTICS_CONFIG.MAX_HISTORY_DAYS,
      ),
    }));

    return record;
  },

  // ---- Sleep History & Analytics ----
  sleepHistory: [],

  getSleepStats: () => {
    const history = get().sleepHistory;
    if (history.length === 0) {
      return {
        averageDuration: 0,
        averageFreshness: 0,
        consistencyScore: 0,
        totalNights: 0,
        streak: 0,
        bestNight: null,
        worstNight: null,
        weeklyTrend: [],
      };
    }

    // Calculate durations
    const durations = history.map(r => {
      const bed = new Date(r.bedtime);
      const wake = new Date(r.wakeTime);
      return (wake - bed) / (1000 * 60 * 60); // hours
    });

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Freshness scores
    const freshness = history
      .filter(r => r.freshnessRating)
      .map(r => r.freshnessRating);
    const avgFreshness =
      freshness.length > 0
        ? freshness.reduce((a, b) => a + b, 0) / freshness.length
        : 0;

    // Consistency: how regular are bedtimes?
    const bedtimeHours = history.map(r => {
      const d = new Date(r.bedtime);
      let h = d.getHours() + d.getMinutes() / 60;
      if (h < 12) h += 24; // normalize past midnight
      return h;
    });
    const avgBedtime =
      bedtimeHours.reduce((a, b) => a + b, 0) / bedtimeHours.length;
    const bedtimeVariance =
      bedtimeHours.reduce((sum, h) => sum + Math.pow(h - avgBedtime, 2), 0) /
      bedtimeHours.length;
    const consistencyScore = Math.max(0, 100 - bedtimeVariance * 20);

    // Streak: consecutive nights tracked
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < history.length; i++) {
      const recordDate = new Date(history[i].bedtime);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      if (
        recordDate.toDateString() === expectedDate.toDateString() ||
        (i === 0 && today - recordDate < 24 * 60 * 60 * 1000)
      ) {
        streak++;
      } else {
        break;
      }
    }

    // Best/worst nights
    const bestIdx = freshness.indexOf(Math.max(...freshness));
    const worstIdx = freshness.indexOf(Math.min(...freshness));

    // Weekly trend (last 7 entries)
    const weeklyTrend = history.slice(0, 7).map((r, i) => ({
      day: i,
      duration: durations[i],
      freshness: r.freshnessRating || 0,
      date: r.bedtime,
    }));

    return {
      averageDuration: Math.round(avgDuration * 10) / 10,
      averageFreshness: Math.round(avgFreshness * 10) / 10,
      consistencyScore: Math.round(consistencyScore),
      totalNights: history.length,
      streak,
      bestNight: history[bestIdx] || null,
      worstNight: history[worstIdx] || null,
      weeklyTrend: weeklyTrend.reverse(),
    };
  },

  // ---- Settings ----
  settings: {
    useSensors: true,
    smartAlarmDefault: true,
    defaultSmartWindow: SLEEP_CONFIG.SMART_WINDOW_MIN,
    maxBrightness: 1.0,
    vibrationEnabled: true,
    dismissChallengeType: 'math',
    theme: 'dark', // always dark for a sleep app
    fallAsleepTimeMin: SLEEP_CONFIG.FALL_ASLEEP_TIME_MIN,
    showSleepPhases: true,
  },

  updateSettings: updates =>
    set(state => ({
      settings: {...state.settings, ...updates},
    })),

  // ---- Wake State ----
  wakeState: {
    isWaking: false,
    currentStage: null,
    volume: 0,
    brightness: 0,
    dismissed: false,
  },

  setWakeState: updates =>
    set(state => ({
      wakeState: {...state.wakeState, ...updates},
    })),

  resetWakeState: () =>
    set({
      wakeState: {
        isWaking: false,
        currentStage: null,
        volume: 0,
        brightness: 0,
        dismissed: false,
      },
    }),
}));

/**
 * Persistence middleware setup.
 * Call this once on app initialization to hydrate state from AsyncStorage.
 */
export async function hydrateStore() {
  try {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const stored = await AsyncStorage.getItem('wakewell_store');
    if (stored) {
      const parsed = JSON.parse(stored);
      useAppStore.setState({
        alarms: parsed.alarms || [],
        sleepHistory: parsed.sleepHistory || [],
        settings: {
          ...useAppStore.getState().settings,
          ...(parsed.settings || {}),
        },
      });
    }
  } catch (error) {
    console.warn('Failed to hydrate store:', error);
  }
}

/**
 * Subscribe to store changes and persist to AsyncStorage.
 */
export function enablePersistence() {
  useAppStore.subscribe(state => {
    try {
      const AsyncStorage =
        require('@react-native-async-storage/async-storage').default;
      const toStore = {
        alarms: state.alarms,
        sleepHistory: state.sleepHistory,
        settings: state.settings,
      };
      AsyncStorage.setItem('wakewell_store', JSON.stringify(toStore));
    } catch (error) {
      console.warn('Failed to persist store:', error);
    }
  });
}

export default useAppStore;
