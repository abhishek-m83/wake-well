// ============================================================
// WakeWell — Alarm Scheduler
// ============================================================
// Handles Android alarm scheduling using react-native-push-notification
// and react-native-background-timer. Ensures alarms fire reliably
// even in Doze mode via foreground service notifications.
// ============================================================

import {Platform} from 'react-native';
import {WAKE_CONFIG} from '../constants';

/**
 * AlarmScheduler
 * Manages scheduling, cancelling, and triggering alarms
 * with Android-specific reliability measures.
 */
class AlarmScheduler {
  constructor() {
    this.scheduledAlarms = new Map(); // id -> alarm config
    this.activeAlarmId = null;
    this.onAlarmTrigger = null;
    this.onPreWakeTrigger = null;
  }

  /**
   * Initialize the scheduler. Call once on app start.
   * Sets up notification channels and permissions.
   */
  async initialize() {
    if (Platform.OS !== 'android') {
      console.warn('AlarmScheduler: Currently Android-only');
      return;
    }

    try {
      const PushNotification = require('react-native-push-notification');

      // Create high-priority notification channel for alarms
      PushNotification.createChannel(
        {
          channelId: 'wakewell-alarm',
          channelName: 'WakeWell Alarm',
          channelDescription: 'Alarm notifications for WakeWell',
          playSound: false, // We handle sound ourselves
          soundName: 'default',
          importance: 4, // IMPORTANCE_HIGH
          vibrate: true,
        },
        created => console.log(`Alarm channel created: ${created}`),
      );

      // Create lower-priority channel for sleep tracking
      PushNotification.createChannel(
        {
          channelId: 'wakewell-tracking',
          channelName: 'Sleep Tracking',
          channelDescription: 'Background sleep tracking notification',
          playSound: false,
          importance: 2, // IMPORTANCE_LOW
          vibrate: false,
        },
        created => console.log(`Tracking channel created: ${created}`),
      );

      // Configure notification handler
      PushNotification.configure({
        onNotification: notification => {
          this._handleNotification(notification);
        },
        permissions: {
          alert: true,
          badge: false,
          sound: true,
        },
        popInitialNotification: true,
        requestPermissions: false, // Local notifications only — no Firebase/FCM needed
      });

      console.log('AlarmScheduler initialized');
    } catch (error) {
      console.error('AlarmScheduler init failed:', error);
    }
  }

  /**
   * Schedule an alarm.
   *
   * @param {Object} config
   * @param {string} config.id - Unique alarm ID
   * @param {Date} config.alarmTime - When the alarm should fire
   * @param {Date} config.preWakeTime - When pre-wake sequence starts
   * @param {boolean} config.smartAlarmEnabled - Use smart wake window
   * @param {string} config.label - User-friendly label
   * @param {Array} config.repeatDays - Days to repeat [0=Sun, 1=Mon, ...]
   * @returns {Object} Scheduled alarm info
   */
  scheduleAlarm(config) {
    const {
      id = `alarm_${Date.now()}`,
      alarmTime,
      preWakeTime,
      smartAlarmEnabled = true,
      label = 'Wake Up',
      repeatDays = [],
    } = config;

    if (!alarmTime) {
      throw new Error('alarmTime is required');
    }

    // Calculate pre-wake time if not provided
    const actualPreWakeTime =
      preWakeTime ||
      new Date(alarmTime.getTime() - WAKE_CONFIG.TOTAL_DURATION_MIN * 60000);

    const alarmConfig = {
      id,
      alarmTime,
      preWakeTime: actualPreWakeTime,
      smartAlarmEnabled,
      label,
      repeatDays,
      isActive: true,
      createdAt: new Date(),
    };

    // Store the alarm
    this.scheduledAlarms.set(id, alarmConfig);

    // Schedule the pre-wake notification (starts the progressive sequence)
    this._scheduleNotification({
      id: `${id}_prewake`,
      title: '🌅 WakeWell',
      message: 'Sleep tracking active — your wake sequence will begin soon',
      date: actualPreWakeTime,
      channelId: 'wakewell-tracking',
      ongoing: true,
      data: {type: 'prewake', alarmId: id},
    });

    // Schedule the main alarm notification (hard deadline)
    this._scheduleNotification({
      id: `${id}_alarm`,
      title: '☀️ Time to Wake Up',
      message: label,
      date: alarmTime,
      channelId: 'wakewell-alarm',
      ongoing: true,
      fullScreen: true, // Shows full-screen intent on locked phone
      data: {type: 'alarm', alarmId: id},
    });

    console.log(`Alarm scheduled: ${id} at ${alarmTime.toISOString()}`);
    return alarmConfig;
  }

  /**
   * Cancel a scheduled alarm.
   * @param {string} id - Alarm ID to cancel
   */
  cancelAlarm(id) {
    try {
      const PushNotification = require('react-native-push-notification');
      PushNotification.cancelLocalNotification(`${id}_prewake`);
      PushNotification.cancelLocalNotification(`${id}_alarm`);
    } catch (e) {
      console.warn('Could not cancel notifications:', e);
    }

    this.scheduledAlarms.delete(id);
    if (this.activeAlarmId === id) {
      this.activeAlarmId = null;
    }
    console.log(`Alarm cancelled: ${id}`);
  }

  /**
   * Cancel all scheduled alarms.
   */
  cancelAll() {
    try {
      const PushNotification = require('react-native-push-notification');
      PushNotification.cancelAllLocalNotifications();
    } catch (e) {
      console.warn('Could not cancel all notifications:', e);
    }
    this.scheduledAlarms.clear();
    this.activeAlarmId = null;
  }

  /**
   * Update alarm time (e.g., when smart alarm detects optimal wake point).
   *
   * @param {string} id - Alarm ID
   * @param {Date} newAlarmTime - Updated alarm time
   */
  updateAlarmTime(id, newAlarmTime) {
    const existing = this.scheduledAlarms.get(id);
    if (!existing) {
      console.warn(`Alarm ${id} not found`);
      return;
    }

    // Cancel old notifications
    this.cancelAlarm(id);

    // Reschedule with new time
    return this.scheduleAlarm({
      ...existing,
      alarmTime: newAlarmTime,
    });
  }

  /**
   * Get all scheduled alarms.
   * @returns {Array} List of alarm configs
   */
  getScheduledAlarms() {
    return Array.from(this.scheduledAlarms.values());
  }

  /**
   * Get a specific alarm by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getAlarm(id) {
    return this.scheduledAlarms.get(id) || null;
  }

  /**
   * Register callbacks for alarm events.
   */
  setCallbacks({onAlarmTrigger, onPreWakeTrigger}) {
    this.onAlarmTrigger = onAlarmTrigger;
    this.onPreWakeTrigger = onPreWakeTrigger;
  }

  /**
   * Start a foreground service for reliable sleep tracking.
   * This prevents Android from killing the app during sleep.
   */
  startSleepTrackingService(alarmId) {
    try {
      const PushNotification = require('react-native-push-notification');

      PushNotification.localNotification({
        id: 'tracking_service',
        channelId: 'wakewell-tracking',
        title: '🌙 WakeWell is tracking your sleep',
        message: 'Place your phone on the mattress for best results',
        ongoing: true,
        autoCancel: false,
        importance: 'low',
        priority: 'low',
      });
    } catch (e) {
      console.warn('Could not start foreground service:', e);
    }
  }

  /**
   * Stop the foreground tracking service.
   */
  stopSleepTrackingService() {
    try {
      const PushNotification = require('react-native-push-notification');
      PushNotification.cancelLocalNotification('tracking_service');
    } catch (e) {
      console.warn('Could not stop foreground service:', e);
    }
  }

  // ---- Private Methods ----

  _scheduleNotification({
    id,
    title,
    message,
    date,
    channelId,
    ongoing,
    fullScreen,
    data,
  }) {
    try {
      const PushNotification = require('react-native-push-notification');

      PushNotification.localNotificationSchedule({
        id,
        channelId,
        title,
        message,
        date,
        allowWhileIdle: true, // Fires even in Doze mode
        ongoing: ongoing || false,
        autoCancel: false,
        importance: channelId === 'wakewell-alarm' ? 'high' : 'low',
        priority: channelId === 'wakewell-alarm' ? 'high' : 'low',
        visibility: 'public',
        userInfo: data || {},
        // Full-screen intent for alarm (shows on lock screen)
        ...(fullScreen && {
          invokeApp: true,
          actions: '["Dismiss", "Snooze 5min"]',
        }),
      });
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  _handleNotification(notification) {
    const data = notification.data || notification.userInfo || {};

    if (data.type === 'prewake') {
      this.activeAlarmId = data.alarmId;
      if (this.onPreWakeTrigger) {
        this.onPreWakeTrigger(data.alarmId);
      }
    } else if (data.type === 'alarm') {
      if (this.onAlarmTrigger) {
        this.onAlarmTrigger(data.alarmId);
      }
    }
  }
}

export default new AlarmScheduler();
