// ============================================================
// WakeWell — Home Screen
// ============================================================
// Shows next alarm, sleep projection, and quick actions.
// ============================================================

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import useAppStore from '../store';
import { useClock, useCountdown } from '../hooks';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';
import { formatTime, timeUntil, timeToNextDate, describeRepeat, formatDuration } from '../utils';
import { suggestBedtimes } from '../services/SleepCycleEngine';

export default function HomeScreen({ navigation }) {
  const now = useClock(60000); // Update every minute
  const alarms = useAppStore((s) => s.alarms);
  const toggleAlarm = useAppStore((s) => s.toggleAlarm);
  const isTracking = useAppStore((s) => s.isTracking);

  // Find next active alarm
  const nextAlarm = useMemo(() => {
    const active = alarms.filter((a) => a.isEnabled);
    if (active.length === 0) return null;

    // Find the soonest alarm
    return active.reduce((closest, alarm) => {
      const next = timeToNextDate(alarm.time.hour, alarm.time.minute);
      const closestNext = closest
        ? timeToNextDate(closest.time.hour, closest.time.minute)
        : null;
      return !closestNext || next < closestNext
        ? alarm
        : closest;
    }, null);
  }, [alarms, now]);

  const nextAlarmDate = nextAlarm
    ? timeToNextDate(nextAlarm.time.hour, nextAlarm.time.minute)
    : null;

  const countdown = useCountdown(nextAlarmDate);

  // Bedtime suggestions for next alarm
  const bedtimeSuggestions = useMemo(() => {
    if (!nextAlarmDate) return [];
    return suggestBedtimes(nextAlarmDate, 4);
  }, [nextAlarmDate]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>WakeWell</Text>
          <Text style={styles.currentTime}>{formatTime(now)}</Text>
        </View>

        {/* Next Alarm Card */}
        {nextAlarm ? (
          <View style={styles.nextAlarmCard}>
            <View style={styles.alarmTimeRow}>
              <Icon name="sunrise" size={24} color={COLORS.accent} />
              <Text style={styles.alarmTime}>
                {formatTime(nextAlarmDate)}
              </Text>
              <View style={styles.smartBadge}>
                <Icon name="zap" size={12} color={COLORS.nightDeep} />
                <Text style={styles.smartBadgeText}>Smart</Text>
              </View>
            </View>

            <Text style={styles.alarmLabel}>{nextAlarm.label}</Text>
            <Text style={styles.alarmSubtext}>
              {describeRepeat(nextAlarm.repeatDays)} · Rings in{' '}
              {countdown.hours}h {countdown.minutes}m
            </Text>

            {/* Sleep duration projection */}
            <View style={styles.sleepProjection}>
              <Icon name="moon" size={16} color={COLORS.primaryLight} />
              <Text style={styles.projectionText}>
                If you sleep now: ~{formatDuration(
                  (nextAlarmDate - now) / 60000
                )} of sleep
              </Text>
            </View>

            {/* Start tracking button */}
            <TouchableOpacity
              style={styles.startButton}
              onPress={() =>
                navigation.navigate('SleepTracking', { alarmId: nextAlarm.id })
              }
            >
              <Icon name="play" size={18} color={COLORS.nightDeep} />
              <Text style={styles.startButtonText}>
                {isTracking ? 'Tracking Active...' : 'Start Sleep Tracking'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noAlarmCard}>
            <Icon name="moon" size={48} color={COLORS.textMuted} />
            <Text style={styles.noAlarmText}>No alarm set</Text>
            <Text style={styles.noAlarmSubtext}>
              Tap + to create your first smart alarm
            </Text>
          </View>
        )}

        {/* Bedtime Suggestions */}
        {nextAlarm && bedtimeSuggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggested Bedtimes</Text>
            <Text style={styles.sectionSubtitle}>
              For waking at {formatTime(nextAlarmDate)}
            </Text>
            {bedtimeSuggestions.map((suggestion, idx) => (
              <View
                key={idx}
                style={[
                  styles.bedtimeRow,
                  suggestion.recommendation === 'recommended' &&
                    styles.bedtimeRecommended,
                ]}
              >
                <View>
                  <Text style={styles.bedtimeTime}>
                    {formatTime(suggestion.bedtime)}
                  </Text>
                  <Text style={styles.bedtimeCycles}>
                    {suggestion.label}
                  </Text>
                </View>
                {suggestion.recommendation === 'recommended' && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Best</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Alarm List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Alarms</Text>
          {alarms.length === 0 ? (
            <Text style={styles.emptyText}>
              No alarms yet. Tap + to add one.
            </Text>
          ) : (
            alarms.map((alarm) => (
              <TouchableOpacity
                key={alarm.id}
                style={styles.alarmRow}
                onPress={() =>
                  navigation.navigate('AlarmSetup', { alarmId: alarm.id })
                }
              >
                <View>
                  <Text
                    style={[
                      styles.alarmRowTime,
                      !alarm.isEnabled && styles.disabled,
                    ]}
                  >
                    {`${alarm.time.hour % 12 || 12}:${alarm.time.minute
                      .toString()
                      .padStart(2, '0')} ${alarm.time.hour >= 12 ? 'PM' : 'AM'}`}
                  </Text>
                  <Text style={styles.alarmRowLabel}>
                    {alarm.label} · {describeRepeat(alarm.repeatDays)}
                  </Text>
                </View>
                <Switch
                  value={alarm.isEnabled}
                  onValueChange={() => toggleAlarm(alarm.id)}
                  trackColor={{
                    false: COLORS.nightLight,
                    true: COLORS.primaryDark,
                  }}
                  thumbColor={alarm.isEnabled ? COLORS.primary : COLORS.textMuted}
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB — Add Alarm */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AlarmSetup', {})}
      >
        <Icon name="plus" size={28} color={COLORS.nightDeep} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.nightDeep,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxl + 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  appName: {
    fontSize: 14,
    color: COLORS.primaryLight,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  currentTime: {
    fontSize: 44,
    color: COLORS.textPrimary,
    fontWeight: '200',
    marginTop: SPACING.xs,
  },
  nextAlarmCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.xl,
  },
  alarmTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  alarmTime: {
    fontSize: 36,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  smartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.pill,
    gap: 3,
  },
  smartBadgeText: {
    fontSize: 11,
    color: COLORS.nightDeep,
    fontWeight: '700',
  },
  alarmLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  alarmSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  sleepProjection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(123, 111, 191, 0.1)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  projectionText: {
    fontSize: 13,
    color: COLORS.primaryLight,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  startButtonText: {
    fontSize: 16,
    color: COLORS.nightDeep,
    fontWeight: '700',
  },
  noAlarmCard: {
    alignItems: 'center',
    padding: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
  noAlarmText: {
    fontSize: 20,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  noAlarmSubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  bedtimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bedtimeRecommended: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(123, 111, 191, 0.15)',
  },
  bedtimeTime: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  bedtimeCycles: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.pill,
  },
  recommendedText: {
    fontSize: 11,
    color: COLORS.white,
    fontWeight: '700',
  },
  alarmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  alarmRowTime: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  alarmRowLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  disabled: {
    opacity: 0.4,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    padding: SPACING.lg,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
