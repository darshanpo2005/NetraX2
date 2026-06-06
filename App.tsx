import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import WorkerListScreen from './src/screens/WorkerListScreen';
import AdminScreen from './src/screens/AdminScreen';
import AttendanceReportScreen from './src/screens/AttendanceReportScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#020817" />
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: { backgroundColor: '#020817', elevation: 0, shadowOpacity: 0 },
          headerTintColor: '#60a5fa',
          headerTitleStyle: { fontWeight: '800', fontSize: 18, letterSpacing: 0.5 },
          cardStyle: { backgroundColor: '#020817' },
        }}
      >
        <Stack.Screen name="Splash"      component={SplashScreen}     options={{ headerShown: false }} />
        <Stack.Screen name="Login"       component={LoginScreen}      options={{ headerShown: false }} />
        <Stack.Screen name="Home"        component={HomeScreen}       options={{ title: 'NetraX 2.0', headerLeft: () => null }} />
        <Stack.Screen name="Enroll"      component={EnrollScreen}     options={{ title: 'Register Worker' }} />
        <Stack.Screen name="Attendance"  component={AttendanceScreen} options={{ title: 'Face Authentication' }} />
        <Stack.Screen name="WorkerList"  component={WorkerListScreen} options={{ title: 'Workforce' }} />
        <Stack.Screen name="Admin"       component={AdminScreen}           options={{ title: 'Admin Console' }} />
        <Stack.Screen name="Reports"     component={AttendanceReportScreen} options={{ title: 'Attendance Reports' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
