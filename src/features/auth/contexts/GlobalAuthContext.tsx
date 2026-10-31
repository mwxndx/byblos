import { ReactNode } from 'react';
import { AuthCoreProvider } from './AuthCoreContext';

export function GlobalAuthProvider({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <AuthCoreProvider>
            {children}
        </AuthCoreProvider>
    );
}
