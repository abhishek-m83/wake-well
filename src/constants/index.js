// ============================================================
// WakeWell — Constants & Theme
// ============================================================

export const COLORS = {
  // Primary palette — deep night-to-dawn gradient
  nightDeep: '#0B0E1A',
  nightMid: '#141830',
  nightLight: '#1E2444',
  twilight: '#2D3561',
  dawnPurple: '#5B4A8A',
  dawnPink: '#C97B84',
  dawnOrange: '#F2A65A',
  sunriseYellow: '#F9E784',
  dayLight: '#FFFDF7',

  // UI colors
  primary: '#7B6FBF',
  primaryLight: '#A89FD6',
  primaryDark: '#5B4A8A',
  accent: '#F2A65A',
  accentSoft: '#F9E784',
  success: '#6BCB77',
  warning: '#F2A65A',
  danger: '#E85D75',

  // Neutrals
  white: '#FFFFFF',
  textPrimary: '#EEEDF5',
  textSecondary: '#9B97B0',
  textMuted: '#6B6780',
  cardBg: 'rgba(30, 36, 68, 0.6)',
  cardBorder: 'rgba(123, 111, 191, 0.2)',
  overlay: 'rgba(11, 14, 26, 0.85)',
};

export const FONTS = {
  // Using system fonts with fallbacks — replace with custom fonts after setup
  heading: 'System', // Replace with 'Outfit-Bold' or similar
  subheading: 'System', // Replace with 'Outfit-SemiBold'
  body: 'System', // Replace with 'DM Sans'
  mono: 'monospace', // For time displays
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

// ============================================================
// Sleep Cycle Configuration
// ============================================================
export const SLEEP_CONFIG = {
  // Average sleep cycle duration in minutes
  CYCLE_DURATION_MIN: 90,

  // Time to fall asleep (sleep onset latency) in minutes
  FALL_ASLEEP_TIME_MIN: 14,

  // Smart alarm window — how many minutes before target to start looking
  SMART_WINDOW_MIN: 30,

  // Sleep phases within a 90-min cycle (approximate durations in minutes)
  PHASES: {
    LIGHT_1: {name: 'Light Sleep (N1)', duration: 5, depth: 1},
    LIGHT_2: {name: 'Light Sleep (N2)', duration: 25, depth: 2},
    DEEP: {name: 'Deep Sleep (N3)', duration: 35, depth: 4},
    REM: {name: 'REM Sleep', duration: 25, depth: 2},
  },

  // Optimal phases to wake during (lower depth = easier wake)
  OPTIMAL_WAKE_PHASES: ['LIGHT_1', 'LIGHT_2', 'REM'],

  // Minimum recommended sleep hours
  MIN_SLEEP_HOURS: 6,
  RECOMMENDED_SLEEP_HOURS: 7.5,
  MAX_SLEEP_HOURS: 9,

  // Sensor thresholds for movement detection
  SENSOR: {
    ACCELEROMETER_THRESHOLD: 0.15, // g-force threshold for movement
    SAMPLING_RATE_MS: 1000, // Read sensor every 1 second
    WINDOW_SIZE_SEC: 30, // Aggregate movement over 30s windows
    DEEP_SLEEP_MOVEMENT_MAX: 0.05, // Very low movement = deep sleep
    LIGHT_SLEEP_MOVEMENT_MIN: 0.1, // Some movement = lighter sleep
    REM_MOVEMENT_VARIANCE: 0.08, // REM has small twitches
  },
};

// ============================================================
// Progressive Wake Configuration
// ============================================================
export const WAKE_CONFIG = {
  // Total progressive wake duration in minutes
  TOTAL_DURATION_MIN: 15,

  // Stage definitions
  STAGES: [
    {
      id: 'pre_wake',
      name: 'Pre-Wake',
      startMinBefore: 15, // starts 15 min before alarm
      endMinBefore: 8,
      volumeStart: 0.02,
      volumeEnd: 0.1,
      brightnessStart: 0.0,
      brightnessEnd: 0.15,
      soundTypes: ['nature'], // soft nature only
      description: 'Gentle ambient sounds begin softly',
    },
    {
      id: 'rising',
      name: 'Rising',
      startMinBefore: 8,
      endMinBefore: 3,
      volumeStart: 0.1,
      volumeEnd: 0.35,
      brightnessStart: 0.15,
      brightnessEnd: 0.5,
      soundTypes: ['nature', 'ambient'], // nature + soft music
      description: 'Sounds layer in, brightness increases',
    },
    {
      id: 'wake',
      name: 'Wake',
      startMinBefore: 3,
      endMinBefore: 0,
      volumeStart: 0.35,
      volumeEnd: 0.65,
      brightnessStart: 0.5,
      brightnessEnd: 0.85,
      soundTypes: ['nature', 'ambient', 'familiar'], // + familiar music
      description: 'Familiar melody joins, full brightness',
    },
    {
      id: 'alert',
      name: 'Alert',
      startMinBefore: 0,
      endMinBefore: -5, // continues 5 min after target
      volumeStart: 0.65,
      volumeEnd: 1.0,
      brightnessStart: 0.85,
      brightnessEnd: 1.0,
      soundTypes: ['familiar', 'alert'],
      description: 'Full alert — requires dismissal challenge',
    },
  ],

  // Dismiss challenge types
  DISMISS_CHALLENGES: [
    {id: 'math', name: 'Math Problem', difficulty: 'easy'},
    {id: 'breathing', name: 'Breathing Exercise', duration: 60},
    {id: 'shake', name: 'Shake Phone', count: 20},
    {id: 'pattern', name: 'Pattern Match', gridSize: 3},
  ],
};

// ============================================================
// Sound Library Definitions
// ============================================================
export const SOUND_LIBRARY = {
  nature: [
    {
      id: 'birds_morning',
      name: 'Morning Birds',
      file: 'birds_morning.mp3',
      category: 'nature',
    },
    {
      id: 'rain_light',
      name: 'Light Rain',
      file: 'rain_light.mp3',
      category: 'nature',
    },
    {
      id: 'ocean_gentle',
      name: 'Gentle Ocean',
      file: 'ocean_gentle.mp3',
      category: 'nature',
    },
    {
      id: 'forest_stream',
      name: 'Forest Stream',
      file: 'forest_stream.mp3',
      category: 'nature',
    },
    {
      id: 'wind_chimes',
      name: 'Wind Chimes',
      file: 'wind_chimes.mp3',
      category: 'nature',
    },
  ],
  ambient: [
    {
      id: 'piano_soft',
      name: 'Soft Piano',
      file: 'piano_soft.mp3',
      category: 'ambient',
    },
    {
      id: 'lofi_morning',
      name: 'Lo-fi Morning',
      file: 'lofi_morning.mp3',
      category: 'ambient',
    },
    {
      id: 'guitar_acoustic',
      name: 'Acoustic Guitar',
      file: 'guitar_acoustic.mp3',
      category: 'ambient',
    },
    {
      id: 'harp_gentle',
      name: 'Gentle Harp',
      file: 'harp_gentle.mp3',
      category: 'ambient',
    },
  ],
  familiar: [
    // These would be populated from user's music library or curated melodic alarms
    {
      id: 'melodic_rise',
      name: 'Melodic Rise',
      file: 'melodic_rise.mp3',
      category: 'familiar',
    },
    {
      id: 'morning_theme',
      name: 'Morning Theme',
      file: 'morning_theme.mp3',
      category: 'familiar',
    },
  ],
  alert: [
    {
      id: 'chime_bright',
      name: 'Bright Chime',
      file: 'chime_bright.mp3',
      category: 'alert',
    },
    {
      id: 'bell_clear',
      name: 'Clear Bell',
      file: 'bell_clear.mp3',
      category: 'alert',
    },
  ],
};

// ============================================================
// Analytics Configuration
// ============================================================
export const ANALYTICS_CONFIG = {
  // How many days of data to keep
  MAX_HISTORY_DAYS: 90,

  // Sleep quality score weights
  QUALITY_WEIGHTS: {
    duration: 0.3, // Did they sleep enough?
    consistency: 0.2, // Same bedtime/waketime?
    efficiency: 0.2, // Time in bed vs actual sleep
    wakePhase: 0.15, // Did they wake in light sleep?
    freshness: 0.15, // Self-reported freshness rating
  },

  // Freshness rating scale
  FRESHNESS_SCALE: {
    1: {label: 'Exhausted', emoji: '😫', color: COLORS.danger},
    2: {label: 'Groggy', emoji: '😴', color: COLORS.warning},
    3: {label: 'Okay', emoji: '😐', color: COLORS.accentSoft},
    4: {label: 'Good', emoji: '🙂', color: COLORS.primaryLight},
    5: {label: 'Excellent', emoji: '✨', color: COLORS.success},
  },
};
