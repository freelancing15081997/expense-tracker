import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/state/AppContext';
import { HomeScreen } from '../src/screens/home';
import { BooksScreen, InsightsScreen, ProfileScreen, SettleScreen } from '../src/screens/spaces';

const Stack = createNativeStackNavigator();

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AppProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Spaces">{() => children}</Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

test('Home renders the month spend', async () => {
  await render(<Host><HomeScreen /></Host>);
  expect(screen.getByText(/Spent in September/)).toBeTruthy();
}, 20000);

test('Books renders the books space', async () => {
  await render(<Host><BooksScreen /></Host>);
  expect(screen.getByText('Books')).toBeTruthy();
}, 20000);

test('Settle renders the settle space', async () => {
  await render(<Host><SettleScreen /></Host>);
  expect(screen.getByText('Settle up')).toBeTruthy();
}, 20000);

test('Insights renders the insights space', async () => {
  await render(<Host><InsightsScreen /></Host>);
  expect(screen.getByText('Insights')).toBeTruthy();
}, 20000);

test('Profile renders the signed-out sample person', async () => {
  await render(<Host><ProfileScreen /></Host>);
  expect(screen.getByText('Arjun Kumar')).toBeTruthy();
}, 20000);
