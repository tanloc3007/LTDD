import 'react-native-gesture-handler';
import React from 'react';
import { Easing } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import TransactionScreen from './screens/TransactionScreen';
import StatsScreen from './screens/StatsScreen';
import BudgetScreen from './screens/BudgetScreen';
import LimitScreen from './screens/LimitScreen';
import AIChatScreen from './screens/AIChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import CreateBudgetScreen from './screens/CreateBudgetScreen.js';
import SetBudgetAmountScreen from './screens/SetBudgetAmountScreen.js';
import AddCategoryScreen from './screens/AddCategoryScreen.js';
import { AuthProvider } from './contexts/AuthContext';
import { FinanceProvider } from './contexts/FinanceContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';

const Stack = createStackNavigator();

const smoothScreenTransition = {
  animation: 'timing',
  config: {
    duration: 300,
    easing: Easing.out(Easing.poly(4)),
  },
};

const tabRoutes = new Set(['Home', 'Transaction', 'Stats', 'Budget', 'Profile']);

const createCardStyleInterpolator = (route) => ({ current, layouts }) => {
  const isTabRoute = tabRoutes.has(route.name);
  const direction = route.params?.tabTransitionDirection || 1;
  const travel = isTabRoute ? layouts.screen.width * 0.12 : 18;

  return {
    cardStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [0, 0.96, 1],
        extrapolate: 'clamp',
      }),
      transform: isTabRoute
        ? [
            {
              translateX: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [direction * travel, 0],
                extrapolate: 'clamp',
              }),
            },
            {
              scale: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.992, 1],
                extrapolate: 'clamp',
              }),
            },
          ]
        : [
            {
              translateY: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [travel, 0],
                extrapolate: 'clamp',
              }),
            },
            {
              scale: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1],
                extrapolate: 'clamp',
              }),
            },
          ],
    },
  };
};

function AppNavigation() {
  const { theme, colors } = useSettings();

  return (
    <NavigationContainer>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.bg} />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={({ route }) => ({
          headerShown: false,
          gestureEnabled: true,
          transitionSpec: {
            open: smoothScreenTransition,
            close: smoothScreenTransition,
          },
          cardStyle: { backgroundColor: colors.bg },
          cardStyleInterpolator: createCardStyleInterpolator(route),
        })}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Transaction" component={TransactionScreen} />
        <Stack.Screen name="Stats" component={StatsScreen} />
        <Stack.Screen name="Budget" component={BudgetScreen} />
        <Stack.Screen name="Limit" component={LimitScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="CreateBudget" component={CreateBudgetScreen} />
        <Stack.Screen name="SetBudgetAmount" component={SetBudgetAmountScreen} />
        <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <SettingsProvider>
          <AppNavigation />
        </SettingsProvider>
      </FinanceProvider>
    </AuthProvider>
  );
}
