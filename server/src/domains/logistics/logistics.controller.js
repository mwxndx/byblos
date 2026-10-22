import LogisticsDashboardService from './logisticsDashboard.service.js';
import LogisticsEtaService from './logisticsEta.service.js';
import { setAuthCookie, setRefreshTokenCookie } from '../../shared/utils/cookie.utils.js';
import { revokeSessionTokens, clearAuthCookies } from '../../shared/utils/sessionRevocation.js';
import { AppError } from '../../shared/utils/errorHandler.js';

export const loginLogisticsPartner = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        const result = await LogisticsDashboardService.login({ email, password });

        setAuthCookie(res, result.token);
        setRefreshTokenCookie(res, result.refreshToken);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const logoutLogisticsPartner = async (req, res, next) => {
    try {
        await revokeSessionTokens(req);
        clearAuthCookies(res);

        res.status(200).json({
            status: 'success',
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const getLogisticsMe = async (req, res, next) => {
    try {
        const partner = req.logisticsPartner || req.user?.profile || (req.user?.profileId ? {
            id: req.user.profileId,
            name: req.user.partner_name || req.user.name,
            slug: req.user.partner_slug,
            email: req.user.email
        } : null);

        res.status(200).json({
            status: 'success',
            data: {
                partner
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getLogisticsDashboardRequests = async (req, res, next) => {
    try {
        const partnerId = req.logisticsPartner?.id || req.user?.profile_id || req.user?.id;
        if (!partnerId) {
            return next(new AppError('Logistics partner identity not found', 400));
        }

        const dashboard = await LogisticsDashboardService.getDashboardRequests({
            partnerId,
            sort: req.query.sort,
            limit: req.query.limit,
            offset: req.query.offset
        });

        res.status(200).json({
            status: 'success',
            data: dashboard
        });
    } catch (error) {
        next(error);
    }
};

export const updateLogisticsLegStatus = async (req, res, next) => {
    try {
        const partnerId = req.logisticsPartner?.id || req.user?.profile_id || req.user?.id;
        if (!partnerId) {
            return next(new AppError('Logistics partner identity not found', 400));
        }

        const verificationCode = req.body?.verificationCode
            || req.body?.packageCode
            || req.body?.code
            || null;

        const result = await LogisticsDashboardService.updateLegStatus({
            partner: req.logisticsPartner || { id: partnerId, email: req.user?.email },
            partnerId,
            requestId: req.params.requestId,
            legType: req.params.legType,
            status: req.body?.status,
            verificationCode
        });

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const updateRiderLocation = async (req, res, next) => {
    try {
        const partnerId = req.logisticsPartner?.id || req.user?.profile_id || req.user?.id;
        const { legId } = req.params;
        const { latitude, longitude, accuracy, speed, heading, timestamp } = req.body || {};

        const result = await LogisticsEtaService.recordRiderLocation({
            partnerId,
            legId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            timestamp
        });

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export class LogisticsController {
    static loginLogisticsPartner = loginLogisticsPartner;
    static logoutLogisticsPartner = logoutLogisticsPartner;
    static getLogisticsMe = getLogisticsMe;
    static getLogisticsDashboardRequests = getLogisticsDashboardRequests;
    static updateLogisticsLegStatus = updateLogisticsLegStatus;
    static updateRiderLocation = updateRiderLocation;
}

export default LogisticsController;
