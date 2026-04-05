// ============================================================
// WakeWell — Alarm Setup Screen
// ============================================================
// Create or edit an alarm with time picker, repeat days,
// sound preferences, and smart alarm settings.
// ============================================================

import React, {useState, useRef, useEffect, useCallback} from 'react';
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
import AlarmScheduler from '../services/AlarmScheduler';
import {timeToNextDate} from '../utils';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SOUND_LIBRARY,
  WAKE_CONFIG,
} from '../constants';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const HOURS = Array.from({length: 12}, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({length: 60}, (_, i) => i); // 0–59

const DRUM_ITEM_HEIGHT = 64;
const DRUM_VISIBLE = 3; // items visible; middle = selected
const DRUM_HEIGHT = DRUM_ITEM_HEIGHT * DRUM_VISIBLE;

function DrumPicker({values, selectedValue, onValueChange, format}) {
  const scrollRef = useRef(null);
  const selectedIndex = values.indexOf(selectedValue);
  const isScrolling = useRef(false);

  // Scroll to the selected item on mount / external value change
  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0 && !isScrolling.current) {
      scrollRef.current.scrollTo({
        y: selectedIndex * DRUM_ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const commit = useCallback(
    offsetY => {
      const index = Math.round(offsetY / DRUM_ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, values.length - 1));
      onValueChange(values[clamped]);
    },
    [values, onValueChange],
  );

  return (
    <View style={drumStyles.wrapper}>
      {/* Top fade */}
      <View style={drumStyles.fadeTop} pointerEvents="none" />
      {/* Selection highlight */}
      <View style={drumStyles.selectionBar} pointerEvents="none" />
      {/* Bottom fade */}
      <View style={drumStyles.fadeBottom} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        style={drumStyles.scroll}
        contentContainerStyle={{paddingVertical: DRUM_ITEM_HEIGHT}}
        showsVerticalScrollIndicator={false}
        snapToInterval={DRUM_ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={() => {
          isScrolling.current = true;
        }}
        onMomentumScrollEnd={e => {
          isScrolling.current = false;
          commit(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={e => {
          isScrolling.current = false;
          commit(e.nativeEvent.contentOffset.y);
        }}>
        {values.map((val, i) => {
          const isSelected = val === selectedValue;
          return (
            <View key={i} style={drumStyles.item}>
              <Text
                style={[
                  drumStyles.itemText,
                  isSelected && drumStyles.itemTextSelected,
                ]}>
                {format ? format(val) : val}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const drumStyles = StyleSheet.create({
  wrapper: {
    height: DRUM_HEIGHT,
    width: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  item: {
    height: DRUM_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 32,
    color: COLORS.textMuted,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  itemTextSelected: {
    fontSize: 48,
    color: COLORS.textPrimary,
    fontWeight: '300',
  },
  selectionBar: {
    position: 'absolute',
    top: DRUM_ITEM_HEIGHT,
    left: 4,
    right: 4,
    height: DRUM_ITEM_HEIGHT,
    backgroundColor: 'rgba(123, 111, 191, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(123, 111, 191, 0.3)',
    zIndex: 1,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: DRUM_ITEM_HEIGHT,
    backgroundColor: 'rgba(11, 14, 26, 0.7)',
    zIndex: 2,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRUM_ITEM_HEIGHT,
    backgroundColor: 'rgba(11, 14, 26, 0.7)',
    zIndex: 2,
  },
});

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
      // Cancel old OS notification and reschedule with updated time
      AlarmScheduler.cancelAlarm(alarmId);
      AlarmScheduler.scheduleAlarm({
        id: alarmId,
        alarmTime: timeToNextDate(hour, minute),
        smartAlarmEnabled: smartEnabled,
        label,
        repeatDays,
      });
    } else {
      const newId = `alarm_${Date.now()}`;
      addAlarm({...alarmData, id: newId});
      AlarmScheduler.scheduleAlarm({
        id: newId,
        alarmTime: timeToNextDate(hour, minute),
        smartAlarmEnabled: smartEnabled,
        label,
        repeatDays,
      });
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    if (existingAlarm) {
      AlarmScheduler.cancelAlarm(alarmId);
      removeAlarm(alarmId);
    }
    navigation.goBack();
  };

  const displayHour = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';

  const handleHourChange = useCallback(
    h => setHour(hour >= 12 ? (h % 12) + 12 : h % 12),
    [hour],
  );
  const handleAmPmToggle = () => setHour(h => (h + 12) % 24);

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
          <DrumPicker
            values={HOURS}
            selectedValue={displayHour}
            onValueChange={handleHourChange}
            format={v => v.toString().padStart(2, '0')}
          />
          <Text style={styles.timeColon}>:</Text>
          <DrumPicker
            values={MINUTES}
            selectedValue={minute}
            onValueChange={setMinute}
            format={v => v.toString().padStart(2, '0')}
          />
          <TouchableOpacity
            style={styles.ampmToggle}
            onPress={handleAmPmToggle}>
            <Text
              style={[
                styles.ampmText,
                {color: ampm === 'AM' ? COLORS.primaryLight : COLORS.accent},
              ]}>
              {ampm}
            </Text>
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
            maxLength={40}
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
    gap: SPACING.xs,
  },
  timeColon: {
    fontSize: 48,
    color: COLORS.textMuted,
    fontWeight: '200',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  ampmToggle: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginLeft: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minWidth: 56,
    alignItems: 'center',
  },
  ampmText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
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
