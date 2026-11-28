import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootErrorElement } from '../ErrorBoundary';

function renderWithRouteError(thrownError: unknown) {
  function Bomb(): null {
    throw thrownError;
  }

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Bomb />,
        errorElement: <RootErrorElement />,
      },
    ],
    {
      initialEntries: ['/'],
      future: { v7_startTransition: true },
    }
  );

  render(<RouterProvider router={router} />);
}

describe('RootErrorElement', () => {
  it('renders collapsible Technical Details with exact error message for unexpected routing errors', () => {
    renderWithRouteError(new Error('Cannot read properties of undefined (reading shopName)'));

    expect(screen.getByText('Page Error')).toBeInTheDocument();
    expect(screen.getByText('An unexpected routing error occurred.')).toBeInTheDocument();
    expect(screen.getByText('Technical Details')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Cannot read properties of undefined \(reading shopName\)/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders New Update Available fallback for Vite CSS preload errors', () => {
    renderWithRouteError(new Error('Unable to preload CSS for /assets/ShopPage-999.css'));

    expect(screen.getByText('New Update Available')).toBeInTheDocument();
  });
});

