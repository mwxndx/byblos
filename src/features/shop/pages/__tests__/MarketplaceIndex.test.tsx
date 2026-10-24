import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import IndexPage from '../MarketplaceIndex';
import { GlobalAuthContext } from '@/features/auth/contexts/authContextObjects';
import type { GlobalAuthContextType } from '@/features/auth/types/authTypes';

describe('MarketplaceIndex (Simplified Landing Page with Doodles)', () => {
  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter>
          <IndexPage />
        </MemoryRouter>
      </HelmetProvider>
    );

  it('renders the logo increased by 30% (187px from 144px)', () => {
    renderPage();
    const logos = screen.getAllByAltText('Byblos logo');
    expect(logos.length).toBeGreaterThanOrEqual(1);
    for (const logo of logos) {
      expect(logo).toHaveClass('h-[187px]');
      expect(logo).toHaveClass('w-[187px]');
    }
  });

  it('renders the desktop illustration on the left side occupying half the left side with increased dimensions (490px x 406px)', () => {
    renderPage();
    const illustration = screen.getByAltText(/byblos marketplace illustration/i);
    expect(illustration).toBeInTheDocument();
    expect(illustration).toHaveAttribute('src', '/illustration.svg');
    expect(illustration).toHaveClass('w-[490px]');
    expect(illustration).toHaveClass('h-[406px]');

    const leftHalf = illustration.closest('div');
    expect(leftHalf).toHaveClass('hidden', 'lg:flex', 'lg:w-1/2');
  });

  it('renders the Creator button with white background and black text linking to /creator/login', () => {
    renderPage();
    const creatorLink = screen.getByRole('link', { name: /^creator$/i });
    expect(creatorLink).toBeInTheDocument();
    expect(creatorLink).toHaveAttribute('href', '/creator/login');
    const button = creatorLink.querySelector('button');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('text-black');
  });

  it('renders the View Brands button with white background and black text linking to /buyer/dashboard', () => {
    renderPage();
    const viewBrandsLink = screen.getByRole('link', { name: /view brands/i });
    expect(viewBrandsLink).toBeInTheDocument();
    expect(viewBrandsLink).toHaveAttribute('href', '/buyer/dashboard');
    const button = viewBrandsLink.querySelector('button');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('text-black');
  });

  it('renders the Add Brand button with white background and black text linking to /seller/register', () => {
    renderPage();
    const addBrandLink = screen.getByRole('link', { name: /add brand/i });
    expect(addBrandLink).toBeInTheDocument();
    expect(addBrandLink).toHaveAttribute('href', '/seller/register');
    const button = addBrandLink.querySelector('button');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('text-black');
  });

  it('arranges buttons with gap-6 and in order: View Brands, Add Brand, Creator', () => {
    const { container } = renderPage();
    const buttonGroup = container.querySelector('.gap-6');
    expect(buttonGroup).toBeInTheDocument();

    const links = buttonGroup ? Array.from(buttonGroup.querySelectorAll('a')) : [];
    expect(links.length).toBe(3);
    expect(links[0]).toHaveAttribute('href', '/buyer/dashboard');
    expect(links[1]).toHaveAttribute('href', '/seller/register');
    expect(links[2]).toHaveAttribute('href', '/creator/login');
  });

  it('does not contain the swipe up element or text', () => {
    renderPage();
    expect(screen.queryByText(/swipe up to add business/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/click here to add business/i)).not.toBeInTheDocument();
  });

  it('does not render background doodles on the landing page', () => {
    renderPage();
    expect(screen.queryByTestId('landing-doodles')).not.toBeInTheDocument();
  });

  it('applies safe-area insets to ensure fit across iOS and Android device viewports', () => {
    const { container } = renderPage();
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.style.paddingTop).toContain('safe-area-inset-top');
    expect(root.style.paddingBottom).toContain('safe-area-inset-bottom');
  });

  it('renders seamless boot splash and hides action buttons on standalone PWA while auth session revalidation is loading', () => {
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });

    const mockAuthContext: GlobalAuthContextType = {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      role: null,
      login: async () => {},
      loginWithToken: async () => {},
      loginAdmin: async () => {},
      register: async () => {},
      logout: () => {},
      switchAccount: async () => {},
      refreshRole: async () => {},
      forgotPassword: async () => false,
      resetPassword: async () => {},
      getProfile: async () => {},
      updateProfile: async () => {},
    };

    render(
      <HelmetProvider>
        <MemoryRouter>
          <GlobalAuthContext.Provider value={mockAuthContext}>
            <IndexPage />
          </GlobalAuthContext.Provider>
        </MemoryRouter>
      </HelmetProvider>
    );

    // Boot splash should be present
    expect(screen.getByTestId('seamless-boot-splash')).toBeInTheDocument();
    // Action buttons must NOT be rendered (preventing the landing page flash!)
    expect(screen.queryByRole('link', { name: /view brands/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /add brand/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^creator$/i })).not.toBeInTheDocument();

    // Clean up
    delete (window.navigator as unknown as { standalone?: unknown }).standalone;
  });
});
