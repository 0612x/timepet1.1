import React from 'react';
import { BarChart3, Bone, Book, Home, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';

export function BottomNav() {
  const { currentTab, setCurrentTab, enterHomeTab } = useStore();

  return (
    <nav className="absolute bottom-0 z-50 grid w-full grid-cols-5 rounded-t-[32px] border-t border-white/20 px-3 py-3 glass-card shadow-lg">
      <button
        onClick={enterHomeTab}
        className={cn(
          "flex flex-col items-center transition-colors",
          currentTab === 'home' ? "text-indigo-600" : "text-slate-400"
        )}
      >
        <Home size={24} strokeWidth={currentTab === 'home' ? 2.5 : 2} />
        <span className="text-[10px] mt-1 font-medium">首页</span>
      </button>

      <button
        onClick={() => setCurrentTab('feed')}
        className={cn(
          "flex flex-col items-center transition-colors",
          currentTab === 'feed' ? "text-indigo-600" : "text-slate-400"
        )}
      >
        <Bone size={24} strokeWidth={currentTab === 'feed' ? 2.5 : 2} />
        <span className="text-[10px] mt-1 font-medium">投喂</span>
      </button>

      <button
        onClick={() => setCurrentTab('scene')}
        className={cn(
          "flex flex-col items-center transition-colors",
          currentTab === 'scene' ? "text-indigo-600" : "text-slate-400"
        )}
      >
        <Sparkles size={24} strokeWidth={currentTab === 'scene' ? 2.5 : 2} />
        <span className="text-[10px] mt-1 font-medium">场景</span>
      </button>

      <button
        onClick={() => setCurrentTab('pokedex')}
        className={cn(
          "flex flex-col items-center transition-colors",
          currentTab === 'pokedex' ? "text-indigo-600" : "text-slate-400"
        )}
      >
        <Book size={24} strokeWidth={currentTab === 'pokedex' ? 2.5 : 2} />
        <span className="text-[10px] mt-1 font-medium">图鉴</span>
      </button>

      <button
        onClick={() => setCurrentTab('stats')}
        className={cn(
          "flex flex-col items-center transition-colors",
          currentTab === 'stats' ? "text-indigo-600" : "text-slate-400"
        )}
      >
        <BarChart3 size={24} strokeWidth={currentTab === 'stats' ? 2.5 : 2} />
        <span className="text-[10px] mt-1 font-medium">统计</span>
      </button>
    </nav>
  );
}
