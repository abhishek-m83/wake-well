// ============================================================
// WakeWell — App Entry Point
// ============================================================

import React, {useEffect, Component} from 'react';
import {StatusBar, LogBox, View, Text} from 'react-native';
import AppNavigator, {navigationRef} from './src/navigation/AppNavigator';
import AlarmScheduler from './src/services/AlarmScheduler';
import {hydrateStore, enablePersistence, useAppStore} from './src/store';
import {timeToNextDate} from './src/utils';

class ErrorBoundary extends Component {
  state = {error: null};
  static getDerivedStateFromError(error) {
    return {error};
  }
  componentDidCatch(error, info) {
    console.error('RENDER ERROR:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#0B0E1A',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <Text
            style={{
              color: '#E85D75',
              fontSize: 16,
              fontWeight: 'bold',
              marginBottom: 12,
            }}>
            Render Error
          </Text>
          <Text style={{color: '#EEEDF5', fontSize: 12}}>
            {String(this.state.error)}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Suppress non-critical warnings in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

export default function App() {
  useEffect(() => {
    // Initialize app on mount
    async function init() {
      // 1. Hydrate saved state from AsyncStorage
      await hydrateStore();

      // 2. Enable auto-persistence
      enablePersistence();

      // 3. Initialize alarm scheduler (notification channels, etc.)
      await AlarmScheduler.initialize();

      // 4. Set alarm callbacks
      AlarmScheduler.setCallbacks({
        onPreWakeTrigger: alarmId => {
          console.log('Pre-wake triggered for alarm:', alarmId);
          // The SleepTrackingScreen handles the progressive wake start
        },
        onAlarmTrigger: alarmId => {
          if (!navigationRef.isReady()) return;
          // Look up alarm time from store so WakeScreen stages are correct
          const alarm = useAppStore
            .getState()
            .alarms.find(a => a.id === alarmId);
          const alarmTime = alarm
            ? timeToNextDate(alarm.time.hour, alarm.time.minute).toISOString()
            : new Date().toISOString();
          navigationRef.navigate('Wake', {alarmTime});
        },
      });
    }

    init();
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <AppNavigator />
    </ErrorBoundary>
  );
}
