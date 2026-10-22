import { v4 as uuidv4 } from 'uuid';

/**
 * Adds or preserves a unique request ID to each request for end-to-end tracing in logs
 */
const requestId = (req, res, next) => {
  // Respect existing request ID from upstream reverse proxy or client if present
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  req.id = typeof incomingId === 'string' && incomingId.trim() ? incomingId.trim() : uuidv4();
  
  // Set the X-Request-ID header in the response
  res.setHeader('X-Request-ID', req.id);
  
  next();
};

export default requestId;
