import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModalBackDismiss } from '../useModalBackDismiss';
import * as modalBackHandler from '@/shared/utils/modalBackHandler';

vi.mock('@/shared/utils/modalBackHandler', () => ({
  registerModalDismiss: vi.fn(),
}));

describe('useModalBackDismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not register dismissal when isOpen is false', () => {
    const onDismiss = vi.fn();
    renderHook(() => useModalBackDismiss(false, onDismiss));

    expect(modalBackHandler.registerModalDismiss).not.toHaveBeenCalled();
  });

  it('registers dismissal handler and unregisters on unmount when isOpen is true', () => {
    const unregisterMock = vi.fn();
    vi.mocked(modalBackHandler.registerModalDismiss).mockReturnValue(unregisterMock);

    const onDismiss = vi.fn();
    const { unmount } = renderHook(() => useModalBackDismiss(true, onDismiss));

    expect(modalBackHandler.registerModalDismiss).toHaveBeenCalledTimes(1);

    // Test invoking the registered callback
    const registeredCallback = vi.mocked(modalBackHandler.registerModalDismiss).mock.calls[0][0];
    const handled = registeredCallback();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(handled).toBe(true);

    unmount();
    expect(unregisterMock).toHaveBeenCalledTimes(1);
  });
});
