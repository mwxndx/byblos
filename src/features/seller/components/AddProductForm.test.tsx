import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AddProductForm from './AddProductForm';

const createMutate = vi.fn();
const uploadMutate = vi.fn();

vi.mock('@/features/seller/hooks/useSellerProducts', () => ({
  useCreateProductMutation: () => ({ mutateAsync: createMutate }),
  useUploadDigitalProductMutation: () => ({ mutateAsync: uploadMutate }),
}));

vi.mock('@/features/seller/hooks/useSellerProfile', () => ({
  useSellerProfileQuery: () => ({
    data: { id: 'seller-1', city: 'Nairobi', latitude: -1.2921, longitude: 36.8219 },
  }),
}));

vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../utils/addProductFormUtils', async (orig) => {
  const actual = await orig<typeof import('../utils/addProductFormUtils')>();
  return {
    ...actual,
    processImage: vi.fn(async () => 'data:image/jpeg;base64,mocked'),
  };
});

describe('AddProductForm — single-screen redesign with digital categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutate.mockResolvedValue({ id: 'p-1' });
    uploadMutate.mockResolvedValue({ filePath: '/files/test.zip', fileName: 'test.zip', size: 1024 });
  });

  test('renders all essentials on one screen, one submit, no step wizard', () => {
    render(<AddProductForm onSuccess={() => {}} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /product type/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /launch product/i })).toBeInTheDocument();
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

  test('switching to Digital reveals the format selector and upload section', () => {
    render(<AddProductForm onSuccess={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /digital/i }));
    expect(screen.getByRole('radiogroup', { name: /digital format/i })).toBeInTheDocument();
    expect(screen.getByText(/upload document file/i)).toBeInTheDocument();
    expect(screen.getByText('Max 60MB')).toBeInTheDocument();
    expect(screen.getByText(/supported formats for document/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /production or import time/i })).not.toBeInTheDocument();
  });

  test('switching digital format updates allowed file types and upload prompt', () => {
    render(<AddProductForm onSuccess={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /digital/i }));

    // Switch to Audio
    fireEvent.click(screen.getByRole('radio', { name: /audio/i }));
    expect(screen.getByText(/upload audio file/i)).toBeInTheDocument();
    expect(screen.getByText(/supported formats for audio/i)).toBeInTheDocument();

    // Switch to Video
    fireEvent.click(screen.getByRole('radio', { name: /video/i }));
    expect(screen.getByText(/upload video file/i)).toBeInTheDocument();
    expect(screen.getByText(/supported formats for video/i)).toBeInTheDocument();
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
