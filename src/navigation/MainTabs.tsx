import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import AttendanceReportScreen from '../screens/AttendanceReportScreen';
import AdminScreen from '../screens/AdminScreen';
import { COLORS } from '../theme';

const Tab = createBottomTabNavigator();

const TAB_ICON: Record<string, any> = {
  Home: 'home',
  Attendance: 'face-retouching-natural',
  Reports: 'history',
  Admin: 'admin-panel-settings',
};

const TAB_LABEL: Record<string, string> = {
  Home: 'Home',
  Attendance: 'Capture',
  Reports: 'History',
  Admin: 'Profile',
};

const TAB_TITLE: Record<string, string> = {
  Attendance: 'Face Authentication',
  Reports: 'Attendance Reports',
  Admin: 'Admin Console',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: route.name !== 'Home',
        title: TAB_TITLE[route.name],
        headerStyle: {
          backgroundColor: COLORS.background, elevation: 0, shadowOpacity: 0,
          borderBottomWidth: 1, borderBottomColor: COLORS.border,
        },
        headerTintColor: COLORS.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, letterSpacing: 0.5, color: COLORS.textPrimary },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          height: 65,
          backgroundColor: '#0F1923',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabel: TAB_LABEL[route.name],
        tabBarIcon: ({ focused, color }) => (
          <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
            <MaterialIcons name={TAB_ICON[route.name]} size={22} color={color} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Reports" component={AttendanceReportScreen} />
      <Tab.Screen name="Admin" component={AdminScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(37,99,235,0.15)',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
