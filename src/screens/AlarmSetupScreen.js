// ============================================================
// WakeWell — Alarm Setup Screen
// ============================================================
// Create or edit an alarm with time picker, repeat days,
// sound preferences, and smart alarm settings.
// ============================================================

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import useAppStore from '../store';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SOUND_LIBRARY,
  WAKE_CONFIG,
} from '../constants';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AlarmSetupScreen({navigation, route}) {
  const {alarmId} = route.params || {};
  const existingAlarm = useAppStore(s => s.alarms.find(a => a.id === alarmId));
  const addAlarm = useAppStore(s => s.addAlarm);
  const updateAlarm = useAppStore(s => s.updateAlarm);
  const removeAlarm = useAppStore(s => s.removeAlarm);

  const [hour, setHour] = useState(existingAlarm?.time?.hour ?? 7);
  const [minute, setMinute] = useState(existingAlarm?.time?.minute ?? 0);
  const [label, setLabel] = useState(existingAlarm?.label || 'Wake Up');
  const [repeatDays, setRepeatDays] = useState(existingAlarm?.repeatDays || []);
  const [smartEnabled, setSmartEnabled] = useState(
    existingAlarm?.smartAlarmEnabled ?? true,
  );
  const [dismissType, setDismissType] = useState(
    existingAlarm?.dismissChallenge || 'math',
  );
  const [selectedNature, setSelectedNature] = useState(
    existingAlarm?.soundPreferences?.nature || 'birds_morning',
  );
  const [selectedAmbient, setSelectedAmbient] = useState(
    existingAlarm?.soundPreferences?.ambient || 'piano_soft',
  );

  const toggleDay = dayIndex => {
    setRepeatDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort(),
    );
  };

  const handleSave = () => {
    const alarmData = {
      time: {hour, minute},
      label,
      repeatDays,
      smartAlarmEnabled: smartEnabled,
      dismissChallenge: dismissType,
      soundPreferences: {
        nature: selectedNature,
        ambient: selectedAmbient,
        familiar: 'melodic_rise',
        alert: 'chime_bright',
      },
    };

    if (existingAlarm) {
      updateAlarm(alarmId, alarmData);
    } else {
      addAlarm(alarmData);
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    if (existingAlarm) {
      removeAlarm(alarmId);
    }
    navigation.goBack();
  };

  // Simple scroll-based time picker
  const adjustHour = delta => setHour(h => (h + delta + 24) % 24);
  const adjustMinute = delta => setMinute(m => (m + delta + 60) % 60);

  const displayHour = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="x" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existingAlarm ? 'Edit Alarm' : 'New Alarm'}
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Time Picker */}
        <View style={styles.timePicker}>
          <View style={styles.timeColumn}>
            <TouchableOpacity
              onPress={() => adjustHour(1)}
              style={styles.timeArrow}>
              <Icon name="chevron-up" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
            <Text style={styles.timeDigit}>
              {displayHour.toString().padStart(2, '0')}
            </Text>
            <TouchableOpacity
              onPress={() => adjustHour(-1)}
              style={styles.timeArrow}>
              <Icon name="chevron-down" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.timeColon}>:</Text>

          <View style={styles.timeColumn}>
            <TouchableOpacity
              onPress={() => adjustMinute(5)}
              style={styles.timeArrow}>
              <Icon name="chevron-up" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
            <Text style={styles.timeDigit}>
              {minute.toString().padStart(2, '0')}
            </Text>
            <TouchableOpacity
              onPress={() => adjustMinute(-5)}
              style={styles.timeArrow}>
              <Icon name="chevron-down" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.ampmToggle}
            onPress={() => setHour(h => (h + 12) % 24)}>
            <Text style={styles.ampmText}>{ampm}</Text>
          </TouchableOpacity>
        </View>

        {/* Label */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Label</Text>
          <TextInput
            style={styles.textInput}
            value={label}
            onChangeText={setLabel}
            placeholder="Alarm name"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Repeat Days */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Repeat</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((dayLabel, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dayButton,
                  repeatDays.includes(idx) && styles.dayButtonActive,
                ]}
                onPress={() => toggleDay(idx)}>
                <Text
                  style={[
                    styles.dayButtonText,
                    repeatDays.includes(idx) && styles.dayButtonTextActive,
                  ]}>
                  {dayLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Quick presets */}
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => setRepeatDays([1, 2, 3, 4, 5])}>
              <Text style={styles.presetText}>Weekdays</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => setRepeatDays([0, 6])}>
              <Text style={styles.presetText}>Weekends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => setRepeatDays([0, 1, 2, 3, 4, 5, 6])}>
              <Text style={styles.presetText}>Every day</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Smart Alarm Toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.fieldLabel}>Smart Alarm</Text>
            <Text style={styles.fieldHint}>
              Wakes you during light sleep within a 30-min window
            </Text>
          </View>
          <Switch
            value={smartEnabled}
            onValueChange={setSmartEnabled}
            trackColor={{false: COLORS.nightLight, true: COLORS.primaryDark}}
            thumbColor={smartEnabled ? COLORS.primary : COLORS.textMuted}
          />
        </View>

        {/* Nature Sound Selection */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Wake-up Sounds</Text>
          <Text style={styles.fieldHint}>Nature (starts first, softest)</Text>
          <View style={styles.soundGrid}>
            {SOUND_LIBRARY.nature.map(sound => (
              <TouchableOpacity
                key={sound.id}
                style={[
                  styles.soundChip,
                  selectedNature === sound.id && styles.soundChipActive,
                ]}
                onPress={() => setSelectedNature(sound.id)}>
                <Text
                  style={[
                    styles.soundChipText,
                    selectedNature === sound.id && styles.soundChipTextActive,
                  ]}>
                  {sound.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldHint, {marginTop: SPACING.md}]}>
            Ambient Music (joins next)
          </Text>
          <View style={styles.soundGrid}>
            {SOUND_LIBRARY.ambient.map(sound => (
              <TouchableOpacity
                key={sound.id}
                style={[
                  styles.soundChip,
                  selectedAmbient === sound.id && styles.soundChipActive,
                ]}
                onPress={() => setSelectedAmbient(sound.id)}>
                <Text
                  style={[
                    styles.soundChipText,
                    selectedAmbient === sound.id && styles.soundChipTextActive,
                  ]}>
                  {sound.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dismiss Challenge */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Wake Confirmation</Text>
          <Text style={styles.fieldHint}>
            How do you prove you&apos;re awake?
          </Text>
          <View style={styles.soundGrid}>
            {WAKE_CONFIG.DISMISS_CHALLENGES.map(challenge => (
              <TouchableOpacity
                key={challenge.id}
                style={[
                  styles.soundChip,
                  dismissType === challenge.id && styles.soundChipActive,
                ]}
                onPress={() => setDismissType(challenge.id)}>
                <Text
                  style={[
                    styles.soundChipText,
                    dismissType === challenge.id && styles.soundChipTextActive,
                  ]}>
                  {challenge.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Delete button (edit mode only) */}
        {existingAlarm && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Icon name="trash-2" size={18} color={COLORS.danger} />
            <Text style={styles.deleteText}>Delete Alarm</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.nightDeep,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingTop: SPACING.xxl,
  },
  headerTitle: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  saveText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 60,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeArrow: {
    padding: SPACING.sm,
  },
  timeDigit: {
    fontSize: 64,
    color: COLORS.textPrimary,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    width: 90,
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 56,
    color: COLORS.textMuted,
    fontWeight: '200',
    marginBottom: 4,
  },
  ampmToggle: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginLeft: SPACING.sm,
  },
  ampmText: {
    fontSize: 18,
    color: COLORS.primaryLight,
    fontWeight: '600',
  },
  field: {
    marginBottom: SPACING.xl,
  },
  fieldLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  fieldHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  textInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  daysRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  dayButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayButtonText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  dayButtonTextActive: {
    color: COLORS.white,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  presetChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.nightLight,
    borderRadius: BORDER_RADIUS.pill,
  },
  presetText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  soundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  soundChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  soundChipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  soundChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  soundChipTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  deleteText: {
    fontSize: 16,
    color: COLORS.danger,
    fontWeight: '600',
  },
});
