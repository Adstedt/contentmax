'use client';

export interface Label {
  id: string;
  name: string;
  color: string;
}

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
  labels?: Label[];
  assignedTo?: string;
  status?: 'available' | 'low_stock' | 'out_of_stock';
}

interface SimpleProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  isSelected?: boolean;
  onProductClick?: (product: Product) => void;
  onDetailsClick?: (product: Product) => void;
}

export default function SimpleProductCard({
  product,
  onSelect,
  isSelected = false,
  onProductClick,
  onDetailsClick,
}: SimpleProductCardProps) {
  // Mock labels for demonstration (will be real data later)
  const mockLabels: Label[] = product.labels || [
    { id: '1', name: 'Featured', color: '#10a37f' },
    { id: '2', name: 'New', color: '#3b82f6' },
  ];

  // Mock assignee for demonstration
  const mockAssignedTo = product.assignedTo || 'JD';

  // Status icon mapping
  const statusConfig = {
    available: { icon: '✓', text: 'In Stock', color: 'text-green-400' },
    low_stock: { icon: '⚠', text: 'Low Stock', color: 'text-yellow-400' },
    out_of_stock: { icon: '✗', text: 'Out of Stock', color: 'text-red-400' },
  };
  const currentStatus = statusConfig[product.status || 'available'];

  return (
    <div
      className={`
        relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]
        rounded-lg p-3 flex gap-3
        border transition-all duration-200 cursor-pointer
        hover:shadow-lg hover:border-blue-500/50
        ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-[#2a2a2a]'}
      `}
      onClick={() => {
        onSelect?.(product);
        onProductClick?.(product);
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select ${product.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(product);
          onProductClick?.(product);
        }
      }}
    >
      {/* Three-dot menu - Top Right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Open menu dropdown
        }}
        className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
        aria-label="More actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Product Image - Compact Thumbnail */}
      <div className="w-[80px] h-[80px] flex-shrink-0 rounded overflow-hidden bg-white p-2 flex items-center justify-center">
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
                  '<div class="text-gray-400 text-xs">No image</div>';
              }
            }}
          />
        ) : (
          <div className="text-gray-400 text-xs">No image</div>
        )}
      </div>

      {/* Product Info - Jira-style dense layout */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Title */}
        <h3 className="text-[15px] font-semibold text-white truncate leading-tight pr-8">
          {product.title}
        </h3>

        {/* Labels Row */}
        {mockLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mockLabels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 text-[11px] font-medium rounded"
                style={{
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                }}
              >
                {label.name}
              </span>
            ))}
            {mockLabels.length > 3 && (
              <span className="px-2 py-0.5 text-[11px] text-gray-500">
                +{mockLabels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Price, Brand, and Avatar */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {product.price !== null && (
              <span className="font-bold text-[#10a37f]">${product.price.toFixed(2)}</span>
            )}
            {product.brand && (
              <>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400 truncate">{product.brand}</span>
              </>
            )}
          </div>

          {/* Assignee Avatar */}
          <div
            className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0"
            title="Assigned to: JD"
          >
            {mockAssignedTo.substring(0, 2).toUpperCase()}
          </div>
        </div>

        {/* Bottom Row: ID, Status, Details */}
        <div className="flex items-center justify-between text-xs mt-auto pt-1">
          <div className="flex items-center gap-3">
            {/* ID */}
            <span className="text-gray-500">ID: {product.id.substring(0, 8)}</span>

            {/* Status */}
            <span className={`flex items-center gap-1 ${currentStatus.color}`}>
              <span>{currentStatus.icon}</span>
              <span>{currentStatus.text}</span>
            </span>
          </div>

          {/* Details Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDetailsClick?.(product);
            }}
            className="px-3 py-1 text-gray-400 hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
            aria-label={`View full details for ${product.title}`}
          >
            Details →
          </button>
        </div>
      </div>
    </div>
  );
}
