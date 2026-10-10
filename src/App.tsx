import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { router } from "@/app/router";
import { LoadingScreen } from "@/shared/components/LoadingScreen";
import { useAppTheme } from "@/shared/hooks/useAppTheme";
import { useAndroidBackHandler, registerNavigationDelegate } from "@/shared/utils/modalBackHandler";
import { InstallPrompt } from "@/features/pwa/InstallPrompt";

// Register router delegation so shared mobile back handler doesn't import app router directly
registerNavigationDelegate({
  getPathname: () => router.state.location.pathname,
  navigate: (to) => router.navigate(to)
});

function App() {
  // Bootstrap app theme (light / dark / system) on mount.
  // This hook applies data-theme to <html> and keeps it in sync.
  useAppTheme();

  // Intercept Android hardware back button for active modals/sheets
  useAndroidBackHandler();

  return (
    <ErrorBoundary>
      <RouterProvider
        router={router}
        fallbackElement={<LoadingScreen />}
      />
      <InstallPrompt />
    </ErrorBoundary>
  );
}

export default App;


