export interface ServiceOptions {
  availability_days: string[];
  location_type: 'buyer_visits_seller' | 'seller_visits_buyer' | 'hybrid';
  price_type: 'hourly' | 'fixed';
  start_time: string;
  end_time: string;
}

export type DigitalCategory = 'audio' | 'video' | 'document';

export interface DigitalCategorySpec {
  id: DigitalCategory;
  label: string;
  description: string;
  accept: string;
  extensions: readonly string[];
  example: string;
}

export const DIGITAL_CATEGORIES: readonly DigitalCategorySpec[] = [
  {
    id: 'audio',
    label: 'Audio',
    description: 'Music, beats, podcasts, audiobooks',
    accept: '.mp3,.wav,.m4a,.aac,.flac,.ogg,audio/*',
    extensions: ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'],
    example: 'MP3, WAV, AAC, M4A, FLAC, OGG',
  },
  {
    id: 'video',
    label: 'Video',
    description: 'Courses, tutorials, films, motion graphics',
    accept: '.mp4,.mov,.avi,.mkv,.webm,video/*',
    extensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    example: 'MP4, MOV, WEBM, MKV',
  },
  {
    id: 'document',
    label: 'Document',
    description: 'eBooks, PDF guides, templates, spreadsheets',
    accept: '.pdf,.epub,.mobi,.doc,.docx,.txt,.csv,.xlsx,.zip',
    extensions: ['.pdf', '.epub', '.mobi', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.zip'],
    example: 'PDF, EPUB, MOBI, DOCX, TXT, CSV, XLSX, ZIP',
  },
] as const;

export const getDigitalCategorySpec = (category?: DigitalCategory | null): DigitalCategorySpec => {
  return DIGITAL_CATEGORIES.find(c => c.id === category) || DIGITAL_CATEGORIES[2]; // default to document
};

export const isFileAllowedForCategory = (fileName: string, category: DigitalCategory): boolean => {
  const spec = getDigitalCategorySpec(category);
  const ext = '.' + (fileName.split('.').pop() || '').toLowerCase();
  return spec.extensions.includes(ext);
};

export interface AddProductFormData {
  name: string;
  price: string;
  description: string;
  image: File | null;
  image_url: string;
  aesthetic: string;
  is_digital: boolean;
  digital_category: DigitalCategory;
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
  digital_category: 'document',
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
 * Step 1 (Basics): product name, primary photo, and product type.
 * Gated by hasCoordinates for service products.
 */
export const validateStep1 = (
  formData: AddProductFormData,
  hasCoordinates: boolean,
  hasMainPhoto: boolean
): FormErrors => {
  const errors: FormErrors = {};
  if (!formData.name.trim()) errors.name = 'Give your product a name.';
  if (!formData.product_type) errors.product_type = 'Choose a product type.';
  if (formData.product_type === 'digital' && !formData.digital_category) {
    errors.digital_category = 'Select a format (Audio, Video, or Document).';
  }
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

  if (formData.product_type === 'digital') {
    if (!formData.digital_file && !formData.digital_file_path) {
      errors.digital_file = 'Upload a digital file.';
    } else if (formData.digital_file) {
      if (!isFileAllowedForCategory(formData.digital_file.name, formData.digital_category)) {
        const spec = getDigitalCategorySpec(formData.digital_category);
        errors.digital_file = `Invalid file format for ${spec.label}. Supported: ${spec.example}`;
      }
    }
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
  category?: DigitalCategory;
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
  const isDigital = formData.product_type === 'digital';
  return {
    name: formData.name,
    price: parseFloat(formData.price || '0'),
    description: formData.description,
    image_url: formData.image_url,
    images,
    aesthetic: formData.aesthetic,
    sellerId,
    is_digital: isDigital,
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
    digital_category: isDigital ? (formData.digital_category || digital.category || 'document') : null,
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
          if (height > MAX_HEIGHT) { width = Math.round((height * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
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
