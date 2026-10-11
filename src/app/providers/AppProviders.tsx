import React from 'react';
import { Toaster as SonnerToaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GlobalAuthProvider } from "@/features/auth/contexts";
import { ForegroundNotificationListener } from "@/features/notifications/components/ForegroundNotificationListener";


const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            staleTime: 30 * 1000, // 30s fresh window before refetching
            retry: 1,
        },
    },
});

export const AppProviders = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <SonnerToaster />
            <ForegroundNotificationListener />
            {/* Unified auth provider - provides all role-specific hooks */}
            <GlobalAuthProvider>
                {children}
            </GlobalAuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);


