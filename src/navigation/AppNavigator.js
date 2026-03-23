// ============================================================
// WakeWell — Navigation Setup
// ============================================================

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';

import HomeScreen from '../screens/HomeScreen';
import AlarmSetupScreen from '../screens/AlarmSetupScreen';
import SleepTrackingScreen from '../screens/SleepTrackingScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import WakeScreen from '../screens/WakeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import {COLORS} from '../constants';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Bottom tab navigator — main app navigation.
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.nightDeep,
          borderTopColor: COLORS.cardBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({color, size}) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = 'moon';
              break;
            case 'Analytics':
              iconName = 'bar-chart-2';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'circle';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/**
 * Root stack navigator — includes modals and full-screen views.
 */
export default function AppNavigator() {
  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: COLORS.primary,
          background: COLORS.nightDeep,
          card: COLORS.nightMid,
          text: COLORS.textPrimary,
          border: COLORS.cardBorder,
          notification: COLORS.accent,
        },
      }}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="AlarmSetup"
          component={AlarmSetupScreen}
          options={{presentation: 'modal'}}
        />
        <Stack.Screen
          name="SleepTracking"
          component={SleepTrackingScreen}
          options={{presentation: 'fullScreenModal', gestureEnabled: false}}
        />
        <Stack.Screen
          name="Wake"
          component={WakeScreen}
          options={{presentation: 'fullScreenModal', gestureEnabled: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
