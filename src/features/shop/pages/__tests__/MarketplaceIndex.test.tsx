import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import IndexPage from '../MarketplaceIndex';

describe('MarketplaceIndex (Simplified Landing Page with Doodles)', () => {
  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <IndexPage />
        </MemoryRouter>
      </HelmetProvider>
    );

  it('renders the 144px logo (scaled 6x from 24px) above the creator button', () => {
    renderPage();
    const logos = screen.getAllByAltText('Byblos logo');
    expect(logos.length).toBeGreaterThanOrEqual(1);
    for (const logo of logos) {
      expect(logo).toHaveClass('h-36');
      expect(logo).toHaveClass('w-36');
    }
  });

  it('renders the Creator button with yellow background and black text linking to /creator/login', () => {
    renderPage();
    const creatorLink = screen.getByRole('link', { name: /^creator$/i });
    expect(creatorLink).toBeInTheDocument();
    expect(creatorLink).toHaveAttribute('href', '/creator/login');
    const button = creatorLink.querySelector('button');
    expect(button).toHaveClass('bg-brand');
    expect(button).toHaveClass('text-black');
  });

  it('renders the View Brands button with yellow background and black text linking to /buyer/login', () => {
    renderPage();
    const viewBrandsLink = screen.getByRole('link', { name: /view brands/i });
    expect(viewBrandsLink).toBeInTheDocument();
    expect(viewBrandsLink).toHaveAttribute('href', '/buyer/login');
    const button = viewBrandsLink.querySelector('button');
    expect(button).toHaveClass('bg-brand');
    expect(button).toHaveClass('text-black');
  });

  it('renders the Add Brand button with yellow background and black text linking to /seller/register', () => {
    renderPage();
    const addBrandLink = screen.getByRole('link', { name: /add brand/i });
    expect(addBrandLink).toBeInTheDocument();
    expect(addBrandLink).toHaveAttribute('href', '/seller/register');
    const button = addBrandLink.querySelector('button');
    expect(button).toHaveClass('bg-brand');
    expect(button).toHaveClass('text-black');
  });

  it('arranges buttons with gap-6 (increased by 3)', () => {
    const { container } = renderPage();
    const buttonGroup = container.querySelector('.gap-6');
    expect(buttonGroup).toBeInTheDocument();
  });

  it('does not contain the swipe up element or text', () => {
    renderPage();
    expect(screen.queryByText(/swipe up to add business/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/click here to add business/i)).not.toBeInTheDocument();
  });

  it('renders exactly 90 background doodles with 60% opacity placed behind the buttons', () => {
    const { container } = renderPage();
    const doodleContainer = screen.getByTestId('landing-doodles');
    expect(doodleContainer).toBeInTheDocument();
    expect(doodleContainer).toHaveClass('pointer-events-none');
    expect(doodleContainer).toHaveClass('z-0');

    const doodleItems = screen.getAllByTestId('landing-doodle-item');
    expect(doodleItems.length).toBe(90);

    for (const item of doodleItems) {
      expect(item).toHaveClass('opacity-60');
      expect(item.style.opacity).toBe('0.6');
    }

    // Ensure the main button container has z-10 above the doodles (z-0)
    const mainContent = container.querySelector('main');
    expect(mainContent).toHaveClass('z-10');
  });
});
