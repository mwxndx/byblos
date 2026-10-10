import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TermsModal from './TermsModal';

// Mock child TermsContent to isolate modal shell testing
vi.mock('./TermsContent', () => ({
  TermsContent: () => <div data-testid="terms-content">Terms Body</div>,
}));

describe('TermsModal', () => {
  it('renders modal with title and sections when open', () => {
    render(<TermsModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: /BYBLOS TERMS & CONDITIONS/i })).toBeInTheDocument();
    expect(screen.getByTestId('terms-content')).toBeInTheDocument();
  });

  it('renders accept and decline buttons when onAccept is provided', () => {
    const handleAccept = vi.fn();
    const handleClose = vi.fn();
    render(<TermsModal isOpen={true} onClose={handleClose} onAccept={handleAccept} />);

    const acceptBtn = screen.getByRole('button', { name: /I Agree to Terms/i });
    expect(acceptBtn).toBeInTheDocument();
    fireEvent.click(acceptBtn);
    expect(handleAccept).toHaveBeenCalledTimes(1);

    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    expect(declineBtn).toBeInTheDocument();
    fireEvent.click(declineBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders close button in footer when onAccept is not provided', () => {
    const handleClose = vi.fn();
    render(<TermsModal isOpen={true} onClose={handleClose} />);

    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
