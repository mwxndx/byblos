-- Enforce singleton privileged accounts at the database layer:
-- Only one marketing account and one logistics (Mzigo) account may exist in users.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_singleton_marketing
    ON public.users (role)
    WHERE role = 'marketing';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_singleton_logistics
    ON public.users (role)
    WHERE role = 'logistics';

