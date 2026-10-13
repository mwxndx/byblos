import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { router } from "@/app/router";
import { LoadingScreen } from "@/shared/components/LoadingScreen";
import { useAndroidBackHandler, registerNavigationDelegate } from "@/shared/utils/modalBackHandler";
import { useNativeDeepLinkHandler } from "@/infrastructure/navigation/deepLinkHandler";
import { InstallPrompt } from "@/features/pwa/InstallPrompt";

// Register router delegation so shared mobile back handler doesn't import app router directly
registerNavigationDelegate({
  getPathname: () => router.state.location.pathname,
  navigate: (to) => router.navigate(to)
});

function App() {
  // Intercept Android hardware back button for active modals/sheets
  useAndroidBackHandler();

  // Handle Capacitor native deep links (verification emails, resets, tracking)
  useNativeDeepLinkHandler((path) => router.navigate(path));

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


