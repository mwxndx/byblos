import { refreshAccessToken } from '../../shared/utils/refreshToken.js';
import { AppError } from '../../shared/utils/errorHandler.js';
import { setAuthCookie, setRefreshTokenCookie } from '../../shared/utils/cookie.utils.js';

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (req, res, next) => {
  try {
    const tokenString = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!tokenString) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Generate new access token (plus a rolling refresh token)
    const { accessToken, refreshToken: newRefreshToken, user } = await refreshAccessToken(tokenString);

    // Set updated HttpOnly jwt access cookie for Web browser sessions
    setAuthCookie(res, accessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user
      }
    });
  } catch (error) {
    next(new AppError(error.message || 'Failed to refresh token', 401));
  }
};

