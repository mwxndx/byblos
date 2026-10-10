import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { aestheticCategories } from '@/shared/constants/aestheticCategories';
import { ProductEditPhysicalOptions } from './ProductEditPhysicalOptions';
import type { ProductEditFormData } from './ProductEditDialog';

interface ProductEditFormFieldsProps {
  formData: ProductEditFormData;
  onFormDataChange: (data: ProductEditFormData) => void;
}

export function ProductEditFormFields({
  formData,
  onFormDataChange,
}: ProductEditFormFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="edit-name" className="seller-label font-semibold">Product Name</Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(event) => onFormDataChange({ ...formData, name: event.target.value })}
          className="seller-field h-9 text-sm rounded-lg"
          placeholder="Enter product name"
        />
      </div>

      <div>
        <Label htmlFor="edit-price" className="seller-label font-semibold">Price (KES)</Label>
        <Input
          id="edit-price"
          type="number"
          min={50}
          value={formData.price}
          onChange={(event) => onFormDataChange({ ...formData, price: event.target.value })}
          className="seller-field h-9 text-sm rounded-lg"
          placeholder="0"
        />
      </div>

      <div>
        <Label htmlFor="edit-description" className="seller-label font-semibold">Description</Label>
        <Textarea
          id="edit-description"
          value={formData.description}
          onChange={(event) => onFormDataChange({ ...formData, description: event.target.value })}
          className="seller-field min-h-[60px] text-sm rounded-lg"
          placeholder="Enter product description"
        />
      </div>

      <div>
        <Label htmlFor="edit-aesthetic" className="seller-label font-semibold">Category</Label>
        <Select
          value={formData.aesthetic}
          onValueChange={(value) => onFormDataChange({ ...formData, aesthetic: value })}
        >
          <SelectTrigger className="seller-field h-9 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-surface-1 border-slate-200 dark:border-separator text-slate-900 dark:text-white z-[110]">
            {aestheticCategories.map((category) => (
              <SelectItem key={category.id} value={category.id} className="text-slate-900 dark:text-white focus:bg-[var(--theme-button-bg,#f5c518)] focus:text-[var(--theme-button-text,#000000)]">
                {category.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.product_type === 'physical' && (
        <ProductEditPhysicalOptions formData={formData} onFormDataChange={onFormDataChange} />
      )}
    </div>
  );
}
