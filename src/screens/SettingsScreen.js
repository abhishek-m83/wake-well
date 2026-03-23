// ============================================================
// WakeWell — Settings Screen
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Slider from '@react-native-community/slider';
import useAppStore from '../store';
import { COLORS, SPACING, BORDER_RADIUS, SLEEP_CONFIG, WAKE_CONFIG } from '../constants';

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const renderToggle = (icon, label, description, key) => (
    <View style={styles.settingRow}>
      <Icon name={icon} size={20} color={COLORS.primaryLight} />
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      <Switch
        value={settings[key]}
        onValueChange={(val) => updateSettings({ [key]: val })}
        trackColor={{ false: COLORS.nightLight, true: COLORS.primaryDark }}
        thumbColor={settings[key] ? COLORS.primary : COLORS.textMuted}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

        {/* Sleep Tracking */}
        <Text style={styles.sectionTitle}>Sleep Tracking</Text>
        {renderToggle(
          'activity',
          'Use Motion Sensors',
          'Track movement via accelerometer for phase detection',
          'useSensors'
        )}
        {renderToggle(
          'zap',
          'Smart Alarm by Default',
          'New alarms use smart wake-window automatically',
          'smartAlarmDefault'
        )}

        {/* Fall Asleep Time */}
        <View style={styles.sliderRow}>
          <View style={styles.sliderHeader}>
            <Text style={styles.settingLabel}>Time to Fall Asleep</Text>
            <Text style={styles.sliderValue}>{settings.fallAsleepTimeMin} min</Text>
          </View>
          <Text style={styles.settingDesc}>
            How long it typically takes you to fall asleep
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={5}
            maximumValue={45}
            step={1}
            value={settings.fallAsleepTimeMin}
            onValueChange={(val) => updateSettings({ fallAsleepTimeMin: val })}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.nightLight}
            thumbTintColor={COLORS.primaryLight}
          />
        </View>

        {/* Smart Window */}
        <View style={styles.sliderRow}>
          <View style={styles.sliderHeader}>
            <Text style={styles.settingLabel}>Smart Alarm Window</Text>
            <Text style={styles.sliderValue}>{settings.defaultSmartWindow} min</Text>
          </View>
          <Text style={styles.settingDesc}>
            How early the alarm can ring to catch light sleep
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={45}
            step={5}
            value={settings.defaultSmartWindow}
            onValueChange={(val) => updateSettings({ defaultSmartWindow: val })}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.nightLight}
            thumbTintColor={COLORS.primaryLight}
          />
        </View>

        {/* Wake Experience */}
        <Text style={styles.sectionTitle}>Wake Experience</Text>

        {/* Max Brightness */}
        <View style={styles.sliderRow}>
          <View style={styles.sliderHeader}>
            <Text style={styles.settingLabel}>Max Wake Brightness</Text>
            <Text style={styles.sliderValue}>{Math.round(settings.maxBrightness * 100)}%</Text>
          </View>
          <Text style={styles.settingDesc}>
            How bright the screen gets during wake-up
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.2}
            maximumValue={1.0}
            step={0.05}
            value={settings.maxBrightness}
            onValueChange={(val) => updateSettings({ maxBrightness: val })}
            minimumTrackTintColor={COLORS.accent}
            maximumTrackTintColor={COLORS.nightLight}
            thumbTintColor={COLORS.accentSoft}
          />
        </View>

        {renderToggle(
          'smartphone',
          'Vibration',
          'Vibrate during alert stage',
          'vibrationEnabled'
        )}

        {/* Dismiss Challenge */}
        <View style={styles.challengeSection}>
          <Text style={styles.settingLabel}>Default Dismiss Challenge</Text>
          <Text style={styles.settingDesc}>
            What you need to do to turn off the alarm
          </Text>
          <View style={styles.challengeOptions}>
            {WAKE_CONFIG.DISMISS_CHALLENGES.map((ch) => (
              <TouchableOpacity
                key={ch.id}
                style={[
                  styles.challengeChip,
                  settings.dismissChallengeType === ch.id && styles.challengeChipActive,
                ]}
                onPress={() => updateSettings({ dismissChallengeType: ch.id })}
              >
                <Text
                  style={[
                    styles.challengeChipText,
                    settings.dismissChallengeType === ch.id && styles.challengeChipTextActive,
                  ]}
                >
                  {ch.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Display */}
        <Text style={styles.sectionTitle}>Display</Text>
        {renderToggle(
          'layers',
          'Show Sleep Phases',
          'Display phase breakdown during tracking',
          'showSleepPhases'
        )}

        {/* About */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>WakeWell v1.0.0</Text>
          <Text style={styles.aboutText}>
            Wake up feeling fresh. Built with sleep science.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.nightDeep },
  scrollContent: { padding: SPACING.lg, paddingTop: SPACING.xxl + 16, paddingBottom: 100 },
  title: { fontSize: 28, color: COLORS.textPrimary, fontWeight: '600', marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: 13, color: COLORS.primaryLight, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: SPACING.xl, marginBottom: SPACING.md,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, borderBottomWidth: 1,
    borderBottomColor: 'rgba(123,111,191,0.1)',
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  settingDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  sliderRow: { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(123,111,191,0.1)' },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderValue: { fontSize: 16, color: COLORS.primaryLight, fontWeight: '600' },
  slider: { marginTop: SPACING.sm, height: 40 },
  challengeSection: { paddingVertical: SPACING.md },
  challengeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  challengeChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardBg, borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  challengeChipActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primary },
  challengeChipText: { fontSize: 13, color: COLORS.textSecondary },
  challengeChipTextActive: { color: COLORS.white, fontWeight: '600' },
  aboutSection: { alignItems: 'center', paddingTop: SPACING.xxl, opacity: 0.5 },
  aboutTitle: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  aboutText: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
});
