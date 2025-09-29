'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

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

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductDetailModal({ product, isOpen, onClose }: ProductDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [specsOpen, setSpecsOpen] = useState(true);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      const handleTabTrap = (e: KeyboardEvent) => {
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleTabTrap);
      document.body.style.overflow = 'hidden';

      // Focus the modal
      modalRef.current?.focus();

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleTabTrap);
        document.body.style.overflow = 'unset';

        // Restore focus to triggering element
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const isInStock = product.availability === 'in stock';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg w-full max-w-6xl h-[85vh] flex flex-col focus:outline-none"
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-4">
            {/* Product Image - Compact Thumbnail in Header (Clickable) */}
            <button
              onClick={() => product.image_link && setImageModalOpen(true)}
              className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-white p-1.5 flex items-center justify-center border border-gray-200 hover:border-[#10a37f] transition-colors cursor-pointer"
              disabled={!product.image_link}
              aria-label="View product image"
            >
              {product.image_link ? (
                <img
                  src={product.image_link}
                  alt={product.title}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `
                        <div class="text-center">
                          <svg class="w-8 h-8 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <svg
                  className="w-8 h-8 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>

            <div>
              <h2 id="modal-title" className="text-2xl font-bold text-white">
                {product.title}
              </h2>
              {product.id && (
                <p className="text-sm text-[#999] mt-1">
                  ID: {product.id}
                  {product.gtin && ` • GTIN: ${product.gtin}`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#666] hover:text-white transition-colors duration-200 rounded-lg hover:bg-[#1a1a1a]"
            aria-label="Close product details"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Modal Content - Jira-Style Layout with Independent Scrolling */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
          {/* Main Content Column - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Product Description - Always Visible */}
            <div>
              <h3 className="text-sm font-semibold text-[#666] uppercase tracking-wider mb-2">
                Description
              </h3>
              {product.description ? (
                <p className="text-[#ccc] leading-relaxed text-sm whitespace-pre-wrap">
                  {product.description}
                </p>
              ) : (
                <p className="text-[#666] italic text-sm">No description available</p>
              )}
            </div>

            {/* Metrics Accordion */}
            <div className="border-t border-[#1a1a1a] pt-4">
              <button
                onClick={() => setMetricsOpen(!metricsOpen)}
                className="w-full flex items-center justify-between text-white hover:text-[#10a37f] transition-colors"
              >
                <h3 className="text-sm font-semibold text-[#666] uppercase tracking-wider">
                  Metrics
                </h3>
                {metricsOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#666]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#666]" />
                )}
              </button>
              {metricsOpen && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-start py-1.5">
                    <span className="text-xs text-[#666]">Product ID</span>
                    <span className="text-xs text-white font-mono">{product.id}</span>
                  </div>
                  {product.gtin && (
                    <div className="flex justify-between items-start py-1.5">
                      <span className="text-xs text-[#666]">GTIN</span>
                      <span className="text-xs text-white font-mono">{product.gtin}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start py-1.5">
                    <span className="text-xs text-[#666]">Price</span>
                    <span className="text-xs text-white">
                      {product.price !== null ? formatPrice(product.price) : 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Specifications Accordion */}
            <div className="border-t border-[#1a1a1a] pt-4">
              <button
                onClick={() => setSpecsOpen(!specsOpen)}
                className="w-full flex items-center justify-between text-white hover:text-[#10a37f] transition-colors"
              >
                <h3 className="text-sm font-semibold text-[#666] uppercase tracking-wider">
                  Specifications
                </h3>
                {specsOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#666]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#666]" />
                )}
              </button>
              {specsOpen && (
                <div className="mt-3 space-y-2">
                  {product.brand && (
                    <div className="flex justify-between items-start py-1.5">
                      <span className="text-xs text-[#666]">Brand</span>
                      <span className="text-xs text-white">{product.brand}</span>
                    </div>
                  )}
                  {product.availability && (
                    <div className="flex justify-between items-start py-1.5">
                      <span className="text-xs text-[#666]">Availability</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isInStock
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}
                      >
                        {product.availability}
                      </span>
                    </div>
                  )}
                  {product.gtin && (
                    <div className="flex justify-between items-start py-1.5">
                      <span className="text-xs text-[#666]">GTIN/EAN</span>
                      <span className="text-xs text-white font-mono">{product.gtin}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Details Panel (Fixed, Non-Scrolling) */}
          <div className="lg:w-96 flex-shrink-0 overflow-y-auto px-6 py-6 space-y-4 border-t lg:border-t-0 lg:border-l border-[#1a1a1a]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#666] uppercase tracking-wider">
                Details
              </h3>
            </div>

            {/* All Details Fields - Always Visible */}
            <div className="space-y-4">
              {/* Price */}
              <div>
                <div className="text-xs text-[#666] mb-1.5">Price</div>
                {product.price !== null ? (
                  <div className="text-2xl font-bold text-[#10a37f]">
                    {formatPrice(product.price)}
                  </div>
                ) : (
                  <div className="text-sm text-[#666]">Not available</div>
                )}
              </div>

              {/* Status */}
              <div>
                <div className="text-xs text-[#666] mb-1.5">Status</div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                    isInStock
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}
                >
                  {isInStock ? '✓ In Stock' : product.availability || 'Unknown'}
                </span>
              </div>

              {/* Brand */}
              <div>
                <div className="text-xs text-[#666] mb-1.5">Brand</div>
                <div className="text-sm text-white">{product.brand || 'Not specified'}</div>
              </div>

              {/* Product ID */}
              <div>
                <div className="text-xs text-[#666] mb-1.5">Product ID</div>
                <div className="text-sm text-white font-mono">{product.id}</div>
              </div>

              {/* GTIN */}
              {product.gtin && (
                <div>
                  <div className="text-xs text-[#666] mb-1.5">GTIN/EAN</div>
                  <div className="text-sm text-white font-mono">{product.gtin}</div>
                </div>
              )}

              {/* Availability */}
              <div>
                <div className="text-xs text-[#666] mb-1.5">Availability</div>
                <div className="text-sm text-white capitalize">
                  {product.availability || 'Unknown'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#1a1a1a] space-y-2">
              {product.link && (
                <a
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-3 py-2 bg-[#10a37f] text-white rounded-md text-xs font-medium hover:bg-[#0e906d] transition-colors duration-200"
                >
                  View Product
                  <svg
                    className="w-3 h-3 ml-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
              <button className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-md text-xs hover:bg-[#2a2a2a] transition-colors duration-200">
                Add to Analysis
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {imageModalOpen && product.image_link && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-8"
          onClick={() => setImageModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image preview"
        >
          <div className="relative max-w-4xl max-h-full">
            {/* Close Button */}
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-[#10a37f] transition-colors"
              aria-label="Close image preview"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* 1:1 Image Container */}
            <div
              className="aspect-square bg-white rounded-lg p-8 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={product.image_link}
                alt={product.title}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Image Title */}
            <div className="mt-4 text-center">
              <p className="text-white text-sm font-medium">{product.title}</p>
              {product.id && <p className="text-[#666] text-xs mt-1">ID: {product.id}</p>}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
