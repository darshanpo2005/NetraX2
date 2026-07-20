import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import WorkerListScreen from './src/screens/WorkerListScreen';
import WorkerDetailScreen from './src/screens/WorkerDetailScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AbsenteeScreen from './src/screens/AbsenteeScreen';
import MainTabs from './src/navigation/MainTabs';
import { COLORS } from './src/theme';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerStyle: { backgroundColor: COLORS.background, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border },
            headerTintColor: COLORS.primary,
            headerTitleStyle: { fontWeight: '700', fontSize: 17, letterSpacing: 0.5, color: COLORS.textPrimary },
            cardStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen name="Splash"       component={SplashScreen}       options={{ headerShown: false }} />
          <Stack.Screen name="Login"        component={LoginScreen}        options={{ headerShown: false }} />
          <Stack.Screen name="MainTabs"     component={MainTabs}           options={{ headerShown: false }} />
          <Stack.Screen name="Enroll"       component={EnrollScreen}       options={{ title: 'Register Worker' }} />
          <Stack.Screen name="WorkerList"   component={WorkerListScreen}   options={{ title: 'Workforce' }} />
          <Stack.Screen name="WorkerDetail" component={WorkerDetailScreen} options={{ title: 'Worker Profile' }} />
          <Stack.Screen name="Dashboard"    component={DashboardScreen}    options={{ title: 'Dashboard' }} />
          <Stack.Screen name="Absentees"    component={AbsenteeScreen}     options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
