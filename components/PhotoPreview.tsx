import React from 'react';
import { PageLayout } from '../types';

interface PhotoPreviewProps {
  page: PageLayout;
  scale?: number;
}

export const PhotoPreview: React.FC<PhotoPreviewProps> = ({ page, scale = 1 }) => {
  const MM_TO_PX = 3.78 * scale;

  const widthPx = page.width * MM_TO_PX;
  const heightPx = page.height * MM_TO_PX;

  return (
    <div 
      className="bg-white shadow-lg relative transition-all duration-300 ease-in-out shrink-0"
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      }}
    >
      {/* Grid lines helper */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px]"></div>

      {page.items.map((item) => (
        <div
          key={item.id}
          className="absolute overflow-hidden border border-gray-200"
          style={{
            left: `${item.x * MM_TO_PX}px`,
            top: `${item.y * MM_TO_PX}px`,
            width: `${item.width * MM_TO_PX}px`,
            height: `${item.height * MM_TO_PX}px`,
            backgroundColor: item.backgroundColor || '#e5e7eb' // Default gray if no color
          }}
        >
            <img 
                src={item.imageUrl} 
                alt="passport" 
                className="w-full h-full object-cover relative z-10"
            />
            {/* Cut Guidelines */}
            <div className="absolute inset-0 border border-dashed border-gray-400 opacity-0 hover:opacity-50 transition-opacity z-20"></div>
        </div>
      ))}
      
      <div className="absolute bottom-2 right-4 text-xs text-gray-400 font-mono">
        Halaman {page.pageNumber} ({page.width}x{page.height}mm)
      </div>
    </div>
  );
};