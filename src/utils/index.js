// ============================================================
// WakeWell — Utility Functions
// ============================================================

/**
 * Format a Date to "10:30 PM" style.
 */
export function formatTime(date) {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

/**
 * Format a Date to "10:30" 24h style.
 */
export function formatTime24(date) {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Format duration in minutes to "7h 30m" style.
 */
export function formatDuration(minutes) {
  if (!minutes || minutes < 0) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Format a Date to "Mon, Mar 15" style.
 */
export function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Get time remaining until a target time as a human string.
 * "8h 15m from now"
 */
export function timeUntil(targetDate) {
  const now = new Date();
  const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
  let diffMs = target - now;

  if (diffMs < 0) return 'now';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  diffMs -= hours * 1000 * 60 * 60;
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Convert { hour, minute } to a Date object for today/tomorrow.
 * If the time has already passed today, returns tomorrow's date.
 */
export function timeToNextDate(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  // If the time has already passed today, set it for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

/**
 * Get day names from day numbers.
 * @param {Array} days - [0, 1, 5] -> ['Sun', 'Mon', 'Fri']
 */
export function getDayNames(days) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map(d => names[d]);
}

/**
 * Describe repeat pattern in human terms.
 * [1,2,3,4,5] -> "Weekdays"
 * [0,6] -> "Weekends"
 * [] -> "Once"
 */
export function describeRepeat(days) {
  if (!days || days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';

  const weekdays = [1, 2, 3, 4, 5];
  const weekends = [0, 6];

  if (weekdays.every(d => days.includes(d)) && days.length === 5)
    return 'Weekdays';
  if (weekends.every(d => days.includes(d)) && days.length === 2)
    return 'Weekends';

  return getDayNames(days.sort()).join(', ');
}

/**
 * Calculate sleep quality score from multiple factors.
 * Returns 0–100.
 */
export function calculateSleepQuality({
  durationMin,
  wakePhase,
  freshnessRating,
  consistencyDeviation = 0,
  sensorQuality = null,
}) {
  const {QUALITY_WEIGHTS} = require('../constants').ANALYTICS_CONFIG;
  let score = 0;

  // Duration score (0–100)
  const hours = durationMin / 60;
  let durationScore;
  if (hours < 4) durationScore = 10;
  else if (hours < 6) durationScore = 30 + (hours - 4) * 15;
  else if (hours <= 8) durationScore = 60 + (hours - 6) * 20;
  else if (hours <= 9) durationScore = 100;
  else durationScore = Math.max(60, 100 - (hours - 9) * 15);
  score += durationScore * QUALITY_WEIGHTS.duration;

  // Wake phase score
  const phaseScores = {LIGHT_1: 100, LIGHT_2: 90, REM: 70, DEEP: 30};
  const wakeScore = phaseScores[wakePhase] || 50;
  score += wakeScore * QUALITY_WEIGHTS.wakePhase;

  // Consistency score (lower deviation = better)
  const consistencyScore = Math.max(0, 100 - consistencyDeviation * 20);
  score += consistencyScore * QUALITY_WEIGHTS.consistency;

  // Efficiency (if sensor data available)
  const efficiencyScore = sensorQuality || 75;
  score += efficiencyScore * QUALITY_WEIGHTS.efficiency;

  // Freshness (self-reported, scaled 1-5 → 0-100)
  const freshnessScore = freshnessRating ? (freshnessRating / 5) * 100 : 60;
  score += freshnessScore * QUALITY_WEIGHTS.freshness;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Generate a color for sleep quality score.
 */
export function qualityColor(score) {
  if (score >= 80) return '#6BCB77'; // green
  if (score >= 60) return '#F9E784'; // yellow
  if (score >= 40) return '#F2A65A'; // orange
  return '#E85D75'; // red
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
