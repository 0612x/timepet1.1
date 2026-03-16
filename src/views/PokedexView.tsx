import React, {useMemo} from 'react';
import {Cloud, Cpu, Lock, Palette, Waves} from 'lucide-react';
import {PETS, ThemeType} from '../data/pets';
import {useStore} from '../store/useStore';
import {cn} from '../utils/cn';
import {formatZhDate, getSimulatedDate} from '../utils/date';

export function PokedexView() {
  const {currentTheme, setCurrentTheme, unlockedPets, customPets, simulatedDateOffset} = useStore();

  const today = useMemo(() => formatZhDate(getSimulatedDate(simulatedDateOffset)), [simulatedDateOffset]);

  const filteredPets = PETS.filter(p => p.theme === currentTheme);

  const getThemeIcon = (t: ThemeType) => {
    switch (t) {
      case 'A': return <Cloud size={14} />;
      case 'B': return <Waves size={14} />;
      case 'C': return <Cpu size={14} />;
      case 'custom': return <Palette size={14} />;
    }
  };

  const getThemeName = (t: ThemeType) => {
    switch (t) {
      case 'A': return '云朵';
      case 'B': return '深海';
      case 'C': return '霓虹';
      case 'custom': return '手绘';
    }
  };

  const getThemeBackground = () => {
    switch (currentTheme) {
      case 'A': return 'bg-gradient-to-b from-[#e0f7fa] to-[#c8e6c9]';
      case 'B': return 'bg-[radial-gradient(circle,_#1a2a6c,_#112240,_#000000)]';
      case 'C': return 'bg-[#0a0a0a]';
      case 'custom': return 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-purple-50';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="p-5 pb-2 z-10">
        <div>
          <p className="text-xs font-medium text-slate-400">{today}</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">图鉴</h1>
        </div>
      </header>

      <div className="px-5 mb-4 z-10">
        <div className="flex p-1 rounded-2xl overflow-x-auto scroll-hide gap-1 bg-slate-200/50">
          {(['A', 'B', 'C', 'custom'] as ThemeType[]).map(t => (
            <button
              key={t}
              onClick={() => setCurrentTheme(t)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-black transition-all rounded-xl whitespace-nowrap uppercase tracking-widest",
                currentTheme === t 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {getThemeIcon(t)}
              {getThemeName(t)}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("flex-1 overflow-y-auto scroll-hide p-5 pt-2 pb-24", currentTheme !== 'custom' && currentTheme !== 'A' && "bg-slate-50")}>
        <div className="space-y-6">
          {currentTheme !== 'custom' ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredPets.map(pet => {
                const unlocked = unlockedPets[pet.id] || [];
                const hasBase = unlocked.includes('base');
                
                return (
                  <div key={pet.id} className={cn(
                    "glass-card rounded-[32px] p-5 flex flex-col space-y-4 border-white/40 transition-all", 
                    !hasBase && "opacity-60 grayscale"
                  )}>
                    <div className="flex justify-between items-center border-b border-slate-100/50 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No.{pet.id}</span>
                        <span className="font-black text-slate-800">{hasBase ? pet.name : '未知生物'}</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-2xl shadow-inner">
                        {hasBase ? pet.base : <Lock size={16} className="text-slate-300" />}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center p-2 rounded-2xl bg-white/30">
                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">专注</span>
                        <span className="text-xl">{unlocked.includes('focus') ? pet.focus : '？'}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-2xl bg-white/30">
                        <span className="text-[8px] font-black text-sky-500 uppercase tracking-widest mb-1">治愈</span>
                        <span className="text-xl">{unlocked.includes('heal') ? pet.heal : '？'}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-2xl bg-white/30">
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">活力</span>
                        <span className="text-xl">{unlocked.includes('active') ? pet.active : '？'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            customPets.length === 0 ? (
              <div className="p-12 text-center glass-card rounded-[32px] border-dashed border-slate-200">
                <Palette size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">还没有手绘宠物哦</p>
                <p className="text-[10px] text-slate-400 mt-1">快去孵化一个吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {customPets.map(pet => {
                  const unlocked = unlockedPets[pet.id] || [];
                  const state = unlocked.find(s => s !== 'base') || 'base';
                  
                  return (
                    <div key={pet.id} className="glass-card rounded-[32px] p-4 flex flex-col items-center border-white/40 group transition-all hover:scale-[1.02]">
                      <div className="w-full flex justify-between items-center mb-3">
                        <span className="font-black text-slate-800 text-[10px] truncate max-w-[60%]">{pet.name}</span>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 uppercase tracking-tighter">
                          {state === 'focus' ? '专注' : state === 'heal' ? '治愈' : state === 'active' ? '活力' : '基础'}
                        </span>
                      </div>
                      <div className="w-full aspect-square bg-white/50 rounded-2xl flex items-center justify-center p-3 border border-white/50 shadow-inner overflow-hidden">
                        <img src={pet.image} alt={pet.name} className="max-w-full max-h-full object-contain drop-shadow-md" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
