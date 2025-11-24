import React, { useState, useRef, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Upload, Plus, Trash2, Download, Printer, Info, Image as ImageIcon, Settings2, AlertTriangle, Scissors, Move, ZoomIn } from 'lucide-react';
import { PhotoItem, PhotoSize, PageLayout, PaperSize } from './types';
import { PHOTO_SIZES, PAPER_SIZES, PAGE_MARGIN_MM, ITEM_SPACING_MM } from './constants';
import { calculateLayout } from './utils/layoutHelper';
import { PhotoPreview } from './components/PhotoPreview';

const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'upload' | 'preview'>('upload');
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(PAPER_SIZES[0]);
  
  // Layout Config
  const [pageMargin, setPageMargin] = useState<number>(PAGE_MARGIN_MM);
  const [itemSpacing, setItemSpacing] = useState<number>(ITEM_SPACING_MM);

  // Upload & Crop State
  const [tempImage, setTempImage] = useState<{ file: File; originalUrl: string } | null>(null);
  const [selectedSize, setSelectedSize] = useState<PhotoSize>(PHOTO_SIZES[0]);
  const [quantity, setQuantity] = useState<number>(4);
  const [selectedColor, setSelectedColor] = useState<string>(''); // Empty = none

  // Crop Editor State
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Calculate layout
  const pages: PageLayout[] = useMemo(() => 
    calculateLayout(photos, selectedPaper, { pageMargin, itemSpacing }), 
    [photos, selectedPaper, pageMargin, itemSpacing]
  );

  const simulatedPages: PageLayout[] = useMemo(() => {
    if (!tempImage) return pages;
    const simulatedPhoto: PhotoItem = {
        id: 'temp',
        imageUrl: tempImage.originalUrl, // Just use original for size calc
        size: selectedSize,
        quantity: quantity,
        originalFile: tempImage.file
    };
    return calculateLayout([...photos, simulatedPhoto], selectedPaper, { pageMargin, itemSpacing });
  }, [photos, selectedPaper, tempImage, selectedSize, quantity, pages, pageMargin, itemSpacing]);

  const willCreateNewPage = tempImage && simulatedPages.length > pages.length;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const url = URL.createObjectURL(file);
      setTempImage({ file, originalUrl: url });
      // Reset crop
      setCropZoom(1);
      setCropPos({ x: 0, y: 0 });
    }
  };

  // --- Crop Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCropPos({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const getCroppedImage = async (): Promise<string> => {
    if (!imgRef.current) return '';
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Output resolution (high quality)
    const scaleFactor = 10; // Higher for better print quality
    const targetWidth = selectedSize.widthMm * scaleFactor;
    const targetHeight = selectedSize.heightMm * scaleFactor;
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    if (ctx) {
        // Clear with white or selected background
        if (selectedColor) {
            ctx.fillStyle = selectedColor;
            ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        const img = imgRef.current;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const targetRatio = targetWidth / targetHeight;
        
        let drawWidth, drawHeight;
        
        // Calculate "Cover" dimensions
        if (imgRatio > targetRatio) {
            drawHeight = targetHeight;
            drawWidth = drawHeight * imgRatio;
        } else {
            drawWidth = targetWidth;
            drawHeight = drawWidth / imgRatio;
        }
        
        // Apply Zoom
        drawWidth *= cropZoom;
        drawHeight *= cropZoom;
        
        // Apply Pan
        // We need to map the visual pixel movement to the canvas resolution
        // Visual Box Height is approx 240px. Canvas Height is targetHeight.
        // Scale factor = targetHeight / 240.
        const visualScale = targetHeight / 240;
        
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.translate(cropPos.x * visualScale, cropPos.y * visualScale);
        
        ctx.drawImage(
            img, 
            -drawWidth / 2, 
            -drawHeight / 2, 
            drawWidth, 
            drawHeight
        );
    }
    
    return canvas.toDataURL('image/png');
  };
  // --- End Crop Logic ---

  const addPhotoToBatch = async () => {
    if (!tempImage) return;

    const croppedUrl = await getCroppedImage();

    const newPhoto: PhotoItem = {
      id: Date.now().toString(),
      imageUrl: croppedUrl,
      size: selectedSize,
      quantity: quantity,
      originalFile: tempImage.file,
      backgroundColor: selectedColor
    };

    setPhotos(prev => [...prev, newPhoto]);
    
    setTempImage(null);
    setCropZoom(1);
    setCropPos({x:0, y:0});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const generatePDF = async () => {
    setIsProcessing(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [selectedPaper.widthMm, selectedPaper.heightMm]
      });

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage([selectedPaper.widthMm, selectedPaper.heightMm]);
        
        const page = pages[i];
        
        const promises = page.items.map(async (item) => {
          return new Promise<void>((resolve) => {
            const img = new Image();
            img.src = item.imageUrl;
            img.crossOrigin = "Anonymous";
            
            img.onload = () => {
              // If background color exists, draw rect first
              if (item.backgroundColor) {
                doc.setFillColor(item.backgroundColor);
                doc.rect(item.x, item.y, item.width, item.height, 'F');
              }

              doc.addImage(img, 'PNG', item.x, item.y, item.width, item.height);
              
              // Border line
              doc.setDrawColor(200, 200, 200);
              doc.setLineWidth(0.1);
              doc.rect(item.x, item.y, item.width, item.height);
              
              resolve();
            };
            img.onerror = () => resolve();
          });
        });

        await Promise.all(promises);
      }

      doc.save(`pas-photo-${selectedPaper.label.split(' ')[0].toLowerCase()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF", error);
      alert("Gagal membuat PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.imageUrl));
      if (tempImage) URL.revokeObjectURL(tempImage.originalUrl);
    };
  }, []);

  const totalItems = pages.reduce((acc, page) => acc + page.items.length, 0);

  // Calculate preview box style for the cropper
  const previewAspectRatio = selectedSize.widthMm / selectedSize.heightMm;
  const PREVIEW_HEIGHT = 240;
  const previewWidth = PREVIEW_HEIGHT * previewAspectRatio;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Printer size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Studio Pas Foto</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">
              {photos.length} foto ({totalItems} cetakan)
            </span>
             <button
              onClick={() => {
                if (photos.length > 0) generatePDF();
              }}
              disabled={photos.length === 0 || isProcessing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                photos.length === 0 || isProcessing
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
              }`}
            >
              {isProcessing ? <span className="animate-pulse">Memproses...</span> : <><Download size={18} /><span>Unduh PDF</span></>}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Panel: Configuration */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 h-full overflow-y-auto pb-20">
          
          {/* Global Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
               <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Settings2 size={16} className="text-blue-600" />
                Pengaturan Halaman
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Ukuran Kertas</label>
                <select 
                    value={selectedPaper.label}
                    onChange={(e) => {
                        const paper = PAPER_SIZES.find(p => p.label === e.target.value);
                        if (paper) setSelectedPaper(paper);
                    }}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm"
                 >
                    {PAPER_SIZES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                 </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Margin ({pageMargin}mm)</label>
                    <input 
                        type="range" min="0" max="20" step="1"
                        value={pageMargin}
                        onChange={(e) => setPageMargin(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Spasi ({itemSpacing}mm)</label>
                    <input 
                        type="range" min="0" max="10" step="0.5"
                        value={itemSpacing}
                        onChange={(e) => setItemSpacing(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
              </div>
              
              {pages.length > 1 && (
                 <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2 text-xs text-yellow-800">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>Total: <b>{pages.length} halaman</b>.</span>
                 </div>
              )}
            </div>
          </div>

          {/* Upload / Edit Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                {tempImage ? <Scissors size={18} className="text-blue-600" /> : <Upload size={18} className="text-blue-600" />}
                {tempImage ? 'Edit & Potong Foto' : 'Tambah Foto Baru'}
              </h2>
            </div>
            
            <div className="p-5">
              {!tempImage ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ImageIcon size={24} />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Klik untuk unggah</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
              ) : (
                <div className="space-y-5">
                  
                  {/* Crop Area */}
                  <div className="flex flex-col items-center bg-gray-100 rounded-lg p-4 border border-gray-200">
                    <div 
                        className="relative overflow-hidden bg-white shadow-sm cursor-move select-none"
                        style={{ 
                            width: `${previewWidth}px`, 
                            height: `${PREVIEW_HEIGHT}px`,
                            backgroundColor: selectedColor || '#f3f4f6'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <img 
                            ref={imgRef}
                            src={tempImage.originalUrl} 
                            className="max-w-none absolute origin-center"
                            style={{
                                left: '50%',
                                top: '50%',
                                transform: `translate(-50%, -50%) translate(${cropPos.x}px, ${cropPos.y}px) scale(${cropZoom})`
                            }}
                            draggable={false}
                            alt="Crop Preview"
                        />
                        {/* Overlay Grid */}
                        <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none opacity-50">
                            <div className="w-full h-1/3 border-b border-blue-500/30"></div>
                            <div className="w-full h-1/3 border-b border-blue-500/30 top-1/3 absolute"></div>
                            <div className="h-full w-1/3 border-r border-blue-500/30 absolute top-0 left-0"></div>
                            <div className="h-full w-1/3 border-r border-blue-500/30 absolute top-0 left-1/3"></div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-4 w-full max-w-[240px]">
                        <ZoomIn size={16} className="text-gray-500" />
                        <input 
                            type="range" min="0.5" max="3" step="0.1"
                            value={cropZoom}
                            onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                            className="flex-1 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                        <Move size={10} /> Geser untuk mengatur posisi
                    </p>
                  </div>

                  {/* Settings */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Ukuran Foto</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PHOTO_SIZES.map(size => (
                          <button
                            key={size.label}
                            onClick={() => setSelectedSize(size)}
                            className={`px-2 py-2 text-xs border rounded-lg transition-all ${
                              selectedSize.label === size.label
                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                            }`}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Jumlah</label>
                            <div className="flex items-center gap-2">
                                <input
                                type="range" min="1" max="50"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value))}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <span className="w-8 text-center font-mono text-sm border rounded bg-gray-50">{quantity}</span>
                            </div>
                        </div>
                        
                        <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">Background</label>
                             <div className="flex gap-1">
                                <button 
                                    onClick={() => setSelectedColor('#db1514')} 
                                    className={`w-6 h-6 rounded-full bg-[#db1514] border-2 ${selectedColor === '#db1514' ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                    title="Merah"
                                />
                                <button 
                                    onClick={() => setSelectedColor('#0b56a3')} 
                                    className={`w-6 h-6 rounded-full bg-[#0b56a3] border-2 ${selectedColor === '#0b56a3' ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                    title="Biru"
                                />
                                <button 
                                    onClick={() => setSelectedColor('#ffffff')} 
                                    className={`w-6 h-6 rounded-full bg-white border-2 ${selectedColor === '#ffffff' ? 'border-gray-900 scale-110' : 'border-gray-200'}`}
                                    title="Putih"
                                />
                                <button 
                                    onClick={() => setSelectedColor('')} 
                                    className={`w-6 h-6 rounded-full bg-gray-100 border-2 flex items-center justify-center ${selectedColor === '' ? 'border-gray-900 scale-110' : 'border-gray-200'}`}
                                    title="Asli / Transparan"
                                >
                                    <div className="w-full h-[2px] bg-red-400 rotate-45"></div>
                                </button>
                             </div>
                        </div>
                    </div>
                    
                    {willCreateNewPage && (
                        <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg flex gap-2 text-xs text-orange-800">
                            <AlertTriangle size={14} className="shrink-0" />
                            <span>Halaman baru akan dibuat.</span>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                         <button 
                            onClick={() => setTempImage(null)}
                            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                          >
                            Batal
                          </button>
                        <button
                            onClick={addPhotoToBatch}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Masukan Foto
                        </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Added Photos List */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Daftar Foto</h3>
              {photos.map((photo) => (
                <div key={photo.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 group">
                  <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-200 relative">
                    {photo.backgroundColor && <div className="absolute inset-0" style={{ backgroundColor: photo.backgroundColor }}></div>}
                    <img src={photo.imageUrl} alt="Mini" className="w-full h-full object-cover relative z-10" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{photo.size.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {photo.quantity} lembar • {photo.size.widthMm}x{photo.size.heightMm}mm
                    </div>
                  </div>
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Live Preview */}
        <div className="w-full lg:w-2/3 flex flex-col h-full">
          <div className="lg:hidden flex border-b border-gray-200 mb-4 shrink-0">
            <button 
                className={`flex-1 py-2 font-medium text-sm ${selectedTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                onClick={() => setSelectedTab('upload')}
            >
                Pengaturan
            </button>
            <button 
                className={`flex-1 py-2 font-medium text-sm ${selectedTab === 'preview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                onClick={() => setSelectedTab('preview')}
            >
                Preview ({pages.length})
            </button>
          </div>

          <div className={`flex-1 bg-gray-100 rounded-2xl border border-gray-200 overflow-auto preview-scroll ${selectedTab === 'upload' ? 'hidden lg:block' : 'block'}`}>
            <div className="min-w-full w-fit mx-auto p-8 flex flex-col items-center gap-8 min-h-[500px]">
                {photos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-gray-300">
                    <ImageIcon size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Belum ada foto</h3>
                    <p className="text-gray-500 mt-2">Unggah foto untuk memulai.</p>
                </div>
                ) : (
                <>
                    <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 text-sm text-gray-500 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-sm border border-gray-200">
                    <Info size={14} />
                    <span>{pages.length} halaman • Margin {pageMargin}mm • Spasi {itemSpacing}mm</span>
                    </div>
                    {pages.map((page) => (
                    <div key={page.pageNumber} className="origin-top transform transition-transform hover:scale-[1.02] duration-300 shadow-xl">
                        <PhotoPreview page={page} scale={1} />
                    </div>
                    ))}
                </>
                )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;