/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-native/no-inline-styles */

import React, {useState, useEffect, useRef} from 'react';
import {
  AppState,
  Text,
  Alert,
  View,
  FlatList,
  Platform,
  StatusBar,
  SafeAreaView,
  NativeModules,
  useColorScheme,
  TouchableOpacity,
  NativeEventEmitter,
  PermissionsAndroid,
} from 'react-native';
import {styles} from './src/styles/styles';
import {DeviceList} from './src/DeviceList';
import BleManager from 'react-native-ble-manager';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import BackgroundTimer from 'react-native-background-timer';

const BleManagerModule = NativeModules.BleManager;
const BleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const peripherals = new Map();
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);

  const handleLocationPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission granted');
        } else {
          console.log('Location permission denied');
        }
      } catch (error) {
        console.log('Error requesting location permission:', error);
      }
    }
  };

  const handleBluetoothConnectPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Bluetooth connect permission granted');
        } else {
          console.log('Bluetooth connect permission denied');
        }
      } catch (error) {
        console.log('Error requesting bluetooth connect permission:', error);
      }
    }
  };

  const handleBluetoothScanPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Bluetooth scan permission granted');
        } else {
          console.log('Bluetooth scan permission denied');
        }
      } catch (error) {
        console.log('Error requesting bluetooth scan permission:', error);
      }
    }
  };

  const handleGetConnectedDevices = () => {
    BleManager.getConnectedPeripherals([]).then(results => {
      for (let i = 0; i < results.length; i++) {
        let peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        setConnectedDevices(Array.from(peripherals.values()));
      }
    });
    // BleManager.getBondedPeripherals([]).then(results => {
    //   for (let i = 0; i < results.length; i++) {
    //     let peripheral = results[i];
    //     peripheral.connected = true;
    //     peripherals.set(peripheral.id, peripheral);
    //     setConnectedDevices(Array.from(peripherals.values()));
    //   }
    // });
  };

  useEffect(() => {
    handleLocationPermission();
    handleBluetoothConnectPermission();
    handleBluetoothScanPermission();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
      console.log('AppState', appState.current);
      if(appState.current === 'background' || appState.current === 'inactive') {
        console.log("setting timeout for 10 seconds")
        BackgroundTimer.runBackgroundTimer(() => {
          disconnectDevices();
        }, 10000);
      } else {
        BackgroundTimer.stopBackgroundTimer();
      }
    });

    BleManager.enableBluetooth().then(() => {
      console.log('Bluetooth is turned on!');
    });

    BleManager.start({showAlert: false}).then(() => {
      console.log('BleManager initialized');
      handleGetConnectedDevices();
    });

    let stopDiscoverListener = BleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      peripheral => {
        // console.log('BleManagerDiscoverPeripheral:', peripheral);
        // console.log('peripheral id:', peripheral.id);
        console.log('peripheral name:', peripheral.name);
        if (String(peripheral.name).startsWith('ITC'))
        {
          peripherals.set(peripheral.id, peripheral);
          setDiscoveredDevices(Array.from(peripherals.values()));
        }
      },
    );

    let stopConnectListener = BleManagerEmitter.addListener(
      'BleManagerConnectPeripheral',
      peripheral => {
        console.log('BleManagerConnectPeripheral:', peripheral);
      },
    );

    let stopScanListener = BleManagerEmitter.addListener(
      'BleManagerStopScan',
      () => {
        setIsScanning(false);
        console.log('scan stopped');
      },
    );

    return () => {
      stopDiscoverListener.remove();
      stopConnectListener.remove();
      stopScanListener.remove();
      subscription.remove();
    };
  }, []);

  const scan = () => {
    if (!isScanning) {
      BleManager.scan([], 5, true)
        .then(() => {
          console.log('Scanning...');
          setIsScanning(true);
        })
        .catch(error => {
          console.error(error);
        });
    }
  };

  const disconnectDevices = () => {
    // console.log("Disconnecting Devices")
    BleManager.getConnectedPeripherals([]).then(results => {
      for (let i = 0; i < results.length; i++) {
        let peripheral = results[i];
        BleManager.disconnect(peripheral.id)
          .then(() => {
            peripheral.connected = false;
            peripherals.set(peripheral.id, peripheral);
            let devices = Array.from(peripherals.values());
            setConnectedDevices(Array.from(devices));
            setDiscoveredDevices(Array.from(devices));
            console.log('BLE device disconnected successfully');
          })
          .catch(() => {
            throw Error('failed to disconnect');
          });
      }
    });

  };

  const connect = peripheral => {
    BleManager.connect(peripheral.id)
      .then(() => {
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        let devices = Array.from(peripherals.values());
        setConnectedDevices(Array.from(devices));
        setDiscoveredDevices(Array.from(devices));
        console.log('BLE device connected successfully');
      })
      .catch(() => {
        throw Error('failed to connect');
      });
    // BleManager.createBond(peripheral.id)
    //   .then(() => {
    //     peripheral.connected = true;
    //     peripherals.set(peripheral.id, peripheral);
    //     let devices = Array.from(peripherals.values());
    //     setConnectedDevices(Array.from(devices));
    //     setDiscoveredDevices(Array.from(devices));
    //     console.log('BLE device paired successfully');
    //   })
    //   .catch(() => {
    //     throw Error('failed to bond');
    //   });
  };

  const disconnect = peripheral => {
    BleManager.disconnect(peripheral.id)
      .then(() => {
        peripheral.connected = false;
        peripherals.set(peripheral.id, peripheral);
        let devices = Array.from(peripherals.values());
        setConnectedDevices(Array.from(devices));
        setDiscoveredDevices(Array.from(devices));
        console.log('BLE device disconnected successfully');
      })
      .catch(() => {
        throw Error('failed to disconnect');
      });
    // BleManager.removeBond(peripheral.id)
    //   .then(() => {
    //     peripheral.connected = false;
    //     peripherals.set(peripheral.id, peripheral);
    //     let devices = Array.from(peripherals.values());
    //     setConnectedDevices(Array.from(devices));
    //     setDiscoveredDevices(Array.from(devices));
    //     Alert.alert(`Disconnected from ${peripheral.name}`);
    //   })
    //   .catch(() => {
    //     throw Error('fail to remove the bond');
    //   });
  };

  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaView style={[backgroundStyle, styles.container]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <View style={{pdadingHorizontal: 20}}>
        <Text
          style={[
            styles.title,
            {color: isDarkMode ? Colors.white : Colors.black},
          ]}>
          React Native BLE Manager Tutorial
        </Text>
        <TouchableOpacity
          onPress={scan}
          activeOpacity={0.5}
          style={styles.scanButton}>
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Scanning...' : 'Scan Bluetooth Devices'}
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            styles.subtitle,
            {color: isDarkMode ? Colors.white : Colors.black},
          ]}>
          Discovered Devices:
        </Text>
        {discoveredDevices.length > 0 ? (
          <FlatList
            data={discoveredDevices}
            renderItem={({item}) => (
              <DeviceList
                peripheral={item}
                connect={connect}
                disconnect={disconnect}
              />
            )}
            keyExtractor={item => item.id}
          />
        ) : (
          <Text style={styles.noDevicesText}>No Bluetooth devices found</Text>
        )}

        <Text
          style={[
            styles.subtitle,
            {color: isDarkMode ? Colors.white : Colors.black},
          ]}>
          Connected Devices:
        </Text>
        {connectedDevices.length > 0 ? (
          <FlatList
            data={connectedDevices}
            renderItem={({item}) => (
              <DeviceList
                peripheral={item}
                connect={connect}
                disconnect={disconnect}
              />
            )}
            keyExtractor={item => item.id}
          />
        ) : (
          <Text style={styles.noDevicesText}>No connected devices</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

export default App;
