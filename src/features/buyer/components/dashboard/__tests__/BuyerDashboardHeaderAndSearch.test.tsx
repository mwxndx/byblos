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
  it('renders a back button to landing page for guest buyers (not authenticated)', () => {
    mockIsAuthenticated = false;
    render(<BuyerDashboardHeader onOpenProfile={vi.fn()} />);

    const backButton = screen.getByRole('button', { name: /back to landing page/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');

    // City selector must NOT be in the header
    expect(screen.queryByLabelText(/city/i)).not.toBeInTheDocument();
  });

  it('does not render back button for authenticated buyers', () => {
    mockIsAuthenticated = true;
    render(<BuyerDashboardHeader onOpenProfile={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /back to landing page/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/city/i)).not.toBeInTheDocument();
  });
});

describe('BuyerDashboardSearch', () => {
  it('renders city selector in the middle above the search products search bar in shop section', () => {
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

    // Verify city selector appears before search input in DOM order (above it)
    expect(citySelect.compareDocumentPosition(searchInput)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
