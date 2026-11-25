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
            staleTime: 60 * 1000, // 1m fresh window before refetching
            gcTime: 30 * 60 * 1000, // Keep inactive query results in memory for 30m
            retry: 1,
        },
    },
});

export const AppProviders = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <SonnerToaster />
            {/* Unified auth provider - provides all role-specific hooks */}
            <GlobalAuthProvider>
                <ForegroundNotificationListener />
                {children}
            </GlobalAuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);


