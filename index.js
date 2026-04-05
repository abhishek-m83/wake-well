/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {enableScreens} from 'react-native-screens';
import crashlytics from '@react-native-firebase/crashlytics';

enableScreens(false);
crashlytics().setCrashlyticsCollectionEnabled(true);

AppRegistry.registerComponent(appName, () => App);
