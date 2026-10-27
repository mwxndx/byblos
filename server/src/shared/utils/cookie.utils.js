
const getRefreshTokenMaxAgeMs = () => {
    const raw = String(process.env.JWT_REFRESH_EXPIRES_IN || '90d').trim();
    if (/^\d+$/.test(raw)) {
        return Number.parseInt(raw, 10) * 1000;
    }
    const match = /^(\d+)([smhd])$/i.exec(raw);
    if (match) {
        const val = Number.parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        switch (unit) {
            case 's': return val * 1000;
            case 'm': return val * 60 * 1000;
            case 'h': return val * 60 * 60 * 1000;
            case 'd': return val * 24 * 60 * 60 * 1000;
        }
    }
    return 90 * 24 * 60 * 60 * 1000;
};

const setAuthCookie = (res, token) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
    };
    // Set primary jwt cookie
    res.cookie('jwt', token, cookieOptions);
    // Clear the legacy admin 'token' cookie to prevent it shadowing 'jwt'
    // This is safe — admin login will reset it immediately if needed
    res.clearCookie('token', { path: '/', httpOnly: true });
};

const setRefreshTokenCookie = (res, refreshToken) => {
    if (!refreshToken) return;
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: getRefreshTokenMaxAgeMs(),
        domain: process.env.COOKIE_DOMAIN || undefined
    });
};

export { setAuthCookie, setRefreshTokenCookie, getRefreshTokenMaxAgeMs };

