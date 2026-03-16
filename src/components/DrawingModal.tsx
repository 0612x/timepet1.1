import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Pen, Palette, Trash2, Check } from 'lucide-react';
import { cn } from '../utils/cn';

interface DrawingModalProps {
  onSave: (name: string, image: string) => void;
  onClose: () => void;
}

export function DrawingModal({ onSave, onClose }: DrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const isEmpty = !pixelData.some(channel => channel !== 0);
    if (isEmpty) {
      return;
    }

    const image = canvas.toDataURL('image/png');
    onSave(name.trim(), image);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="glass-card rounded-[40px] w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-pop border-white/40">
        <div className="p-6 pb-4 flex justify-between items-center">
          <h3 className="text-xl font-black tracking-tight">手绘专属宠物</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white/50 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 pt-0 flex-1 flex flex-col items-center overflow-y-auto scroll-hide">
          <div className="w-full mb-6">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">宠物名称</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="给它起个好听的名字..."
              className="w-full px-5 py-4 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50 font-bold"
              maxLength={10}
            />
          </div>

          <div className="w-full flex justify-between items-center mb-6 bg-white/30 p-3 rounded-2xl border border-white/50">
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEraser(false)}
                className={cn(
                  "p-2.5 rounded-xl transition-all",
                  !isEraser ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <Pen size={18} />
              </button>
              <button 
                onClick={() => setIsEraser(true)}
                className={cn(
                  "p-2.5 rounded-xl transition-all",
                  isEraser ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <Eraser size={18} />
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-200">
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => { setColor(e.target.value); setIsEraser(false); }}
                  className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer border-0 p-0"
                  disabled={isEraser}
                />
              </div>
              <input 
                type="range" 
                min="2" 
                max="30" 
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-24 accent-indigo-600"
              />
            </div>
            
            <button 
              onClick={clearCanvas}
              className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
              title="清空"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="w-full aspect-square border-2 border-white/50 rounded-[32px] overflow-hidden shadow-inner bg-white/40 relative touch-none group">
            {/* Checkerboard background pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'conic-gradient(#000 0.25turn, #fff 0.25turn 0.5turn, #000 0.5turn 0.75turn, #fff 0.75turn)', backgroundSize: '20px 20px' }} />
            
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchMove={draw}
              className="cursor-crosshair block w-full h-full relative z-10"
            />
          </div>
        </div>
        
        <div className="p-6 pt-0 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 font-black rounded-2xl text-slate-500 bg-white/50 border border-white/50 hover:bg-white transition-all active:scale-95 uppercase tracking-widest text-[10px]"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-4 font-black rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
          >
            <Check size={16} />
            确认孵化
          </button>
        </div>
      </div>
    </div>
  );
}
