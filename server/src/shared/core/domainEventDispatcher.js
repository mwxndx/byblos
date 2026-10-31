import eventBus from '../../application/events/eventBus.js';
export { eventBus, AppEvents, AppEvents as DomainEvents } from '../../application/events/eventBus.js';

/**
 * Domain-level Event Dispatcher Facade (Backward-Compatibility Seam)
 * Directly re-exports eventBus to eliminate redundant middleman indirection
 * while preserving compatibility for callers.
 */
export const domainEventDispatcher = eventBus;
export default domainEventDispatcher;
