import React, {useEffect, useMemo, useState} from 'react';
import {
  getPetSpriteConfigByKey,
  PET_SPRITE_SCENE_LABELS,
  type PetSpriteAction,
  type PetSpriteScene,
} from '../data/petSprites';
import {cn} from '../utils/cn';

interface SpritePreviewActorProps {
  spriteKey: string;
  spriteLabel: string;
  spriteScene: PetSpriteScene;
  action: PetSpriteAction;
  actionSeed: number;
  sceneScale?: number;
  flipX?: boolean;
}

export function SpritePreviewActor({
  spriteKey,
  spriteLabel,
  spriteScene,
  action,
  actionSeed,
  sceneScale,
  flipX,
}: SpritePreviewActorProps) {
  const config = getPetSpriteConfigByKey(spriteKey, action);
  const [frameIndex, setFrameIndex] = useState(0);

  const frames = useMemo(() => {
    if (!config) return [];
    return Array.from({length: config.frameCount}, (_, index) => index);
  }, [config]);

  useEffect(() => {
    setFrameIndex(0);
  }, [spriteKey, action, actionSeed, config?.path]);

  useEffect(() => {
    if (!config || frames.length <= 1 || config.fps <= 0) return;

    const timer = window.setInterval(() => {
      setFrameIndex((previous) => {
        if (previous >= frames.length - 1) {
          return config.loop ? 0 : previous;
        }
        return previous + 1;
      });
    }, 1000 / config.fps);

    return () => window.clearInterval(timer);
  }, [config, frames.length, actionSeed]);

  if (!config) return null;

  const currentFrame = frames[Math.min(frameIndex, frames.length - 1)] ?? 0;
  const columnIndex = currentFrame % config.columns;
  const rowIndex = Math.floor(currentFrame / config.columns);
  const fallbackScaleByScene: Record<PetSpriteScene, number> = {
    farm: 2.35,
    ocean: 2.25,
    draw: 2.3,
  };
  const scale = sceneScale ?? fallbackScaleByScene[spriteScene];
  const width = config.frameWidth * scale;
  const height = config.frameHeight * scale;

  return (
    <div className="pointer-events-none absolute bottom-24 right-5 z-10">
      <div className="rounded-[28px] border border-white/60 bg-white/28 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-slate-700">
            素材预览
          </span>
          <span className="rounded-full bg-white/50 px-2 py-1 text-[10px] font-black text-slate-500">
            {PET_SPRITE_SCENE_LABELS[spriteScene]}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div
            className={cn(
              'rounded-[22px] border border-white/70 bg-white/55 p-3 shadow-inner shadow-white/40',
              spriteScene === 'farm' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(236,253,245,0.88))]',
              spriteScene === 'ocean' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(224,242,254,0.88))]',
              spriteScene === 'draw' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(243,232,255,0.9))]',
            )}>
            <div
              role="img"
              aria-label={spriteLabel}
              className="bg-no-repeat drop-shadow-[0_10px_18px_rgba(15,23,42,0.2)]"
              style={{
                width: `${width}px`,
                height: `${height}px`,
                backgroundImage: `url(${config.path})`,
                backgroundPosition: `-${columnIndex * width}px -${rowIndex * height}px`,
                backgroundSize: `${config.columns * width}px ${config.rows * height}px`,
                imageRendering: 'pixelated',
                transform: flipX ? 'scaleX(-1)' : undefined,
              }}
            />
          </div>
          <div className="mt-2 text-center">
            <div className="text-xs font-black text-white drop-shadow-sm">{spriteLabel}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">
              {action}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
