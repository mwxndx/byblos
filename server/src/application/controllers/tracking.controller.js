import LogisticsTrackingLinkService from '../../domains/logistics/logisticsTrackingLink.service.js';

export const getPublicTrackingByToken = async (req, res, next) => {
    try {
        const tracking = await LogisticsTrackingLinkService.getSafeTrackingByToken(req.params.token);
        res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=15');
        res.status(200).json({
            status: 'success',
            data: tracking
        });
    } catch (error) {
        next(error);
    }
};
