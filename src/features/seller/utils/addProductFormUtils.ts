export interface ServiceOptions {
  availability_days: string[];
  location_type: 'buyer_visits_seller' | 'seller_visits_buyer' | 'hybrid';
  price_type: 'hourly' | 'fixed';
  start_time: string;
  end_time: string;
}

export interface AddProductFormData {
  name: string;
  price: string;
  description: string;
  image: File | null;
  image_url: string;
  aesthetic: string;
  is_digital: boolean;
  digital_file: File | null;
  digital_file_name: string;
  digital_file_path: string;
  digital_file_size: number | null;
  product_type: 'physical' | 'digital' | 'service';
  service_options: ServiceOptions;
  is_custom_product: boolean;
  production_days: string;
  customization_prompt: string;
  is_imported_product: boolean;
  import_days: string;
  import_note: string;
}

export const formDataDefaults: AddProductFormData = {
  name: '',
  price: '',
  description: '',
  image: null,
  image_url: '',
  aesthetic: 'noir',
  is_digital: false,
  digital_file: null,
  digital_file_name: '',
  digital_file_path: '',
  digital_file_size: null,
  product_type: 'physical',
  is_custom_product: false,
  production_days: '1',
  customization_prompt: 'Tell the seller exactly what you want customized.',
  is_imported_product: false,
  import_days: '14',
  import_note: 'Imported item. Delivery starts after seller handoff.',
  service_options: {
    availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    location_type: 'buyer_visits_seller',
    price_type: 'fixed',
    start_time: '09:00',
    end_time: '17:00'
  }
};

export const MIN_PRICE = 50;
export const IMPORT_DAY_OPTIONS = [7, 14, 21, 30] as const;

export type FormErrors = Partial<Record<string, string>>;

export const hasServiceCoordinates = (
  profile?: { latitude?: number | null; longitude?: number | null } | null
): boolean => {
  const lat = profile?.latitude != null ? Number(profile.latitude) : null;
  const lng = profile?.longitude != null ? Number(profile.longitude) : null;
  return (
    lat !== null && lng !== null &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
};

/**
 * Step 1 (What you're selling): type, name, and a main photo. Service also
 * requires the seller to have pinned shop coordinates.
 */
export const validateStep1 = (
  formData: AddProductFormData,
  hasCoordinates: boolean,
  hasMainPhoto: boolean
): FormErrors => {
  const errors: FormErrors = {};
  if (!formData.name.trim()) errors.name = 'Give your product a name.';
  if (!formData.product_type) errors.product_type = 'Choose a product type.';
  if (formData.product_type === 'service' && !hasCoordinates) {
    errors.product_type = 'Pin your exact shop location in Settings to offer services.';
  }
  if (!hasMainPhoto) errors.image = 'Add at least one photo.';
  return errors;
};

/**
 * Step 2 (Details): price, type-specific options, and a description.
 * This is the final step, so it also gates submission.
 */
export const validateStep2 = (formData: AddProductFormData): FormErrors => {
  const errors: FormErrors = {};
  if (!formData.description.trim()) errors.description = 'Add a short description.';

  const price = parseFloat(formData.price || '0');
  if (!Number.isFinite(price) || price < MIN_PRICE) {
    errors.price = `Minimum price is KES ${MIN_PRICE}.`;
  }

  if (formData.product_type === 'physical' && formData.is_custom_product) {
    const days = Number.parseInt(formData.production_days, 10);
    if (!Number.isInteger(days) || days < 1 || days > 5) {
      errors.production_days = 'Select a production time from 1 to 5 days.';
    }
    if (!formData.customization_prompt.trim()) {
      errors.customization_prompt = 'Add the question buyers should answer.';
    }
  }

  if (formData.product_type === 'physical' && formData.is_imported_product) {
    const days = Number.parseInt(formData.import_days, 10);
    if (!IMPORT_DAY_OPTIONS.includes(days as (typeof IMPORT_DAY_OPTIONS)[number])) {
      errors.import_days = 'Select 7, 14, 21, or 30 days.';
    }
  }

  return errors;
};

export interface DigitalUploadResult {
  path: string;
  name: string;
  size: number | null;
}

/**
 * Builds the exact payload sent to createProduct. Type-specific fields are
 * nulled out for the types they don't apply to, matching the API contract.
 */
export const buildProductData = (
  formData: AddProductFormData,
  sellerId: string | number | undefined,
  images: string[],
  digital: DigitalUploadResult
) => {
  const isPhysical = formData.product_type === 'physical';
  return {
    name: formData.name,
    price: parseFloat(formData.price || '0'),
    description: formData.description,
    image_url: formData.image_url,
    images,
    aesthetic: formData.aesthetic,
    sellerId,
    is_digital: formData.product_type === 'digital',
    product_type: formData.product_type,
    is_custom_product: isPhysical ? formData.is_custom_product : false,
    production_days: isPhysical && formData.is_custom_product ? Number.parseInt(formData.production_days, 10) : null,
    customization_prompt: isPhysical && formData.is_custom_product ? formData.customization_prompt : null,
    is_imported_product: isPhysical ? formData.is_imported_product : false,
    import_days: isPhysical && formData.is_imported_product ? Number.parseInt(formData.import_days, 10) : null,
    import_note: isPhysical && formData.is_imported_product ? formData.import_note : null,
    digital_file_path: digital.path,
    digital_file_name: digital.name,
    digital_file_size: digital.size,
    service_options: formData.product_type === 'service' ? formData.service_options : undefined,
  };
};

export const processImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas error'));
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
