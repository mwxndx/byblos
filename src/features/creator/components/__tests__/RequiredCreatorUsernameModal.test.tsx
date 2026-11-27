import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequiredCreatorUsernameModal } from '../RequiredCreatorUsernameModal';

const mutateAsyncSpy = vi.fn().mockResolvedValue({});

vi.mock('@/features/creator/hooks/mutations/useUpdateCreatorProfileMutation', () => ({
  useUpdateCreatorProfileMutation: () => ({
    mutateAsync: mutateAsyncSpy,
    isPending: false,
  }),
}));

vi.mock('@/features/creator/api/auth', () => ({
  checkCreatorUsernameAvailability: vi.fn().mockResolvedValue({
    available: true,
    allowed: true,
    normalizedUsername: 'roynthiga',
    message: 'Username is available',
  }),
}));

describe('RequiredCreatorUsernameModal', () => {
  beforeEach(() => {
    mutateAsyncSpy.mockClear();
  });

  it('prompts existing creators with usernameConfirmed=false and saves valid username', async () => {
    render(
      <RequiredCreatorUsernameModal
        creator={{ id: 10, username: 'roynthiga10', usernameConfirmed: false }}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Choose your creator username')).toBeInTheDocument();
    const input = screen.getByLabelText('Creator username');
    fireEvent.change(input, { target: { value: 'roynthiga' } });
    fireEvent.click(screen.getByRole('button', { name: /save username/i }));

    expect(mutateAsyncSpy).toHaveBeenCalledWith({ username: 'roynthiga' });
  });

  it('does not render when usernameConfirmed is true', () => {
    render(
      <RequiredCreatorUsernameModal
        creator={{ id: 10, username: 'roynthiga', usernameConfirmed: true }}
        onLogout={vi.fn()}
      />
    );

    expect(screen.queryByText('Choose your creator username')).not.toBeInTheDocument();
  });
});

