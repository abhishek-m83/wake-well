// ============================================================
// WakeWell — Sleep Tracking Screen
// ============================================================
// Active during sleep — shows tracking status, sleep phases,
// and countdown to alarm. Minimal UI to avoid bright display.
// ============================================================

import React, {useEffect, useState, useRef, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import useAppStore from '../store';
import {
  useClock,
  useCountdown,
  useSensorTracking,
  useSleepModel,
  useAppStateListener,
} from '../hooks';
import {COLORS, SPACING, BORDER_RADIUS} from '../constants';
import {formatTime, timeToNextDate, formatDuration} from '../utils';
import AlarmScheduler from '../services/AlarmScheduler';

export default function SleepTrackingScreen({navigation, route}) {
  const {alarmId} = route.params || {};
  const alarm = useAppStore(s => s.alarms.find(a => a.id === alarmId));
  const startSleepSession = useAppStore(s => s.startSleepSession);
  const settings = useAppStore(s => s.settings);

  useClock(10000); // Update every 10 sec (battery saving)
  const sensor = useSensorTracking();
  const [trackingStarted, setTrackingStarted] = useState(false);
  const smartAlarmFired = useRef(false);

  // Alarm date
  const alarmDate = alarm
    ? timeToNextDate(alarm.time.hour, alarm.time.minute)
    : null;
  const countdown = useCountdown(alarmDate);

  // Sleep model
  const sleepModel = useSleepModel(new Date(), alarmDate);

  // Start tracking on mount
  useEffect(() => {
    if (!trackingStarted && alarm) {
      startSleepSession(alarmId);
      setTrackingStarted(true);

      // Start sensor if available and enabled
      if (settings.useSensors && sensor.isAvailable) {
        sensor.start();
      }

      // Start foreground service
      AlarmScheduler.startSleepTrackingService(alarmId);
    }

    return () => {
      sensor.stop();
      AlarmScheduler.stopSleepTrackingService();
    };
  }, [
    alarm,
    alarmId,
    sensor,
    settings.useSensors,
    startSleepSession,
    trackingStarted,
  ]);

  // Resume sensor tracking if app returns to foreground mid-sleep
  const handleForeground = useCallback(() => {
    if (
      trackingStarted &&
      settings.useSensors &&
      sensor.isAvailable &&
      !sensor.isActive
    ) {
      sensor.start();
    }
  }, [trackingStarted, settings.useSensors, sensor]);

  useAppStateListener(handleForeground, null);

  // Smart alarm: watch each incoming sensor window and fire early if light sleep detected
  useEffect(() => {
    if (
      !alarm?.smartAlarmEnabled ||
      !alarmDate ||
      !sensor.isActive ||
      smartAlarmFired.current
    ) {
      return;
    }

    const latestWindows = sensor.movementData;
    if (latestWindows.length < 2) return;

    const now = new Date();
    const msUntilAlarm = alarmDate - now;
    const smartWindowMs = (alarm.smartWindowMin || 30) * 60 * 1000;

    // Only look for a wake window inside the smart window
    if (msUntilAlarm > smartWindowMs || msUntilAlarm < 0) return;

    // Check that the last 2 consecutive windows are both non-restless
    const recent = latestWindows.slice(-2);
    const allLight = recent.every(
      w => w.classification === 'still' || w.classification === 'light',
    );

    if (allLight) {
      smartAlarmFired.current = true;
      // Cancel the pending push notification — we're handling it in-app
      AlarmScheduler.cancelAlarm(alarmId);
      AlarmScheduler.stopSleepTrackingService();
      sensor.stop();
      // Navigate to WakeScreen with the original alarm time so the
      // progressive wake sequence picks up at the right stage
      navigation.replace('Wake', {alarmTime: alarmDate.toISOString()});
    }
  }, [sensor.movementData, alarm, alarmDate, alarmId, sensor, navigation]);

  const handleCancel = () => {
    sensor.stop();
    AlarmScheduler.stopSleepTrackingService();
    AlarmScheduler.cancelAlarm(alarmId);
    navigation.goBack();
  };

  if (!alarm) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Alarm not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Ultra-dim display for nighttime */}
      <View style={styles.content}>
        {/* Moon icon */}
        <Icon
          name="moon"
          size={48}
          color={COLORS.primaryDark}
          style={styles.moonIcon}
        />

        {/* Alarm time */}
        <Text style={styles.alarmTimeLabel}>Alarm set for</Text>
        <Text style={styles.alarmTime}>{formatTime(alarmDate)}</Text>

        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownValue}>
            {countdown.hours}h {countdown.minutes}m
          </Text>
          <Text style={styles.countdownLabel}>until wake-up</Text>
        </View>

        {/* Sleep info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Icon name="activity" size={16} color={COLORS.primaryLight} />
            <Text style={styles.infoText}>
              {sensor.isActive ? 'Sensor tracking active' : 'Using sleep model'}
            </Text>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: sensor.isActive
                    ? COLORS.success
                    : COLORS.accent,
                },
              ]}
            />
          </View>

          {sleepModel && (
            <View style={styles.infoRow}>
              <Icon name="layers" size={16} color={COLORS.primaryLight} />
              <Text style={styles.infoText}>
                {sleepModel.numFullCycles} sleep cycles projected
              </Text>
            </View>
          )}

          {sleepModel && (
            <View style={styles.infoRow}>
              <Icon name="clock" size={16} color={COLORS.primaryLight} />
              <Text style={styles.infoText}>
                {formatDuration(sleepModel.totalSleepMin)} of sleep
              </Text>
            </View>
          )}

          {alarm.smartAlarmEnabled &&
            (() => {
              const now = new Date();
              const msUntilAlarm = alarmDate ? alarmDate - now : 0;
              const smartWindowMs = (alarm.smartWindowMin || 30) * 60 * 1000;
              const inWindow =
                msUntilAlarm > 0 && msUntilAlarm <= smartWindowMs;
              const minsUntilWindow = Math.ceil(
                (msUntilAlarm - smartWindowMs) / 60000,
              );
              return (
                <View style={styles.infoRow}>
                  <Icon
                    name="zap"
                    size={16}
                    color={inWindow ? COLORS.success : COLORS.accent}
                  />
                  <Text style={styles.infoText}>
                    {inWindow
                      ? 'Smart alarm active — watching for light sleep'
                      : `Smart alarm window opens in ${minsUntilWindow}m`}
                  </Text>
                </View>
              );
            })()}
        </View>

        {/* Sensor movement indicator */}
        {sensor.isActive && sensor.lastReading && (
          <View style={styles.sensorDisplay}>
            <Text style={styles.sensorLabel}>Movement Level</Text>
            <View style={styles.movementBar}>
              <View
                style={[
                  styles.movementFill,
                  {
                    width: `${Math.min(
                      100,
                      sensor.lastReading.magnitude * 500,
                    )}%`,
                    backgroundColor:
                      sensor.lastReading.classification === 'still'
                        ? COLORS.success
                        : sensor.lastReading.classification === 'restless'
                        ? COLORS.warning
                        : COLORS.primaryLight,
                  },
                ]}
              />
            </View>
            <Text style={styles.sensorStatus}>
              {sensor.lastReading.classification === 'still'
                ? '💤 Deep sleep'
                : sensor.lastReading.classification === 'restless'
                ? '🌊 Light sleep'
                : '✨ Transitioning'}
            </Text>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipCard}>
          <Icon name="info" size={14} color={COLORS.textMuted} />
          <Text style={styles.tipText}>
            {settings.useSensors && sensor.isAvailable
              ? 'Place your phone on the mattress near your pillow for best tracking'
              : 'Sleep well — the smart alarm will calculate your best wake time'}
          </Text>
        </View>
      </View>

      {/* Cancel button */}
      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Icon name="x-circle" size={18} color={COLORS.danger} />
        <Text style={styles.cancelText}>Cancel Alarm</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050810', // Even darker than nightDeep for sleep mode
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  moonIcon: {
    opacity: 0.4,
    marginBottom: SPACING.xl,
  },
  alarmTimeLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  alarmTime: {
    fontSize: 52,
    color: COLORS.textPrimary,
    fontWeight: '200',
    marginTop: SPACING.xs,
    opacity: 0.7, // Dimmer for nighttime
  },
  countdownContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  countdownValue: {
    fontSize: 28,
    color: COLORS.primaryLight,
    fontWeight: '300',
  },
  countdownLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: 'rgba(20, 24, 48, 0.6)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sensorDisplay: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  sensorLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  movementBar: {
    height: 4,
    backgroundColor: COLORS.nightLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  movementFill: {
    height: '100%',
    borderRadius: 2,
  },
  sensorStatus: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    opacity: 0.5,
  },
  tipText: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    position: 'absolute',
    bottom: SPACING.xxl,
    left: 0,
    right: 0,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.danger,
    fontWeight: '500',
  },
  errorText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  backText: {
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
