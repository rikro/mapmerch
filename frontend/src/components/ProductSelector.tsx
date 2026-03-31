import { ProductType, ProductOption } from '../types.js';

interface Props {
  options: ProductOption[];
  selectedProduct: ProductType;
  selectedSize: string;
  onProductChange: (product: ProductType) => void;
  onSizeChange: (size: string) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductSelector({
  options,
  selectedProduct,
  selectedSize,
  onProductChange,
  onSizeChange,
}: Props) {
  const currentProduct = options.find(o => o.type === selectedProduct)!;

  return (
    <div>
      {/* Product type tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {options.map(opt => (
          <button
            key={opt.type}
            onClick={() => {
              onProductChange(opt.type);
              onSizeChange(opt.sizes[0]); // reset to first size
            }}
            aria-pressed={selectedProduct === opt.type}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '2px solid #333',
              background: selectedProduct === opt.type ? '#333' : '#fff',
              color: selectedProduct === opt.type ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Size options */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {currentProduct.sizes.map(size => (
          <button
            key={size}
            onClick={() => onSizeChange(size)}
            aria-pressed={selectedSize === size}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '2px solid #555',
              background: selectedSize === size ? '#555' : '#fff',
              color: selectedSize === size ? '#fff' : '#555',
              cursor: 'pointer',
            }}
          >
            {size} — {formatCents(currentProduct.retailPriceCents[size])}
          </button>
        ))}
      </div>
    </div>
  );
}
