'use client';

export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  image_link: string | null;
  brand: string | null;
  availability: string | null;
  link: string | null;
  gtin: string | null;
}

interface SimpleProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  isSelected?: boolean;
  onProductClick?: (product: Product) => void;
}

export default function SimpleProductCard({
  product,
  onSelect,
  isSelected = false,
  onProductClick,
}: SimpleProductCardProps) {
  return (
    <div
      className={`
        relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]
        rounded-lg p-3 flex items-center gap-3
        border transition-all duration-300 cursor-pointer
        hover:shadow-lg hover:scale-[1.02] hover:border-blue-500/50
        ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-[#2a2a2a]'}
      `}
      onClick={() => {
        onSelect?.(product);
        onProductClick?.(product);
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${product.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(product);
          onProductClick?.(product);
        }
      }}
    >
      {/* Product Image - Thumbnail */}
      <div className="w-[108px] h-[108px] flex-shrink-0 rounded-md overflow-hidden bg-white p-2 flex items-center justify-center border border-gray-200">
        {product.image_link ? (
          <img
            src={product.image_link}
            alt={product.title}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.innerHTML =
                  '<div class="text-gray-400 text-sm">No image</div>';
              }
            }}
          />
        ) : (
          <div className="text-gray-400 text-sm">No image</div>
        )}
      </div>

      {/* Product Info - Text-focused layout */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
        {/* Title - Single line */}
        <h3 className="text-base font-medium text-white truncate">{product.title}</h3>

        {/* Price and Brand in one line */}
        <div className="flex items-baseline gap-2">
          {product.price !== null && (
            <span className="text-lg font-bold text-green-400">${product.price.toFixed(2)}</span>
          )}
          {product.brand && <span className="text-sm text-gray-400 truncate">{product.brand}</span>}
        </div>
      </div>
    </div>
  );
}
