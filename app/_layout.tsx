import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DataProvider } from "@/contexts/DataContext";
import { QAQCProvider } from "@/contexts/QAQCContext";
import { ErrorProvider } from '@/contexts/ErrorContext';
import ErrorModal from '@/components/ErrorModal';
import { trpc, trpcClient } from "@/lib/trpc";
import ErrorBoundary from "../components/ErrorBoundary";
import { OnboardingModal } from "@/components/OnboardingModal";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen once initial data is loaded or theme is ready
    SplashScreen.hideAsync().catch(() => {
      /* Ignore errors */
    });
  }, []);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
              <DataProvider>
                <QAQCProvider>
                  <ErrorProvider>
                    <OnboardingModal />
                    <RootLayoutNav />
                    <ErrorModal />
                  </ErrorProvider>
                </QAQCProvider>
              </DataProvider>
            </ThemeProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
