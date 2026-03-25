import React, { useState, useEffect, useRef } from 'react';
import UTIF from 'utif';
import TGA from 'tga-js';
import { FileWarning, ImageIcon, Loader2, EyeOff } from 'lucide-react';
import { Badge } from './Badge';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onError?: (e: any) => void;
}

const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  onError
}) => {
  const [format, setFormat] = useState<string>('');
  const [displayUrl, setDisplayUrl] = useState<string>(src);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Detect format from URL/Key
    const extension = src.split('?')[0].split('.').pop()?.toLowerCase() || '';
    setFormat(extension);
    
    // For native formats, just use the src
    // BMP is natively supported by most modern browsers
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extension)) {
      setDisplayUrl(src);
      setIsLoading(false);
      return;
    }

    // For TIFF, we need to decode it
    if (['tif', 'tiff'].includes(extension)) {
      handleTiff(src);
    } 
    // For TGA, we use tga-js
    else if (['tga'].includes(extension)) {
      handleTga(src);
    }
    else {
      // For EXR, HDR etc, we can't easily preview natively without a heavy lib
      setIsLoading(false);
    }
  }, [src]);

  const handleTga = async (url: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      const tga = new (TGA as any)();
      tga.load(new Uint8Array(arrayBuffer));
      const canvas = tga.getCanvas();
      setDisplayUrl(canvas.toDataURL('image/png'));
      setIsLoading(false);
    } catch (error) {
      console.error('TGA decode error:', error);
      setIsError(true);
      setIsLoading(false);
    }
  };

  const handleTiff = async (url: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const ifds = UTIF.decode(arrayBuffer);
      UTIF.decodeImage(arrayBuffer, ifds[0]);
      const rgba = UTIF.toRGBA8(ifds[0]);
      
      const width = ifds[0].width;
      const height = ifds[0].height;
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
        
        const blobUrl = canvas.toDataURL('image/png');
        setDisplayUrl(blobUrl);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('TIFF decode error:', error);
      setIsError(true);
      setIsLoading(false);
    }
  };

  const isNative = ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(format);
  const isVfxFormat = ['exr', 'hdr'].includes(format); // TGA removed as it's now decodable
  const isTiff = ['tif', 'tiff'].includes(format);
  const isTga = format === 'tga';

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-900/50 ${className}`}>
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (isVfxFormat) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] to-black text-center p-4 gap-3 border border-white/5 rounded-lg ${className}`}>
        <div className="relative">
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <EyeOff className="w-6 h-6 text-blue-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{format}</p>
          <p className="text-[9px] text-gray-500 font-medium leading-tight">High Dynamic Range<br/>VFX Data Format</p>
        </div>
        <a 
          href={src} 
          download 
          className="mt-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold text-gray-300 transition-all flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-1 h-1 rounded-full bg-blue-400" />
          Download Source
        </a>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-900 text-center p-4 ${className}`}>
        <FileWarning className="w-6 h-6 text-amber-500 mb-2" />
        <p className="text-[10px] text-gray-400">Failed to load preview</p>
      </div>
    );
  }

  return (
    <img
      src={displayUrl}
      alt={alt}
      className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      loading={loading}
      onError={(e) => {
        setIsError(true);
        if (onError) onError(e);
      }}
    />
  );
};

export default SmartImage;
