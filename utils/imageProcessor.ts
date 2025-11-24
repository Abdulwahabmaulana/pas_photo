/**
 * Removes the background of an image by detecting the color at the corners
 * and making similar colors transparent.
 * 
 * @param imageSrc The source URL/DataURL of the image
 * @param tolerance Color matching tolerance (0-100), higher = more aggressive
 */
export const removeSimpleBackground = async (imageSrc: string, tolerance: number = 50): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const len = data.length;
      
      // Assume Top-Left pixel is the background color
      // This is a heuristic for standard passport photos which usually have uniform background
      const rBg = data[0];
      const gBg = data[1];
      const bBg = data[2];
      
      // Euclidean distance tolerance
      const isSimilar = (r: number, g: number, b: number) => {
          // Sqrt of (255^2 * 3) is ~441.
          // Tolerance 50 roughly maps to 10-15% variance.
          const dist = Math.sqrt((r - rBg)**2 + (g - gBg)**2 + (b - bBg)**2);
          return dist < tolerance;
      }

      // Simple color replacement (Magic Wand style applied globally)
      // We iterate all pixels. If a pixel is close to the background color, make it transparent.
      // Note: This might remove parts of the shirt if it matches the background exactly.
      for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          if (isSimilar(r, g, b)) {
              data[i+3] = 0; // Set Alpha to 0 (Transparent)
          }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => reject(e);
  });
};