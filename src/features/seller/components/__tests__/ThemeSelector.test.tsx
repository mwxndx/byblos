import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeSelector } from '../ThemeSelector';
import type { Theme } from '@/features/seller/api';

vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockMutateAsync = vi.fn();
vi.mock('@/features/seller/hooks/useSellerProfile', () => ({
  useUpdateThemeMutation: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

describe('ThemeSelector Component', () => {
  it('updates selected theme and notifies parent via onThemeChange upon saving', async () => {
    mockMutateAsync.mockResolvedValue({ theme: 'green' });
    const onThemeChangeSpy = vi.fn();

    function ParentContainer() {
      const [currentTheme, setCurrentTheme] = useState<Theme>('default');

      return (
        <ThemeSelector
          currentTheme={currentTheme}
          onThemeChange={(newTheme) => {
            setCurrentTheme(newTheme);
            onThemeChangeSpy(newTheme);
          }}
        />
      );
    }

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ParentContainer />
      </QueryClientProvider>
    );

    const greenBtn = screen.getByRole('radio', { name: /Select Green theme/i });
    expect(greenBtn.getAttribute('aria-checked')).toBe('false');

    // Select Green
    fireEvent.click(greenBtn);
    expect(greenBtn.getAttribute('aria-checked')).toBe('true');

    // Save
    const saveBtn = screen.getByRole('button', { name: /Save Theme/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('green');
      expect(onThemeChangeSpy).toHaveBeenCalledWith('green');
    });

    // Remains selected as green and does not revert
    expect(greenBtn.getAttribute('aria-checked')).toBe('true');
  });
});
