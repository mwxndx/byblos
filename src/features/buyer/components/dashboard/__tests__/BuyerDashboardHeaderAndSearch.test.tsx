import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuyerDashboardHeader } from '../BuyerDashboardHeader';
import { BuyerDashboardSearch } from '../BuyerDashboardSearch';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockIsAuthenticated = false;
vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

describe('BuyerDashboardHeader', () => {
  it('renders Nairobi pill on the left, Byblos text and search icon at the center', () => {
    mockIsAuthenticated = false;
    const handleToggleSearch = vi.fn();

    render(
      <BuyerDashboardHeader
        onOpenProfile={vi.fn()}
        isSearchOpen={false}
        onToggleSearch={handleToggleSearch}
      />
    );

    // Nairobi pill is rendered on the left
    const citySelect = screen.getByLabelText(/city/i);
    expect(citySelect).toBeInTheDocument();
    expect(citySelect).toHaveValue('Nairobi');

    // 'Byblos' text at center
    expect(screen.getByText('Byblos')).toBeInTheDocument();

    // Search button next to Byblos text
    const searchButton = screen.getByRole('button', { name: /search products or shops/i });
    expect(searchButton).toBeInTheDocument();

    fireEvent.click(searchButton);
    expect(handleToggleSearch).toHaveBeenCalledTimes(1);

    // When search is not open, the search input is not displayed
    expect(screen.queryByLabelText(/search products or shops/i, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('renders expandable search input when isSearchOpen is true', () => {
    mockIsAuthenticated = true;
    const handleSearchChange = vi.fn();

    render(
      <BuyerDashboardHeader
        onOpenProfile={vi.fn()}
        isSearchOpen={true}
        onToggleSearch={vi.fn()}
        searchQuery="dress"
        onSearchQueryChange={handleSearchChange}
      />
    );

    const searchInput = screen.getByLabelText(/search products or shops/i, { selector: 'input' });
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveValue('dress');

    fireEvent.change(searchInput, { target: { value: 'shoes' } });
    expect(handleSearchChange).toHaveBeenCalledWith('shoes');
  });

  it('renders back button to landing page for guest buyers and hides it for authenticated buyers', () => {
    mockIsAuthenticated = false;
    const { rerender } = render(<BuyerDashboardHeader onOpenProfile={vi.fn()} />);

    const backButton = screen.getByRole('button', { name: /back to landing page/i });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');

    // Authenticated buyers
    mockIsAuthenticated = true;
    rerender(<BuyerDashboardHeader onOpenProfile={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /back to landing page/i })).not.toBeInTheDocument();
  });
});

describe('BuyerDashboardSearch (legacy component)', () => {
  it('renders city selector and search input for shop section', () => {
    const handleSearch = vi.fn();
    render(
      <BuyerDashboardSearch
        activeSection="shop"
        productSearchQuery=""
        onProductSearchChange={handleSearch}
      />
    );

    const citySelect = screen.getByLabelText(/city/i);
    expect(citySelect).toBeInTheDocument();
    expect(citySelect).toHaveValue('Nairobi');

    const searchInput = screen.getByLabelText(/search products/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('renders nothing when active section is not shop', () => {
    const { container } = render(
      <BuyerDashboardSearch
        activeSection="orders"
        productSearchQuery=""
        onProductSearchChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
