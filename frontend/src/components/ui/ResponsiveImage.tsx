import React from 'react';

interface ResponsiveImageProps {
  src: string; // Base path without extension (e.g., "/hero")
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

/**
 * Responsive image component that automatically uses WebP format
 * with fallback and responsive srcset for different screen sizes
 */
export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className = '',
  sizes = '100vw',
  priority = false,
  width,
  height,
}) => {
  // Generate srcset for different screen sizes
  const generateSrcSet = (basePath: string) => {
    return `${basePath}-480.webp 480w, ${basePath}-960.webp 960w, ${basePath}-1920.webp 1920w`;
  };

  return (
    <img
      src={`${src}.webp`}
      srcSet={generateSrcSet(src)}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      width={width}
      height={height}
      decoding="async"
    />
  );
};
