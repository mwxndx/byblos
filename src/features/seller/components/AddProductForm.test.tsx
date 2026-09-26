// Behaviour test for the single-screen add-product redesign (was a 2-step
// wizard). Drives the real component with the network/data hooks mocked, so it
// verifies the UX end to end without a seller session: everything on one
// screen, validation gates submit, the physical options disclosure is
// progressive, and a valid product still submits.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const createMutate = vi.fn().mockResolvedValue({ id: 'p1' });
const uploadMutate = vi.fn().mockResolvedValue({ filePath: 'f', fileName: 'n', size: 1 });
const toastFn = vi.fn();

vi.mock('@/features/seller/hooks/useSellerProducts', () => ({
  useCreateProductMutation: () => ({ mutateAsync: createMutate }),
  useUploadDigitalProductMutation: () => ({ mutateAsync: uploadMutate }),
}));
vi.mock('@/features/seller/hooks/useSellerProfile', () => ({
  useSellerProfileQuery: () => ({ data: { id: 's1', city: 'Nairobi', latitude: -1.29, longitude: 36.82 } }),
}));
vi.mock('@/shared/hooks/use-toast', () => ({ useToast: () => ({ toast: toastFn }) }));

// Stub processImage so we don't depend on a real <canvas> in jsdom; keep the
// real validators + buildProductData so the test exercises actual gating.
vi.mock('../utils/addProductFormUtils', async (importActual) => {
  const actual = await importActual<typeof import('../utils/addProductFormUtils')>();
  return { ...actual, processImage: vi.fn().mockResolvedValue('data:image/jpeg;base64,AAAA') };
});

import { AddProductForm } from './AddProductForm';

describe('AddProductForm — single-screen redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  test('renders all essentials on one screen, one submit, no step wizard', () => {
    render(<AddProductForm onSuccess={() => {}} />);
    expect(screen.getByRole('tab', { name: /physical/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /launch product/i })).toBeInTheDocument();
    // The wizard chrome is gone.
    expect(screen.queryByText(/step 1 of 2/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });

  test('blocks submit and shows errors when required fields are empty', async () => {
    render(<AddProductForm onSuccess={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /launch product/i }));
    expect(await screen.findByText(/give your product a name/i)).toBeInTheDocument();
    expect(screen.getByText(/add at least one photo/i)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  test('physical production/import options are collapsed and expand on demand', () => {
    render(<AddProductForm onSuccess={() => {}} />);
    expect(screen.queryByText(/custom product/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /production or import time/i }));
    expect(screen.getByText(/custom product/i)).toBeInTheDocument();
    expect(screen.getByText(/imported \/ pre-order item/i)).toBeInTheDocument();
  });

  test('switching to Digital reveals the required upload and hides physical options', () => {
    render(<AddProductForm onSuccess={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /digital/i }));
    expect(screen.getByText(/upload digital content/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /production or import time/i })).not.toBeInTheDocument();
  });

  test('submits a valid physical product end to end', async () => {
    const onSuccess = vi.fn();
    const { container } = render(<AddProductForm onSuccess={onSuccess} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByAltText(/main photo/i);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Leather watch' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A nice watch.' } });

    fireEvent.click(screen.getByRole('button', { name: /launch product/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalled();
    const payload = createMutate.mock.calls[0][0];
    expect(payload).toMatchObject({ name: 'Leather watch', price: 500, product_type: 'physical' });
  });
});
