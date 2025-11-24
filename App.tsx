import React, { useState, useRef, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Upload, Plus, Trash2, Download, Printer, Info, Image as ImageIcon, Settings2, AlertTriangle, Wand2, RefreshCcw } from 'lucide-react';
import { PhotoItem, PhotoSize, PageLayout, PaperSize } from './types';
import { PHOTO_SIZES, PAPER_SIZES, PAGE_MARGIN_MM, ITEM_SPACING_MM } from './constants';
import { calculateLayout } from './utils/layoutHelper';
import { PhotoPreview } from './components/PhotoPreview';
import { removeSimpleBackground } from './utils/imageProcessor';

const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'upload' | 'preview'>('upload');
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(PAPER_SIZES[0]);
  
  // Layout Config
  const [pageMargin, setPageMargin] = useState<number>(PAGE_MARGIN_MM);
  const [itemSpacing, setItemSpacing] = useState<number>(ITEM_SPACING_MM);

  // Upload State
  const [tempImage, setTempImage] = useState<{ file: File; originalUrl: string; displayUrl: string } | null>(null);
  const [selectedSize, setSelectedSize] = useState<PhotoSize>(PHOTO_SIZES[0]);
  const [quantity, setQuantity] = useState<number>(4);
  const [selectedColor, setSelectedColor] = useState<string>(''); // Empty = none
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate layout
  const pages: PageLayout[] = useMemo(() => 
    calculateLayout(photos, selectedPaper, { pageMargin, itemSpacing }), 
    [photos, selectedPaper, pageMargin, itemSpacing]
  );

  // Simulation for warning
  const simulatedPages: PageLayout[] = useMemo(() => {
    if (!tempImage) return pages;
    const simulatedPhoto: PhotoItem = {
        id: 'temp',
        imageUrl: tempImage.displayUrl,
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
      // displayUrl is what we show and print. originalUrl is for reset.
      setTempImage({ file, originalUrl: url, displayUrl: url });
      setIsRemovingBg(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!tempImage) return;
    setIsRemovingBg(true);
    try {
        // Use the CURRENT display url (so we can chain edits if needed, but usually we want from original)
        // Actually, better to always process from original to avoid degradation
        const newUrl = await removeSimpleBackground(tempImage.originalUrl, 45);
        setTempImage(prev => prev ? { ...prev, displayUrl: newUrl } : null);
    } catch (e) {
        console.error("Bg removal failed", e);
        alert("Gagal menghapus background.");
    } finally {
        setIsRemovingBg(false);
    }
  };

  const handleResetImage = () => {
      if (!tempImage) return;
      setTempImage(prev => prev ? { ...prev, displayUrl: prev.originalUrl } : null);
  };

  const addPhotoToBatch = () => {
    if (!tempImage) return;

    const newPhoto: PhotoItem = {
      id: Date.now().toString(),
      imageUrl: tempImage.displayUrl,
      size: selectedSize,
      quantity: quantity,
      originalFile: tempImage.file,
      backgroundColor: selectedColor
    };

    setPhotos(prev => [...prev, newPhoto]);
    
    setTempImage(null);
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
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              const scale = 10; 
              const w = item.width * scale;
              const h = item.height * scale;
              
              canvas.width = w;
              canvas.height = h;
              
              if (ctx) {
                 // 1. Fill background
                 if (item.backgroundColor) {
                   ctx.fillStyle = item.backgroundColor;
                   ctx.fillRect(0, 0, w, h);
                 }
                 
                 // 2. Calculate Center Crop (Object-Fit: Cover)
                 const imgRatio = img.width / img.height;
                 const targetRatio = item.width / item.height;
                 
                 let drawW, drawH, offsetX, offsetY;
                 
                 if (imgRatio > targetRatio) {
                    drawH = h;
                    drawW = h * imgRatio;
                    offsetX = (w - drawW) / 2;
                    offsetY = 0;
                 } else {
                    drawW = w;
                    drawH = w / imgRatio;
                    offsetX = 0;
                    offsetY = (h - drawH) / 2;
                 }
                 
                 ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
                 
                 const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                 doc.addImage(dataUrl, 'JPEG', item.x, item.y, item.width, item.height);
              }

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
      if (tempImage) {
        URL.revokeObjectURL(tempImage.originalUrl);
        if (tempImage.displayUrl !== tempImage.originalUrl) {
            URL.revokeObjectURL(tempImage.displayUrl);
        }
      }
    };
  }, []);

  const totalItems = pages.reduce((acc, page) => acc + page.items.length, 0);

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

          {/* Upload / Settings Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Upload size={18} className="text-blue-600" />
                {tempImage ? 'Pengaturan Foto' : 'Tambah Foto Baru'}
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
                  
                  {/* Preview + BG Tools */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-center relative overflow-hidden mb-3">
                        {/* Background Checkboard */}
                        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#808080_25%,transparent_25%,transparent_75%,#808080_75%,#808080),linear-gradient(45deg,#808080_25%,transparent_25%,transparent_75%,#808080_75%,#808080)] bg-[size:20px_20px] bg-[position:0_0,10px_10px]"></div>

                        <div 
                            className="relative shadow-md overflow-hidden transition-colors duration-300"
                            style={{ 
                                width: `${selectedSize.widthMm * 3}px`, 
                                height: `${selectedSize.heightMm * 3}px`,
                                backgroundColor: selectedColor || 'transparent'
                            }}
                        >
                            <img 
                                src={tempImage.displayUrl} 
                                alt="Preview" 
                                className={`w-full h-full object-cover relative z-10 transition-opacity duration-300 ${isRemovingBg ? 'opacity-50' : 'opacity-100'}`}
                            />
                            {isRemovingBg && (
                                <div className="absolute inset-0 flex items-center justify-center z-20">
                                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BG Action Buttons */}
                    <div className="flex items-center justify-between gap-2">
                         <button 
                           onClick={handleRemoveBackground}
                           disabled={isRemovingBg}
                           className="flex-1 py-1.5 px-2 bg-white border border-gray-200 shadow-sm rounded text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors flex items-center justify-center gap-1.5"
                           title="Otomatis menghapus warna latar belakang (misal: biru/merah) agar transparan."
                         >
                           <Wand2 size={12} /> Hapus Latar (Beta)
                         </button>
                         
                         {tempImage.displayUrl !== tempImage.originalUrl && (
                             <button 
                                onClick={handleResetImage}
                                className="py-1.5 px-2 bg-white border border-gray-200 shadow-sm rounded text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Reset ke foto asli"
                             >
                                <RefreshCcw size={12} />
                             </button>
                         )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                        Gunakan hapus latar jika foto Anda belum transparan.
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
                            disabled={isRemovingBg}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-300"
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