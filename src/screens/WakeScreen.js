// ============================================================
// WakeWell — Wake Screen
// ============================================================
// Full-screen wake-up experience with progressive stages,
// brightness control, and dismiss challenges.
// ============================================================

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import Sound from 'react-native-sound';
import KeepAwake from 'react-native-keep-awake';
import Icon from 'react-native-vector-icons/Feather';
import useAppStore from '../store';
import {useClock, useProgressiveWake} from '../hooks';

import {
  generateDismissChallenge,
  computeScreenBrightness,
} from '../services/ProgressiveWakeManager';
import {COLORS, SPACING, BORDER_RADIUS, ANALYTICS_CONFIG} from '../constants';
import {formatTime} from '../utils';

// Enable playback in silence mode (iOS)
Sound.setCategory('Playback');

const {width} = Dimensions.get('window');

export default function WakeScreen({navigation, route}) {
  const {alarmTime: alarmTimeStr} = route.params || {};
  const alarmTime = alarmTimeStr ? new Date(alarmTimeStr) : new Date();
  const endSleepSession = useAppStore(s => s.endSleepSession);
  const settings = useAppStore(s => s.settings);

  const now = useClock();
  const wakeInfo = useProgressiveWake(alarmTime, {
    nature: 'birds_morning',
    ambient: 'piano_soft',
    familiar: 'melodic_rise',
  });

  const [challenge, setChallenge] = useState(null);
  const [challengeInput, setChallengeInput] = useState('');
  const [challengeError, setChallengeError] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showFreshnessRating, setShowFreshnessRating] = useState(false);
  const [breathingStep, setBreathingStep] = useState(0);
  const [breathingTimer, setBreathingTimer] = useState(0);

  // Shake challenge state
  const [shakeCount, setShakeCount] = useState(0);
  const shakeLastAt = useRef(0);

  // Pattern challenge state: 'showing' | 'input'
  const [patternPhase, setPatternPhase] = useState('showing');
  const [patternShowIdx, setPatternShowIdx] = useState(0);
  const [patternUserInput, setPatternUserInput] = useState([]);
  const [patternError, setPatternError] = useState(false);

  // Keep screen awake for the entire wake sequence
  useEffect(() => {
    KeepAwake.activate();
    return () => KeepAwake.deactivate();
  }, []);

  // Active Sound instances keyed by sound file name
  const soundsRef = useRef({});
  const patternErrorTimerRef = useRef(null);

  const stopAllSounds = useCallback(() => {
    Object.values(soundsRef.current).forEach(s => {
      s.stop(() => s.release());
    });
    soundsRef.current = {};
  }, []);

  const handleDismiss = useCallback(() => {
    stopAllSounds();
    setDismissed(true);
    setShowFreshnessRating(true);
  }, [stopAllSounds]);

  // Sync playing sounds with wakeInfo.activeSounds
  useEffect(() => {
    if (dismissed) return;

    const desired = wakeInfo.activeSounds; // [{file, targetVolume, ...}]
    const current = soundsRef.current;
    const desiredFiles = new Set(desired.map(s => s.file));

    // Stop sounds no longer needed
    Object.keys(current).forEach(file => {
      if (!desiredFiles.has(file)) {
        current[file].stop(() => current[file].release());
        delete current[file];
      }
    });

    // Start or update each desired sound
    desired.forEach(({file, targetVolume}) => {
      if (current[file]) {
        // Already playing — just update volume
        current[file].setVolume(targetVolume);
      } else {
        // Load and play new sound
        const s = new Sound(file, Sound.MAIN_BUNDLE, err => {
          if (err) {
            s.release(); // prevent memory leak on failed load
            return;
          }
          s.setVolume(targetVolume);
          s.setNumberOfLoops(-1); // loop indefinitely
          s.play();
          soundsRef.current[file] = s;
        });
      }
    });
  }, [wakeInfo.activeSounds, dismissed]);

  // Clean up all sounds and pending timers on unmount
  useEffect(() => {
    return () => {
      stopAllSounds();
      if (patternErrorTimerRef.current) {
        clearTimeout(patternErrorTimerRef.current);
      }
    };
  }, [stopAllSounds]);

  // Background opacity based on wake brightness
  const bgOpacity = computeScreenBrightness(
    wakeInfo.brightness,
    settings.maxBrightness,
  );

  // Generate challenge when alert stage hits
  useEffect(() => {
    if (wakeInfo.stage?.id === 'alert' && !challenge && !dismissed) {
      const dismissType = settings.dismissChallengeType || 'math';
      setChallenge(generateDismissChallenge(dismissType));
    }
  }, [wakeInfo.stage, challenge, dismissed, settings.dismissChallengeType]);

  // Handle breathing challenge timer
  useEffect(() => {
    if (challenge?.type === 'breathing' && breathingTimer > 0) {
      const timer = setTimeout(() => setBreathingTimer(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (
      challenge?.type === 'breathing' &&
      breathingTimer === 0 &&
      breathingStep > 0
    ) {
      if (breathingStep < challenge.steps.length) {
        setBreathingTimer(challenge.steps[breathingStep].duration);
        setBreathingStep(s => s + 1);
      } else {
        handleDismiss();
      }
    }
  }, [breathingTimer, breathingStep, challenge, handleDismiss]);

  // Shake detection via accelerometer
  useEffect(() => {
    if (challenge?.type !== 'shake' || dismissed) return;

    let subscription;
    try {
      const {
        accelerometer,
        setUpdateIntervalForType,
        SensorTypes,
      } = require('react-native-sensors');
      setUpdateIntervalForType(SensorTypes.accelerometer, 100);
      subscription = accelerometer.subscribe(({x, y, z}) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const ts = Date.now();
        // Threshold 18 m/s² (well above gravity ~9.8); debounce 350ms
        if (magnitude > 18 && ts - shakeLastAt.current > 350) {
          shakeLastAt.current = ts;
          setShakeCount(c => {
            const next = c + 1;
            if (next >= challenge.targetCount) {
              handleDismiss();
            }
            return next;
          });
        }
      });
    } catch (_) {}

    return () => subscription?.unsubscribe();
  }, [challenge, dismissed, handleDismiss]);

  // Pattern: animate showing the pattern cells one by one
  useEffect(() => {
    if (challenge?.type !== 'pattern' || patternPhase !== 'showing') return;

    if (patternShowIdx < challenge.pattern.length) {
      const t = setTimeout(() => setPatternShowIdx(i => i + 1), 700);
      return () => clearTimeout(t);
    } else {
      // Finished showing — give user a moment then switch to input
      const t = setTimeout(() => setPatternPhase('input'), 500);
      return () => clearTimeout(t);
    }
  }, [challenge, patternPhase, patternShowIdx]);

  // Pattern: reset show sequence when a new challenge is generated
  useEffect(() => {
    if (challenge?.type === 'pattern') {
      setPatternPhase('showing');
      setPatternShowIdx(0);
      setPatternUserInput([]);
      setPatternError(false);
    }
  }, [challenge]);

  const handlePatternTap = cellIndex => {
    if (patternPhase !== 'input' || dismissed) return;
    const next = [...patternUserInput, cellIndex];
    const expectedSoFar = challenge.pattern.slice(0, next.length);

    if (next[next.length - 1] !== expectedSoFar[next.length - 1]) {
      // Wrong cell — flash error and restart
      setPatternError(true);
      patternErrorTimerRef.current = setTimeout(() => {
        setPatternError(false);
        setPatternPhase('showing');
        setPatternShowIdx(0);
        setPatternUserInput([]);
      }, 800);
      return;
    }

    setPatternUserInput(next);
    if (next.length === challenge.pattern.length) {
      handleDismiss();
    }
  };

  const startBreathing = () => {
    setBreathingStep(1);
    setBreathingTimer(challenge.steps[0].duration);
  };

  const handleChallengeSubmit = () => {
    if (!challenge) return;
    if (challenge.validate(challengeInput)) {
      handleDismiss();
    } else {
      setChallengeError(true);
      setChallengeInput('');
      // Generate a new challenge
      setChallenge(generateDismissChallenge(challenge.type));
      setTimeout(() => setChallengeError(false), 1500);
    }
  };

  const handleFreshnessRating = rating => {
    endSleepSession(rating);
    navigation.navigate('Main');
  };

  // Freshness rating screen
  if (showFreshnessRating) {
    return (
      <View style={[styles.container, {backgroundColor: COLORS.nightMid}]}>
        <View style={styles.freshnessContent}>
          <Icon name="sun" size={48} color={COLORS.accent} />
          <Text style={styles.freshnessTitle}>Good morning!</Text>
          <Text style={styles.freshnessSubtitle}>How do you feel?</Text>

          <View style={styles.freshnessGrid}>
            {Object.entries(ANALYTICS_CONFIG.FRESHNESS_SCALE).map(
              ([score, config]) => (
                <TouchableOpacity
                  key={score}
                  style={[styles.freshnessOption, {borderColor: config.color}]}
                  onPress={() => handleFreshnessRating(parseInt(score, 10))}>
                  <Text style={styles.freshnessEmoji}>{config.emoji}</Text>
                  <Text style={[styles.freshnessLabel, {color: config.color}]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Dynamic background — transitions from dark to warm */}
      <View
        style={[
          styles.bgOverlay,
          {
            backgroundColor: `rgba(249, 231, 132, ${bgOpacity * 0.15})`,
          },
        ]}
      />

      <View style={styles.content}>
        {/* Current time */}
        <Text style={styles.currentTime}>{formatTime(now)}</Text>

        {/* Stage indicator */}
        <View style={styles.stageContainer}>
          <Text style={styles.stageName}>
            {wakeInfo.stage?.name || 'Preparing...'}
          </Text>
          <Text style={styles.stageDescription}>
            {wakeInfo.stage?.description || 'Your wake sequence is starting'}
          </Text>
        </View>

        {/* Progress visualization */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {width: `${Math.min(100, wakeInfo.brightness * 100)}%`},
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>🌙</Text>
            <Text style={styles.progressLabel}>🌤</Text>
            <Text style={styles.progressLabel}>☀️</Text>
          </View>
        </View>

        {/* Active sounds display */}
        {wakeInfo.activeSounds.length > 0 && (
          <View style={styles.soundsContainer}>
            <Icon name="music" size={14} color={COLORS.textMuted} />
            <Text style={styles.soundsText}>
              {wakeInfo.activeSounds.map(s => s.name).join(' + ')}
            </Text>
          </View>
        )}

        {/* Volume indicator */}
        <View style={styles.volumeRow}>
          <Icon
            name={wakeInfo.volume > 0 ? 'volume-2' : 'volume-x'}
            size={16}
            color={COLORS.textMuted}
          />
          <View style={styles.volumeTrack}>
            <View
              style={[styles.volumeFill, {width: `${wakeInfo.volume * 100}%`}]}
            />
          </View>
          <Text style={styles.volumeText}>
            {Math.round(wakeInfo.volume * 100)}%
          </Text>
        </View>

        {/* Dismiss Challenge */}
        {challenge && !dismissed && (
          <View style={styles.challengeCard}>
            <Text style={styles.challengeTitle}>Prove you&apos;re awake</Text>

            {challenge.type === 'math' && (
              <>
                <Text style={styles.challengePrompt}>{challenge.prompt}</Text>
                <View style={styles.challengeInputRow}>
                  <TextInput
                    style={[
                      styles.challengeInput,
                      challengeError && styles.challengeInputError,
                    ]}
                    value={challengeInput}
                    onChangeText={setChallengeInput}
                    keyboardType="number-pad"
                    placeholder="?"
                    placeholderTextColor={COLORS.textMuted}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.challengeSubmit}
                    onPress={handleChallengeSubmit}>
                    <Icon name="check" size={24} color={COLORS.nightDeep} />
                  </TouchableOpacity>
                </View>
                {challengeError && (
                  <Text style={styles.challengeErrorText}>
                    Wrong! Try again.
                  </Text>
                )}
              </>
            )}

            {challenge.type === 'breathing' && (
              <>
                {breathingStep === 0 ? (
                  <TouchableOpacity
                    style={styles.breathingStart}
                    onPress={startBreathing}>
                    <Text style={styles.breathingStartText}>
                      Start Breathing Exercise
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.breathingActive}>
                    <Text style={styles.breathingInstruction}>
                      {
                        challenge.steps[
                          Math.min(
                            breathingStep - 1,
                            challenge.steps.length - 1,
                          )
                        ]?.instruction
                      }
                    </Text>
                    <Text style={styles.breathingCount}>{breathingTimer}</Text>
                  </View>
                )}
              </>
            )}

            {challenge.type === 'shake' && (
              <View style={styles.shakeContainer}>
                <Icon name="smartphone" size={48} color={COLORS.accent} />
                <Text style={styles.shakeCount}>
                  {shakeCount} / {challenge.targetCount}
                </Text>
                <Text style={styles.shakePrompt}>Shake your phone!</Text>
                <View style={styles.shakeProgressTrack}>
                  <View
                    style={[
                      styles.shakeProgressFill,
                      {
                        width: `${Math.min(
                          100,
                          (shakeCount / challenge.targetCount) * 100,
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {challenge.type === 'pattern' && (
              <View style={styles.patternContainer}>
                <Text style={styles.patternLabel}>
                  {patternPhase === 'showing'
                    ? 'Watch the pattern…'
                    : patternError
                    ? 'Wrong! Watch again…'
                    : 'Repeat the pattern'}
                </Text>
                <View style={styles.patternGrid}>
                  {Array.from({
                    length: challenge.gridSize * challenge.gridSize,
                  }).map((_, i) => {
                    const isHighlighted =
                      patternPhase === 'showing' &&
                      challenge.pattern[patternShowIdx - 1] === i;
                    const isUserTapped =
                      patternPhase === 'input' && patternUserInput.includes(i);
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => handlePatternTap(i)}
                        activeOpacity={patternPhase === 'input' ? 0.6 : 1}
                        style={[
                          styles.patternCell,
                          isHighlighted && styles.patternCellHighlight,
                          isUserTapped && styles.patternCellTapped,
                          patternError && styles.patternCellError,
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.nightDeep,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  currentTime: {
    fontSize: 64,
    color: COLORS.textPrimary,
    fontWeight: '200',
    marginBottom: SPACING.lg,
  },
  stageContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  stageName: {
    fontSize: 22,
    color: COLORS.accent,
    fontWeight: '600',
  },
  stageDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.nightLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  progressLabel: {
    fontSize: 16,
  },
  soundsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  soundsText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '60%',
    marginBottom: SPACING.xl,
  },
  volumeTrack: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.nightLight,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: COLORS.primaryLight,
  },
  volumeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    width: 36,
    textAlign: 'right',
  },
  challengeCard: {
    backgroundColor: 'rgba(30, 36, 68, 0.8)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  challengeTitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  challengePrompt: {
    fontSize: 28,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  challengeInputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  challengeInput: {
    width: 120,
    height: 56,
    backgroundColor: COLORS.nightLight,
    borderRadius: BORDER_RADIUS.md,
    textAlign: 'center',
    fontSize: 28,
    color: COLORS.textPrimary,
    fontWeight: '600',
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  challengeInputError: {
    borderColor: COLORS.danger,
  },
  challengeSubmit: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeErrorText: {
    color: COLORS.danger,
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  breathingStart: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  breathingStartText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  breathingActive: {
    alignItems: 'center',
  },
  breathingInstruction: {
    fontSize: 22,
    color: COLORS.primaryLight,
    fontWeight: '500',
    textAlign: 'center',
  },
  breathingCount: {
    fontSize: 72,
    color: COLORS.accent,
    fontWeight: '200',
    marginTop: SPACING.md,
  },
  shakeContainer: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  shakeCount: {
    fontSize: 48,
    color: COLORS.accent,
    fontWeight: '200',
  },
  shakePrompt: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  shakeProgressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.nightLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  shakeProgressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  patternContainer: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  patternLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 180,
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  patternCell: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.nightLight,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  patternCellHighlight: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  patternCellTapped: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  patternCellError: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  freshnessContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  freshnessTitle: {
    fontSize: 32,
    color: COLORS.textPrimary,
    fontWeight: '300',
    marginTop: SPACING.lg,
  },
  freshnessSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  freshnessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  freshnessOption: {
    width: (width - SPACING.lg * 2 - SPACING.md * 2) / 3,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  freshnessEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  freshnessLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
