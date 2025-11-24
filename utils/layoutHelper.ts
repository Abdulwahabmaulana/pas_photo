import { PhotoItem, LayoutItem, PageLayout, PaperSize, LayoutConfig } from '../types';

/**
 * Helper class to manage a single page's grid.
 */
class PageGrid {
  width: number;
  height: number;
  grid: boolean[];
  items: LayoutItem[];
  pageNumber: number;
  margin: number;
  spacing: number;

  constructor(width: number, height: number, pageNumber: number, margin: number, spacing: number) {
    this.width = width;
    this.height = height;
    this.pageNumber = pageNumber;
    this.margin = margin;
    this.spacing = spacing;
    this.items = [];
    this.grid = new Array(width * height).fill(false);
  }

  isRegionFree(x: number, y: number, w: number, h: number): boolean {
    if (x + w > this.width || y + h > this.height) return false;

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const index = (y + dy) * this.width + (x + dx);
        if (this.grid[index]) return false;
      }
    }
    return true;
  }

  markRegion(x: number, y: number, w: number, h: number) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const index = (y + dy) * this.width + (x + dx);
        this.grid[index] = true;
      }
    }
  }

  addItem(
    photoId: string, 
    imageUrl: string, 
    itemW: number, 
    itemH: number, 
    globalIndex: number,
    bgColor?: string
  ): boolean {
    const occupyW = itemW + this.spacing;
    const occupyH = itemH + this.spacing;

    for (let y = 0; y <= this.height - itemH; y++) {
      for (let x = 0; x <= this.width - itemW; x++) {
        if (this.isRegionFree(x, y, itemW, itemH)) {
          this.items.push({
            id: `${photoId}-${globalIndex}`,
            photoId,
            imageUrl,
            x: x + this.margin,
            y: y + this.margin,
            width: itemW,
            height: itemH,
            backgroundColor: bgColor
          });

          const markW = Math.min(occupyW, this.width - x);
          const markH = Math.min(occupyH, this.height - y);
          
          this.markRegion(x, y, markW, markH);
          return true;
        }
      }
    }
    return false;
  }
}

export const calculateLayout = (
    photos: PhotoItem[], 
    paperSize: PaperSize,
    config: LayoutConfig
): PageLayout[] => {
  const { pageMargin, itemSpacing } = config;
  const printableWidth = paperSize.widthMm - (pageMargin * 2);
  const printableHeight = paperSize.heightMm - (pageMargin * 2);

  if (printableWidth <= 0 || printableHeight <= 0) return [];

  const pages: PageGrid[] = [];
  
  const getPage = (index: number): PageGrid => {
    if (!pages[index]) {
      pages[index] = new PageGrid(printableWidth, printableHeight, index + 1, pageMargin, itemSpacing);
    }
    return pages[index];
  };

  let globalIndex = 0;
  const todoList: { photoId: string; width: number; height: number; imageUrl: string; uniqueId: number; bgColor?: string }[] = [];
  
  photos.forEach(photo => {
    for (let i = 0; i < photo.quantity; i++) {
      todoList.push({
        photoId: photo.id,
        width: photo.size.widthMm,
        height: photo.size.heightMm,
        imageUrl: photo.imageUrl,
        uniqueId: globalIndex++,
        bgColor: photo.backgroundColor
      });
    }
  });
  
  todoList.forEach(item => {
    let placed = false;
    let pageIndex = 0;

    while (!placed) {
      const page = getPage(pageIndex);
      placed = page.addItem(item.photoId, item.imageUrl, item.width, item.height, item.uniqueId, item.bgColor);
      
      if (!placed) {
        pageIndex++;
      }
    }
  });

  return pages.map(p => ({
    items: p.items,
    pageNumber: p.pageNumber,
    width: paperSize.widthMm,
    height: paperSize.heightMm
  }));
};