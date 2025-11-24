export interface PhotoSize {
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface PaperSize {
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface PhotoItem {
  id: string;
  imageUrl: string;
  size: PhotoSize;
  quantity: number;
  originalFile: File;
  backgroundColor?: string;
}

export interface LayoutItem {
  id: string;
  photoId: string;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface PageLayout {
  items: LayoutItem[];
  pageNumber: number;
  width: number;
  height: number;
}

export interface LayoutConfig {
  pageMargin: number;
  itemSpacing: number;
}