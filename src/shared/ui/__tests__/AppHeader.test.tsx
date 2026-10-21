import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppHeader } from '../AppHeader';

describe('AppHeader', () => {
  it('renders left, center, and right slots correctly with compact mobile height', () => {
    render(
      <AppHeader
        left={<span data-testid="header-left">Left Slot</span>}
        center={<span data-testid="header-center">Center Title</span>}
        right={<button data-testid="header-right">Right Action</button>}
      />
    );

    expect(screen.getByTestId('header-left')).toBeInTheDocument();
    expect(screen.getByTestId('header-center')).toBeInTheDocument();
    expect(screen.getByTestId('header-right')).toBeInTheDocument();

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0', 'z-50', 'pt-safe-top');

    // The inner container must use compact min-h-11 on mobile (iOS standard 44px)
    // expanding to min-h-14 on sm and min-h-16 on lg
    const innerGrid = screen.getByTestId('header-center').parentElement?.parentElement;
    expect(innerGrid).toHaveClass('min-h-11', 'sm:min-h-14');
  });

  it('renders 2-column layout when center slot is omitted', () => {
    render(
      <AppHeader
        left={<span data-testid="header-left">Brand</span>}
        right={<button data-testid="header-right">Action</button>}
      />
    );

    expect(screen.getByTestId('header-left')).toBeInTheDocument();
    expect(screen.getByTestId('header-right')).toBeInTheDocument();
    expect(screen.queryByTestId('header-center')).not.toBeInTheDocument();

    const innerFlex = screen.getByTestId('header-left').parentElement?.parentElement;
    expect(innerFlex).toHaveClass('min-h-11', 'sm:min-h-14');
  });
});
