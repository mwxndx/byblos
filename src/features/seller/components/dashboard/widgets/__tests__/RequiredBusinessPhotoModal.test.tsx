import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RequiredBusinessPhotoModal } from '../RequiredBusinessPhotoModal';
import type { SellerProfile } from '../../../../../auth/types/authTypes';

const mockMutateAsync = vi.fn();
vi.mock('@/features/seller/hooks/useSellerProfile', () => ({
  useUploadBusinessPhotoMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const mockToast = vi.fn();
vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('RequiredBusinessPhotoModal', () => {
  const mockSellerProfile: SellerProfile = {
    id: 123,
    is_verified: true,
    fullName: 'Jane Doe',
    shopName: 'Jane Boutique',
    email: 'jane@example.com',
    phone: '+254700000000',
    whatsappNumber: '+254700000000',
    city: 'Nairobi',
    location: 'Westlands',
    bio: '',
    avatarUrl: undefined,
    totalSales: 0,
    netRevenue: 0,
    balance: 0,
    termsAccepted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const defaultProps = {
    open: true,
    sellerProfile: mockSellerProfile,
    onLogout: vi.fn(),
    onPhotoUploaded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, required message, and shop fallback initial when open', () => {
    render(<RequiredBusinessPhotoModal {...defaultProps} />);

    expect(screen.getByText('Business Profile Photo Required')).toBeInTheDocument();
    expect(
      screen.getByText(/all sellers on Byblos must have a business profile photo or shop logo/i)
    ).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument(); // 'J' for 'Jane Boutique'
    expect(screen.getByRole('button', { name: /save photo & enter dashboard/i })).toBeDisabled();
  });

  it('does not render dialog content when open is false', () => {
    render(<RequiredBusinessPhotoModal {...defaultProps} open={false} />);

    expect(screen.queryByText('Business Profile Photo Required')).not.toBeInTheDocument();
  });

  it('calls onLogout when clicking Sign Out button', () => {
    render(<RequiredBusinessPhotoModal {...defaultProps} />);

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it('validates file type and rejects non-image files', async () => {
    render(<RequiredBusinessPhotoModal {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const textFile = new File(['dummy'], 'document.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invalid File Type',
          variant: 'destructive',
        })
      );
    });

    expect(screen.getByRole('button', { name: /save photo & enter dashboard/i })).toBeDisabled();
  });

  it('validates file size and rejects images exceeding 5MB', async () => {
    render(<RequiredBusinessPhotoModal {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'File Too Large',
          variant: 'destructive',
        })
      );
    });

    expect(screen.getByRole('button', { name: /save photo & enter dashboard/i })).toBeDisabled();
  });

  it('uploads valid photo, invokes mutation, and calls onPhotoUploaded on save', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      status: 'success',
      avatarUrl: 'https://cdn.byblos.io/avatar.png',
    });

    render(<RequiredBusinessPhotoModal {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validImage = new File(['valid-image-bytes'], 'avatar.png', { type: 'image/png' });

    // Mock FileReader
    class MockFileReader {
      result: string = 'data:image/png;base64,sample-image';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    fireEvent.change(input, { target: { files: [validImage] } });

    const saveButton = await screen.findByRole('button', { name: /save photo & enter dashboard/i });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('data:image/png;base64,sample-image');
      expect(defaultProps.onPhotoUploaded).toHaveBeenCalledWith('https://cdn.byblos.io/avatar.png');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Profile Photo Set!',
        })
      );
    });
  });
});

