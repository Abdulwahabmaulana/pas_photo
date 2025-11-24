import { PhotoSize, PaperSize } from './types';

// Standard Indonesian Photo Sizes
export const PHOTO_SIZES: PhotoSize[] = [
  { label: '2x3 cm', widthMm: 20, heightMm: 30 }, 
  { label: '3x4 cm', widthMm: 30, heightMm: 40 }, 
  { label: '4x6 cm', widthMm: 40, heightMm: 60 }, 
  { label: '1x2 cm', widthMm: 15, heightMm: 20 }, 
  { label: 'Visa Kustom (3.5x4.5)', widthMm: 35, heightMm: 45 },
  { label: 'Kotak (5x5)', widthMm: 50, heightMm: 50 },
];

// Standard Paper Sizes
export const PAPER_SIZES: PaperSize[] = [
  { label: 'A4 (210 x 297 mm)', widthMm: 210, heightMm: 297 },
  { label: 'F4 / Folio (215 x 330 mm)', widthMm: 215, heightMm: 330 },
  { label: 'Letter (216 x 279 mm)', widthMm: 216, heightMm: 279 },
  { label: 'Legal (216 x 356 mm)', widthMm: 216, heightMm: 356 },
  { label: '4R (102 x 152 mm)', widthMm: 102, heightMm: 152 },
];

export const PAGE_MARGIN_MM = 5;
export const ITEM_SPACING_MM = 2; // Space for cutting