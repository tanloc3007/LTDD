import 'react-native-gesture-handler'; // phải là dòng đầu tiên
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen    from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen     from './screens/HomeScreen';
import TransactionScreen from './screens/TransactionScreen';
import StatsScreen from './screens/StatsScreen';
import BudgetScreen from './screens/BudgetScreen';
import LimitScreen from './screens/LimitScreen';
import AIChatScreen from './screens/AIChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import { AuthProvider } from './contexts/AuthContext';
import { FinanceProvider } from './contexts/FinanceContext';
import { SettingsProvider } from './contexts/SettingsContext';

const Stack = createStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <SettingsProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Home"     component={HomeScreen} />
            <Stack.Screen name="Transaction" component={TransactionScreen} />
            <Stack.Screen name="Stats" component={StatsScreen} />
            <Stack.Screen name="Budget" component={BudgetScreen} />
            <Stack.Screen name="Limit" component={LimitScreen} />
            <Stack.Screen name="AIChat" component={AIChatScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </Stack.Navigator>
          </NavigationContainer>
        </SettingsProvider>
      </FinanceProvider>
    </AuthProvider>
  );
}
