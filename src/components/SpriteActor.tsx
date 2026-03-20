import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {getPetSpriteConfigByKey, type PetSpriteAction} from '../data/petSprites';
import {cn} from '../utils/cn';
import {ensureSpritePathLoaded, getLoadedSpriteImage, isSpritePathLoaded} from '../utils/spriteAssetLoader';

interface SpriteActorProps {
  spriteKey: string;
  action?: PetSpriteAction;
  className?: string;
  scale?: number;
  flipX?: boolean;
  seed?: number;
  ariaLabel?: string;
}

type SpriteConfig = NonNullable<ReturnType<typeof getPetSpriteConfigByKey>>;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const ACTION_TIMING_PROFILE: Record<
  PetSpriteAction,
  {targetLoopMs: number; minFps: number; maxFps: number}
> = {
  idle: {targetLoopMs: 1900, minFps: 0.95, maxFps: 4.8},
  move: {targetLoopMs: 980, minFps: 2.8, maxFps: 8.5},
  feed: {targetLoopMs: 1180, minFps: 1.9, maxFps: 6.8},
  happy: {targetLoopMs: 940, minFps: 2.6, maxFps: 8.2},
};

export function SpriteActor({
  spriteKey,
  action = 'idle',
  className,
  scale = 1,
  flipX,
  seed = 0,
  ariaLabel,
}: SpriteActorProps) {
  const targetConfig = getPetSpriteConfigByKey(spriteKey, action);
  const [resolvedConfig, setResolvedConfig] = useState<SpriteConfig | null>(() => {
    if (!targetConfig) return null;
    return isSpritePathLoaded(targetConfig.path) ? targetConfig : null;
  });

  const config =
    targetConfig && isSpritePathLoaded(targetConfig.path)
      ? targetConfig
      : resolvedConfig;

  const [frameIndex, setFrameIndex] = useState(0);
  const frameMetaRef = useRef<{path: string; frameCount: number}>({
    path: config?.path ?? '',
    frameCount: config?.frameCount ?? 1,
  });
  const previousSeedRef = useRef(seed);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!targetConfig) {
      setResolvedConfig(null);
      return () => {
        cancelled = true;
      };
    }

    if (isSpritePathLoaded(targetConfig.path)) {
      setResolvedConfig((previous) => (previous?.path === targetConfig.path ? previous : targetConfig));
      return () => {
        cancelled = true;
      };
    }

    ensureSpritePathLoaded(targetConfig.path).then((loaded) => {
      if (cancelled || !loaded) return;
      setResolvedConfig((previous) => (previous?.path === targetConfig.path ? previous : targetConfig));
    });

    return () => {
      cancelled = true;
    };
  }, [targetConfig]);

  useLayoutEffect(() => {
    if (!config) {
      setFrameIndex(0);
      return;
    }

    const isSeedChanged = previousSeedRef.current !== seed;
    previousSeedRef.current = seed;

    const previousMeta = frameMetaRef.current;
    const isPathChanged = previousMeta.path !== config.path;

    setFrameIndex((previous) => {
      if (isSeedChanged) return 0;
      if (!isPathChanged) return clamp(previous, 0, Math.max(config.frameCount - 1, 0));

      const previousMax = Math.max(previousMeta.frameCount - 1, 1);
      const progress = clamp(previous / previousMax, 0, 1);
      const nextMax = Math.max(config.frameCount - 1, 0);
      return Math.round(progress * nextMax);
    });

    frameMetaRef.current = {
      path: config.path,
      frameCount: config.frameCount,
    };
  }, [config?.path, config?.frameCount, seed, spriteKey]);

  const renderWidth = useMemo(
    () => Math.max(1, Math.round((config?.frameWidth ?? 32) * scale)),
    [config?.frameWidth, scale],
  );
  const renderHeight = useMemo(
    () => Math.max(1, Math.round((config?.frameHeight ?? 32) * scale)),
    [config?.frameHeight, scale],
  );

  const effectiveFps = useMemo(() => {
    if (!config) return 0;
    const profile = ACTION_TIMING_PROFILE[action];
    const targetFps = config.frameCount / (profile.targetLoopMs / 1000);
    return clamp(targetFps, profile.minFps, profile.maxFps);
  }, [action, config]);

  useEffect(() => {
    if (!config || config.frameCount <= 1 || effectiveFps <= 0) return;

    const timer = window.setInterval(() => {
      setFrameIndex((previous) => {
        if (previous >= config.frameCount - 1) {
          return config.loop ? 0 : previous;
        }
        return previous + 1;
      });
    }, 1000 / effectiveFps);

    return () => window.clearInterval(timer);
  }, [config, effectiveFps, seed]);

  const safeFrameIndex = clamp(frameIndex, 0, Math.max((config?.frameCount ?? 1) - 1, 0));
  const frameWidth = Math.max(1, config?.frameWidth ?? 1);
  const frameHeight = Math.max(1, config?.frameHeight ?? 1);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;

    const image = getLoadedSpriteImage(config.path);
    if (!image) return;

    if (canvas.width !== renderWidth) canvas.width = renderWidth;
    if (canvas.height !== renderHeight) canvas.height = renderHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, renderWidth, renderHeight);
    context.imageSmoothingEnabled = false;

    const columnIndex = safeFrameIndex % config.columns;
    const rowIndex = Math.floor(safeFrameIndex / config.columns);
    const sourceX = columnIndex * frameWidth;
    const sourceY = rowIndex * frameHeight;

    if (flipX) {
      context.save();
      context.translate(renderWidth, 0);
      context.scale(-1, 1);
      context.drawImage(image, sourceX, sourceY, frameWidth, frameHeight, 0, 0, renderWidth, renderHeight);
      context.restore();
      return;
    }

    context.drawImage(image, sourceX, sourceY, frameWidth, frameHeight, 0, 0, renderWidth, renderHeight);
  }, [
    config,
    flipX,
    frameHeight,
    frameWidth,
    renderHeight,
    renderWidth,
    safeFrameIndex,
  ]);

  if (!config) return null;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn('relative overflow-hidden', className)}
      style={{
        width: `${renderWidth}px`,
        height: `${renderHeight}px`,
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        contain: 'layout paint size',
      }}
    >
      <canvas
        ref={canvasRef}
        width={renderWidth}
        height={renderHeight}
        className="block h-full w-full [image-rendering:pixelated]"
        style={{
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      />
    </div>
  );
}
