import { createBrowserRouter, Outlet } from "react-router-dom";

import { AppProviders } from "@/app/providers/AppProviders";
import { ThemeManager } from "@/app/bootstrap/ThemeManager";
import { ScreenSecurityRouteManager } from "@/app/bootstrap/ScreenSecurityRouteManager";
import { RootErrorElement } from "@/shared/components/ErrorBoundary";
import NotFound from "@/shared/components/NotFound";
import { routes } from "@/app/router/routes.index";

export const router = createBrowserRouter([
  {
    element: (
      <AppProviders>
        <ThemeManager />
        <ScreenSecurityRouteManager />
        <Outlet />
      </AppProviders>
    ),
    errorElement: <RootErrorElement />,
    children: [
      ...routes,
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
