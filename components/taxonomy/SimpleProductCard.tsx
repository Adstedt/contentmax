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
  const isInStock = product.availability === 'in stock';

  return (
    <div
      className={`
        relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] 
        rounded-xl p-4 h-[280px] flex flex-col
        border transition-all duration-300 cursor-pointer
        hover:shadow-xl hover:scale-[1.02] hover:border-blue-500/50
        ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-[#2a2a2a]'}
      `}
      onClick={() => {
        onSelect?.(product);
        onProductClick?.(product);
      }}
    >
      {/* Product Image */}
      {product.image_link && (
        <div className="h-32 mb-3 rounded-lg overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
          <img
            src={product.image_link}
            alt={product.title}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.innerHTML =
                  '<div class="text-gray-600 text-sm">No image</div>';
              }
            }}
          />
        </div>
      )}
      {!product.image_link && (
        <div className="h-32 mb-3 rounded-lg bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-gray-600 text-sm">No image</div>
        </div>
      )}

      {/* Product Info */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-sm font-medium text-white mb-1 line-clamp-2">{product.title}</h3>

        {product.brand && <p className="text-xs text-gray-500 mb-2">{product.brand}</p>}

        {/* Price and Availability */}
        <div className="mt-auto pt-2 border-t border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            {product.price !== null && (
              <span className="text-lg font-bold text-green-400">${product.price.toFixed(2)}</span>
            )}
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                isInStock ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
              }`}
            >
              {isInStock ? 'In Stock' : product.availability || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Product Badge */}
      <div className="absolute top-2 right-2">
        <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
          Product
        </span>
      </div>
    </div>
  );
}
