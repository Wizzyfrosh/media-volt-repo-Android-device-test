import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ServicesProvider } from '@/services/ServicesProvider';
import { useAppStore } from '@/stores/app-store';
import { ThemeProvider, useTheme } from '@/theme';

// Keep the splash screen up until the database is open (ServicesProvider hides it).
void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, isDark } = useTheme();
  const onboarded = useAppStore((s) => s.onboarded);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="queue" />
          <Stack.Screen name="browser" />
          <Stack.Screen name="scanner" />
          <Stack.Screen name="storage" />
          <Stack.Screen name="debug" />
          <Stack.Screen name="trash" />
          <Stack.Screen name="player/[fileId]" />
          <Stack.Screen name="viewer/[fileId]" />
          <Stack.Screen name="folder/[folderId]" />
          <Stack.Screen name="tools/[tool]" />
          <Stack.Screen
            name="preview/[id]"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.72],
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <GestureHandlerRootView style={styles.flex}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ServicesProvider>
            <RootStack />
          </ServicesProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
