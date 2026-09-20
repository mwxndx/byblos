import React, { ReactNode } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { LogOut, ArrowLeft, Menu, X } from '@/shared/ui/icons';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { cn } from '@/shared/utils/formatting';
import { useGlobalAuth, UserRole } from '@/features/auth/contexts';
import { registerModalDismiss } from '@/shared/utils/modalBackHandler';

// ============================================================================
// TYPES
// ============================================================================

export interface NavigationItem {
    label: string;
    path: string;
    icon?: React.ComponentType<{ className?: string }>;
    badge?: string | number;
}

export interface BaseDashboardLayoutProps {
    role: UserRole;
    title: string;
    subtitle?: string;
    navigationItems?: NavigationItem[];
    showBackButton?: boolean;
    backButtonPath?: string;
    backButtonLabel?: string;
    showSidebar?: boolean;
    showHeader?: boolean;
    sidebarHeader?: ReactNode;
    headerActions?: ReactNode;
    children?: ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BaseDashboardLayout({
    role,
    title,
    subtitle,
    navigationItems = [],
    showBackButton = true,
    backButtonPath = '/',
    backButtonLabel = 'Back to Home',
    showSidebar = false,
    showHeader = true,
    sidebarHeader,
    headerActions,
    children,
}: BaseDashboardLayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, isAuthenticated } = useGlobalAuth();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    React.useEffect(() => {
        if (!sidebarOpen) return;
        return registerModalDismiss(() => {
            setSidebarOpen(false);
            return true;
        });
    }, [sidebarOpen]);

    React.useEffect(() => {
        document.body.classList.add('dashboard-active');
        return () => {
            document.body.classList.remove('dashboard-active');
        };
    }, []);

    // Check if current path matches navigation item
    const isActivePath = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    // Determine if logout button should be shown
    const authRoutes = ['/login', '/register', '/seller/login', '/seller/register'];
    const isAuthRoute = authRoutes.includes(location.pathname);
    const shouldShowLogout = isAuthenticated && !isAuthRoute;

    // Handle logout
    const handleLogout = () => {
        logout();
    };

    // Handle back navigation
    const handleBack = () => {
        navigate(backButtonPath);
    };

    return (
        <div className="dashboard-layout flex min-h-[100svh] overflow-x-hidden bg-[var(--bg)] text-label">
            {/* Skip to Content for Accessibility */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand focus:text-brand-on focus:font-semibold focus:rounded-control"
            >
                Skip to content
            </a>

            {/* Sidebar (if enabled) */}
            {showSidebar && (
                <>
                    {/* Mobile sidebar overlay */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                            aria-hidden="true"
                        />
                    )}

                    {/* Sidebar */}
                    <aside
                        className={cn(
                            'fixed lg:sticky top-0 left-0 h-[100svh] w-64 bg-chrome backdrop-blur-md border-r border-separator z-[101] lg:z-10 transition-transform duration-300 ease-in-out',
                            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                        )}
                        aria-label={`${role} sidebar navigation`}
                    >
                        {/* Sidebar Header */}
                        <div className="h-16 flex items-center justify-between px-6 border-b border-separator">
                            {sidebarHeader || (
                                <h2 className="text-xl font-semibold text-label tracking-[-0.02em]">
                                    {title}
                                </h2>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden text-label-2 hover:text-label hover:bg-fill"
                                aria-label="Close sidebar"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Navigation Items */}
                        <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main sidebar navigation">
                            {navigationItems.map((item, index) => {
                                const Icon = item.icon;
                                const isActive = isActivePath(item.path);

                                return (
                                    <Link
                                        key={index}
                                        to={item.path}
                                        onClick={() => setSidebarOpen(false)}
                                        className={cn(
                                            'flex items-center gap-3 px-4 py-2.5 rounded-control transition-all duration-200 ease-ios',
                                            isActive
                                                ? 'bg-fill text-label font-semibold'
                                                : 'text-label-2 hover:text-label hover:bg-fill'
                                        )}
                                        aria-current={isActive ? 'page' : undefined}
                                    >
                                        {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
                                        <span className="flex-1">{item.label}</span>
                                        {item.badge && (
                                            <span className="px-2 py-0.5 text-xs font-bold bg-brand text-brand-on rounded-full">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Sidebar Footer */}
                        <div className="p-4 border-t border-separator">
                            {shouldShowLogout && (
                                <Button
                                    variant="outline"
                                    onClick={handleLogout}
                                    className="w-full rounded-control"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Log out
                                </Button>
                            )}
                        </div>
                    </aside>
                </>
            )}

            {/* Main Content Area */}
            <div className="flex min-w-0 flex-1 flex-col">
                {showHeader && (
                    <header
                        className="bg-chrome backdrop-blur-md border-b border-separator sticky top-0 z-30 pt-safe-top"
                        role="banner"
                    >
                        <div className="mx-auto max-w-screen-2xl px-3 sm:px-6 lg:px-8">
                            <div className="relative flex items-center justify-between h-14">
                                {/* Left: Menu/Back Button */}
                                <div className="flex-1 flex items-center gap-2">
                                    {showSidebar && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSidebarOpen(true)}
                                            className="lg:hidden text-label-2 hover:text-label hover:bg-fill transition-all duration-200 rounded-control px-3 py-2 -ml-3"
                                            aria-label="Open sidebar"
                                        >
                                            <Menu className="h-5 w-5" />
                                        </Button>
                                    )}
                                    {showBackButton && !isNativeApp() && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBack}
                                            className="text-label-2 hover:text-label hover:bg-fill transition-all duration-200 rounded-control px-3 py-2 text-sm -ml-3"
                                            aria-label={backButtonLabel}
                                        >
                                            <ArrowLeft className="h-4 w-4 mr-2" />
                                            <span className="hidden sm:inline">{backButtonLabel}</span>
                                            <span className="sm:hidden">Back</span>
                                        </Button>
                                    )}
                                </div>

                                {/* Center: Title */}
                                <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[42%] sm:max-w-[50%]">
                                    <h1 className="text-lg sm:text-xl font-semibold text-label tracking-[-0.01em] truncate">
                                        {title}
                                    </h1>
                                    {subtitle && (
                                        <p className="hidden sm:block text-xs sm:text-sm text-label-2 font-medium truncate">
                                            {subtitle}
                                        </p>
                                    )}
                                </div>

                                {/* Right: Actions/Logout */}
                                <div className="flex-1 flex items-center justify-end gap-2">
                                    {headerActions}
                                    {!showSidebar && shouldShowLogout && (
                                        <Button
                                            variant="outline"
                                            onClick={handleLogout}
                                            className="inline-flex items-center gap-2 rounded-control h-9 sm:h-10 px-3 sm:px-4 -mr-3"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            <span className="hidden sm:inline">Log out</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>
                )}

                {/* Main Content */}
                <main
                    id="main-content"
                    className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto focus:outline-none"
                    role="main"
                >
                    {children || <Outlet />}
                </main>
            </div>
        </div>
    );
}

// ============================================================================
// ROLE-SPECIFIC LAYOUT WRAPPERS
// ============================================================================

export function BuyerDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="buyer" {...props} />;
}

export function SellerDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="seller" {...props} />;
}

export function AdminDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="admin" {...props} />;
}


