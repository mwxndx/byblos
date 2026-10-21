import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import IndexPage from '../MarketplaceIndex';

describe('MarketplaceIndex (Simplified Landing Page)', () => {
  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <IndexPage />
        </MemoryRouter>
      </HelmetProvider>
    );

  it('renders the 24px by 24px logo above the creator button', () => {
    renderPage();
    const logos = screen.getAllByAltText('Byblos logo');
    expect(logos.length).toBeGreaterThanOrEqual(1);
    for (const logo of logos) {
      expect(logo).toHaveClass('h-6');
      expect(logo).toHaveClass('w-6');
    }
  });

  it('renders the Creator button linking to /creator/login', () => {
    renderPage();
    const creatorLink = screen.getByRole('link', { name: /^creator$/i });
    expect(creatorLink).toBeInTheDocument();
    expect(creatorLink).toHaveAttribute('href', '/creator/login');
  });

  it('renders the View Brands button linking to /buyer/login', () => {
    renderPage();
    const viewBrandsLink = screen.getByRole('link', { name: /view brands/i });
    expect(viewBrandsLink).toBeInTheDocument();
    expect(viewBrandsLink).toHaveAttribute('href', '/buyer/login');
  });

  it('renders the Add Brand button linking to /seller/register', () => {
    renderPage();
    const addBrandLink = screen.getByRole('link', { name: /add brand/i });
    expect(addBrandLink).toBeInTheDocument();
    expect(addBrandLink).toHaveAttribute('href', '/seller/register');
  });

  it('does not contain the swipe up element or text', () => {
    renderPage();
    expect(screen.queryByText(/swipe up to add business/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/click here to add business/i)).not.toBeInTheDocument();
  });
});
