import React, {useEffect, useMemo, useState} from 'react';
import {Cloud, Cpu, Palette, Plus, Smile, Sparkles, Utensils, Waves, Zap} from 'lucide-react';
import {PetScene} from '../components/PetScene';
import {SpritePreviewActor} from '../components/SpritePreviewActor';
import {cn} from '../utils/cn';
import {useStore} from '../store/useStore';
import type {ThemeType} from '../data/pets';
import {
  getPetSpriteConfigByKey,
  hasPetSpriteAction,
  PET_SPRITE_OPTIONS,
  PET_SPRITE_SCENE_LABELS,
  type PetSpriteAction,
  type PetSpriteScene,
} from '../data/petSprites';
import {formatZhDate, getSimulatedDate} from '../utils/date';

export function SceneView() {
  const {currentTheme, setCurrentTheme, simulatedDateOffset, completedPets} = useStore();
  const [selectedSpriteKey, setSelectedSpriteKey] = useState(PET_SPRITE_OPTIONS[0]?.key ?? '');
  const [previewSpriteKey, setPreviewSpriteKey] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<PetSpriteAction>('idle');
  const [previewActionSeed, setPreviewActionSeed] = useState(0);

  const today = useMemo(
    () => formatZhDate(getSimulatedDate(simulatedDateOffset)),
    [simulatedDateOffset],
  );

  const petsInTheme = completedPets.filter((pet) => pet.theme === currentTheme);

  const preferredSpriteScene = useMemo<PetSpriteScene>(() => {
    if (currentTheme === 'A') return 'farm';
    if (currentTheme === 'B') return 'ocean';
    return 'draw';
  }, [currentTheme]);

  const visibleSpriteOptions = useMemo(() => {
    const matched = PET_SPRITE_OPTIONS.filter((item) => item.scene === preferredSpriteScene);
    return matched.length > 0 ? matched : PET_SPRITE_OPTIONS;
  }, [preferredSpriteScene]);

  useEffect(() => {
    if (visibleSpriteOptions.length === 0) {
      setSelectedSpriteKey('');
      return;
    }

    if (!visibleSpriteOptions.some((item) => item.key === selectedSpriteKey)) {
      setSelectedSpriteKey(visibleSpriteOptions[0].key);
    }
  }, [selectedSpriteKey, visibleSpriteOptions]);

  const selectedSpriteOption =
    visibleSpriteOptions.find((item) => item.key === selectedSpriteKey) ?? visibleSpriteOptions[0] ?? null;
  const activePreviewOption =
    PET_SPRITE_OPTIONS.find((item) => item.key === previewSpriteKey) ?? null;

  const actionButtons: Array<{
    action: PetSpriteAction;
    label: string;
    icon: React.ReactNode;
  }> = [
    {action: 'idle', label: '待机', icon: <Sparkles size={13} />},
    {action: 'move', label: '移动', icon: <Zap size={13} />},
    {action: 'feed', label: '投喂', icon: <Utensils size={13} />},
    {action: 'happy', label: '开心', icon: <Smile size={13} />},
  ];

  const handleAddSprite = () => {
    if (!selectedSpriteOption) return;
    setPreviewSpriteKey(selectedSpriteOption.key);
    setPreviewAction('idle');
    setPreviewActionSeed((previous) => previous + 1);
  };

  const handleTriggerAction = (action: PetSpriteAction) => {
    if (!previewSpriteKey || !hasPetSpriteAction(previewSpriteKey, action)) return;
    setPreviewAction(action);
    setPreviewActionSeed((previous) => previous + 1);
  };

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

        <div
          className={cn(
            'mt-3 rounded-[24px] border p-3 shadow-sm backdrop-blur-md',
            currentTheme !== 'custom' && currentTheme !== 'A'
              ? 'border-white/10 bg-white/10'
              : 'border-white/50 bg-white/55',
          )}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn('text-[10px] font-black uppercase tracking-[0.24em]', subTitleColor)}>
                真实素材预览
              </p>
              <p className={cn('mt-1 text-[11px] font-medium leading-5', subTitleColor)}>
                这是独立预览层，不影响当前场景里已有的幻兽。
              </p>
            </div>
            {activePreviewOption ? (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black',
                  currentTheme !== 'custom' && currentTheme !== 'A'
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-900 text-white',
                )}>
                已加入 · {activePreviewOption.label}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2 min-[430px]:flex-row">
            <select
              value={selectedSpriteKey}
              onChange={(event) => setSelectedSpriteKey(event.target.value)}
              className={cn(
                'h-10 min-w-0 flex-1 rounded-2xl border px-3 text-sm font-black outline-none',
                currentTheme !== 'custom' && currentTheme !== 'A'
                  ? 'border-white/15 bg-white/10 text-white'
                  : 'border-slate-200 bg-white text-slate-800',
              )}>
              {visibleSpriteOptions.map((option) => (
                <option key={option.key} value={option.key} className="text-slate-800">
                  {PET_SPRITE_SCENE_LABELS[option.scene]} · {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddSprite}
              disabled={!selectedSpriteOption}
              className={cn(
                'flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition-all active:scale-[0.98]',
                selectedSpriteOption
                  ? currentTheme !== 'custom' && currentTheme !== 'A'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-300',
              )}>
              <Plus size={14} />
              添加到场景
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {actionButtons.map((item) => {
              const available = previewSpriteKey ? Boolean(getPetSpriteConfigByKey(previewSpriteKey, item.action)) : false;
              const active = previewSpriteKey && previewAction === item.action;

              return (
                <button
                  key={item.action}
                  onClick={() => handleTriggerAction(item.action)}
                  disabled={!available}
                  className={cn(
                    'flex h-10 items-center justify-center gap-1.5 rounded-2xl border text-[11px] font-black transition-all active:scale-[0.98]',
                    !available && 'border-transparent bg-white/10 text-white/30',
                    available &&
                      (currentTheme !== 'custom' && currentTheme !== 'A'
                        ? active
                          ? 'border-white/10 bg-white text-slate-900 shadow-sm'
                          : 'border-white/15 bg-white/10 text-white'
                        : active
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700'),
                  )}>
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
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
        {previewSpriteKey && activePreviewOption ? (
          <SpritePreviewActor
            spriteKey={previewSpriteKey}
            spriteLabel={activePreviewOption.label}
            spriteScene={activePreviewOption.scene}
            action={previewAction}
            actionSeed={previewActionSeed}
            sceneScale={activePreviewOption.sceneScale}
          />
        ) : null}
      </div>
    </div>
  );
}
