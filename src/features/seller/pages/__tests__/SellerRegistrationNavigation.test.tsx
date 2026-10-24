import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SellerRegistration from '../SellerRegistration';
import { SellerRegistrationSteps } from '../../components/SellerRegistrationSteps';
import * as sellerRegHook from '../../hooks/useSellerRegistration';
import type { SellerRegistrationFormData } from '../../utils/sellerRegistrationUtils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe('SellerRegistration Navigation & Back Logic', () => {
  const defaultHookState = {
    formData: {
      firstName: '',
      lastName: '',
      shopName: '',
      email: '',
      whatsappNumber: '',
      password: '',
      confirmPassword: '',
      city: 'Nairobi',
      location: '',
      physicalAddress: '',
      latitude: undefined,
      longitude: undefined,
    },
    setFormData: vi.fn(),
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    isCheckingShopName: false,
    shopNameAvailable: true,
    passwordError: '',
    showPassword: false,
    setShowPassword: vi.fn(),
    showConfirmPassword: false,
    setShowConfirmPassword: vi.fn(),
    currentStep: 1,
    setCurrentStep: vi.fn(),
    hasPhysicalShop: null as boolean | null,
    setHasPhysicalShop: vi.fn(),
    isRegistered: false,
    termsAccepted: false,
    setTermsAccepted: vi.fn(),
    isTermsModalOpen: false,
    setIsTermsModalOpen: vi.fn(),
    resendCooldown: 0,
    isResending: false,
    handleResend: vi.fn(),
    isExistingUser: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Step 1: Header Back button navigates to home (/)', () => {
    vi.spyOn(sellerRegHook, 'useSellerRegistration').mockReturnValue({
      ...defaultHookState,
      currentStep: 1,
    });

    render(
      <MemoryRouter>
        <SellerRegistration />
      </MemoryRouter>
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('Step 3 with physical shop: Bottom Back button resets physical shop choice instead of navigating to Step 2', () => {
    const setHasPhysicalShop = vi.fn();
    const setFormData = vi.fn();
    const setCurrentStep = vi.fn();

    vi.spyOn(sellerRegHook, 'useSellerRegistration').mockReturnValue({
      ...defaultHookState,
      currentStep: 3,
      hasPhysicalShop: true,
      setHasPhysicalShop,
      setFormData,
      setCurrentStep,
    });

    render(
      <MemoryRouter>
        <SellerRegistration />
      </MemoryRouter>
    );

    const backButtons = screen.getAllByRole('button', { name: /back/i });
    // The bottom back button is the second back button
    const bottomBackButton = backButtons[1];
    fireEvent.click(bottomBackButton);

    expect(setHasPhysicalShop).toHaveBeenCalledWith(null);
    expect(setFormData).toHaveBeenCalled();
    const updater = setFormData.mock.calls[0][0];
    const updated = updater({ physicalAddress: 'Shop 10', latitude: -1.28, longitude: 36.82 });
    expect(updated.physicalAddress).toBe('');
    expect(updated.latitude).toBeUndefined();
    expect(updated.longitude).toBeUndefined();

    expect(setCurrentStep).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('Step 3 with physical shop: Header Back button also resets physical shop choice without navigating to /', () => {
    const setHasPhysicalShop = vi.fn();
    const setFormData = vi.fn();
    const setCurrentStep = vi.fn();

    vi.spyOn(sellerRegHook, 'useSellerRegistration').mockReturnValue({
      ...defaultHookState,
      currentStep: 3,
      hasPhysicalShop: true,
      setHasPhysicalShop,
      setFormData,
      setCurrentStep,
    });

    render(
      <MemoryRouter>
        <SellerRegistration />
      </MemoryRouter>
    );

    const headerBackButton = screen.getAllByRole('button', { name: /back/i })[0];
    fireEvent.click(headerBackButton);

    expect(setHasPhysicalShop).toHaveBeenCalledWith(null);
    expect(setFormData).toHaveBeenCalled();
    expect(setCurrentStep).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('Step 4: Back button resets physical shop choice and navigates to Step 3', () => {
    const setHasPhysicalShop = vi.fn();
    const setFormData = vi.fn();
    const setCurrentStep = vi.fn();

    vi.spyOn(sellerRegHook, 'useSellerRegistration').mockReturnValue({
      ...defaultHookState,
      currentStep: 4,
      hasPhysicalShop: true,
      setHasPhysicalShop,
      setFormData,
      setCurrentStep,
    });

    render(
      <MemoryRouter>
        <SellerRegistration />
      </MemoryRouter>
    );

    const backButtons = screen.getAllByRole('button', { name: /back/i });
    const bottomBackButton = backButtons[1];
    fireEvent.click(bottomBackButton);

    expect(setCurrentStep).toHaveBeenCalledWith(3);
    expect(setHasPhysicalShop).toHaveBeenCalledWith(null);
    expect(setFormData).toHaveBeenCalled();
  });

  test('Step 3 without choice made (hasPhysicalShop is null): Next button is not rendered', () => {
    vi.spyOn(sellerRegHook, 'useSellerRegistration').mockReturnValue({
      ...defaultHookState,
      currentStep: 3,
      hasPhysicalShop: null,
    });

    render(
      <MemoryRouter>
        <SellerRegistration />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
  });

  test('Step 3 without choice made (hasPhysicalShop is null): Back button navigates back to Step 2', () => {
    const setCurrentStep = vi.fn();

    vi.spyOn(sellerRegHook, 'useSellerRegistration').mockReturnValue({
      ...defaultHookState,
      currentStep: 3,
      hasPhysicalShop: null,
      setCurrentStep,
    });

    render(
      <MemoryRouter>
        <SellerRegistration />
      </MemoryRouter>
    );

    const backButtons = screen.getAllByRole('button', { name: /back/i });
    const bottomBackButton = backButtons[1];
    fireEvent.click(bottomBackButton);

    expect(setCurrentStep).toHaveBeenCalledWith(2);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('SellerRegistrationSteps — Step 3 Shop Type Switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('does NOT render "Change shop type" button when physical shop is active', () => {
    const setHasPhysicalShop = vi.fn();
    const setFormData = vi.fn();

    const testFormData: SellerRegistrationFormData = {
      firstName: 'John',
      lastName: 'Doe',
      shopName: 'JohnShop',
      email: 'john@example.com',
      whatsappNumber: '',
      password: '',
      confirmPassword: '',
      city: 'Nairobi',
      location: 'CBD',
      physicalAddress: 'Shop 12, Tom Mboya Street',
      latitude: -1.285,
      longitude: 36.824,
    };

    render(
      <SellerRegistrationSteps
        currentStep={3}
        formData={testFormData}
        handleInputChange={vi.fn()}
        setFormData={setFormData}
        shopNameAvailable={true}
        isCheckingShopName={false}
        showPassword={false}
        setShowPassword={vi.fn()}
        showConfirmPassword={false}
        setShowConfirmPassword={vi.fn()}
        passwordError=""
        hasPhysicalShop={true}
        setHasPhysicalShop={setHasPhysicalShop}
        setCurrentStep={vi.fn()}
        termsAccepted={false}
        setTermsAccepted={vi.fn()}
        setIsTermsModalOpen={vi.fn()}
        isExistingUser={false}
      />
    );

    const changeBtn = screen.queryByRole('button', { name: /change shop type/i });
    expect(changeBtn).toBeNull();
  });

  test('Step 1 renders shop url preview with byblosafrica.site domain', () => {
    const testFormData: SellerRegistrationFormData = {
      firstName: '',
      lastName: '',
      shopName: 'CoolApparel',
      email: '',
      whatsappNumber: '',
      password: '',
      confirmPassword: '',
      city: 'Nairobi',
      location: '',
      physicalAddress: '',
      latitude: undefined,
      longitude: undefined,
    };

    render(
      <SellerRegistrationSteps
        currentStep={1}
        formData={testFormData}
        handleInputChange={vi.fn()}
        setFormData={vi.fn()}
        shopNameAvailable={true}
        isCheckingShopName={false}
        showPassword={false}
        setShowPassword={vi.fn()}
        showConfirmPassword={false}
        setShowConfirmPassword={vi.fn()}
        passwordError=""
        hasPhysicalShop={null}
        setHasPhysicalShop={vi.fn()}
        setCurrentStep={vi.fn()}
        termsAccepted={false}
        setTermsAccepted={vi.fn()}
        setIsTermsModalOpen={vi.fn()}
        isExistingUser={false}
      />
    );

    expect(screen.getByText('byblosafrica.site/coolapparel')).toBeInTheDocument();
  });

  test('Step 1 marks a linked account email as read-only', () => {
    const testFormData: SellerRegistrationFormData = {
      firstName: 'Jane',
      lastName: 'Doe',
      shopName: 'JaneShop',
      email: 'jane@example.com',
      whatsappNumber: '',
      password: '',
      confirmPassword: '',
      city: 'Nairobi',
      location: '',
      physicalAddress: '',
      latitude: undefined,
      longitude: undefined,
    };

    render(
      <SellerRegistrationSteps
        currentStep={1}
        formData={testFormData}
        handleInputChange={vi.fn()}
        setFormData={vi.fn()}
        shopNameAvailable={true}
        isCheckingShopName={false}
        showPassword={false}
        setShowPassword={vi.fn()}
        showConfirmPassword={false}
        setShowConfirmPassword={vi.fn()}
        passwordError=""
        hasPhysicalShop={null}
        setHasPhysicalShop={vi.fn()}
        setCurrentStep={vi.fn()}
        termsAccepted={false}
        setTermsAccepted={vi.fn()}
        setIsTermsModalOpen={vi.fn()}
        isExistingUser
      />
    );

    expect(screen.getByText('Linked to Byblos account')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toHaveAttribute('readonly');
  });
});
