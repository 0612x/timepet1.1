import React, {useMemo} from 'react';
import {Cloud, Cpu, Palette, Sparkles, Waves} from 'lucide-react';
import {PetScene} from '../components/PetScene';
import {cn} from '../utils/cn';
import {useStore} from '../store/useStore';
import type {ThemeType} from '../data/pets';
import {formatZhDate, getSimulatedDate} from '../utils/date';

export function SceneView() {
  const {currentTheme, setCurrentTheme, simulatedDateOffset, completedPets} = useStore();

  const today = useMemo(
    () => formatZhDate(getSimulatedDate(simulatedDateOffset)),
    [simulatedDateOffset],
  );

  const petsInTheme = completedPets.filter((pet) => pet.theme === currentTheme);

  const getThemeIcon = (theme: ThemeType) => {
    switch (theme) {
      case 'A':
        return <Cloud size={14} />;
      case 'B':
        return <Waves size={14} />;
      case 'C':
        return <Cpu size={14} />;
      case 'custom':
        return <Palette size={14} />;
    }
  };

  const getThemeName = (theme: ThemeType) => {
    switch (theme) {
      case 'A':
        return '云朵';
      case 'B':
        return '深海';
      case 'C':
        return '霓虹';
      case 'custom':
        return '手绘';
    }
  };

  const getThemeBackground = () => {
    switch (currentTheme) {
      case 'A':
        return 'bg-gradient-to-b from-[#e0f7fa] to-[#c8e6c9]';
      case 'B':
        return 'bg-[radial-gradient(circle,_#1a2a6c,_#112240,_#000000)]';
      case 'C':
        return 'bg-[#0a0a0a]';
      case 'custom':
        return 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-purple-50';
    }
  };

  const titleColor =
    currentTheme !== 'custom' && currentTheme !== 'A' ? 'text-white' : 'text-slate-800';
  const subTitleColor =
    currentTheme !== 'custom' && currentTheme !== 'A' ? 'text-white/70' : 'text-slate-500';

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden transition-colors duration-500', getThemeBackground())}>
      <header className="z-10 p-5 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={cn('text-xs font-medium', subTitleColor)}>{today}</p>
            <h1 className={cn('text-2xl font-black tracking-tight', titleColor)}>场景</h1>
            <p className={cn('mt-1 text-xs font-medium', subTitleColor)}>
              当前场景里有 {petsInTheme.length} 只幻兽正在活动
            </p>
          </div>
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-xs font-black shadow-sm backdrop-blur-md',
              currentTheme !== 'custom' && currentTheme !== 'A'
                ? 'bg-white/15 text-white'
                : 'bg-white/70 text-indigo-600',
            )}>
            <span className="flex items-center gap-2">
              <Sparkles size={14} />
              {getThemeName(currentTheme)}
            </span>
          </div>
        </div>
      </header>

      <div className="z-10 px-5 pb-4">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/20 p-1 backdrop-blur-md scroll-hide">
          {(['A', 'B', 'C', 'custom'] as ThemeType[]).map((theme) => (
            <button
              key={theme}
              onClick={() => setCurrentTheme(theme)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all',
                currentTheme === theme
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-white/60 hover:text-white',
              )}>
              {getThemeIcon(theme)}
              {getThemeName(theme)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden pb-24">
        {currentTheme === 'C' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(#00ffcc 1px, transparent 1px), linear-gradient(90deg, #00ffcc 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        )}
        {currentTheme === 'custom' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(#4f46e5 2px, transparent 2px)',
              backgroundSize: '30px 30px',
            }}
          />
        )}
        <PetScene />
      </div>
    </div>
  );
}
