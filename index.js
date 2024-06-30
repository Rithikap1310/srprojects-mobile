/**
 * @format
 */

import {AppRegistry} from 'react-native';

import {name as appName} from './app.json';
import Provider from './app/Provider';

AppRegistry.registerComponent(appName, () => Provider);
