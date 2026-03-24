import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {type EggSpriteAction, getEggSpriteConfig} from '../data/eggSprites';
import type {EggTierId} from '../data/eggs';
import {cn} from '../utils/cn';
import {ensureSpritePathLoaded, getLoadedSpriteImage, isSpritePathLoaded} from '../utils/spriteAssetLoader';

interface EggActorProps {
  tierId: EggTierId;
  animation?: EggSpriteAction;
  className?: string;
  scale?: number;
  seed?: number;
  playOnce?: boolean;
  ariaLabel?: string;
  onComplete?: () => void;
}

type EggConfig = ReturnType<typeof getEggSpriteConfig>;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function EggActor({
  tierId,
  animation = 'idle',
  className,
  scale = 1,
  seed = 0,
  playOnce = false,
  ariaLabel,
  onComplete,
}: EggActorProps) {
  const targetConfig = getEggSpriteConfig(tierId, animation);
  const [resolvedConfig, setResolvedConfig] = useState<EggConfig | null>(() => {
    return isSpritePathLoaded(targetConfig.path) ? targetConfig : null;
  });
  const [frameIndex, setFrameIndex] = useState(0);
  const frameMetaRef = useRef<{path: string; frameCount: number}>({
    path: targetConfig.path,
    frameCount: targetConfig.frameCount,
  });
  const previousSeedRef = useRef(seed);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  const config =
    isSpritePathLoaded(targetConfig.path)
      ? targetConfig
      : resolvedConfig;

  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;

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
    const isSeedChanged = previousSeedRef.current !== seed;
    previousSeedRef.current = seed;

    const previousMeta = frameMetaRef.current;
    const isPathChanged = previousMeta.path !== targetConfig.path;

    completedRef.current = false;

    setFrameIndex((previous) => {
      if (isSeedChanged || isPathChanged) return 0;
      return clamp(previous, 0, Math.max(targetConfig.frameCount - 1, 0));
    });

    frameMetaRef.current = {
      path: targetConfig.path,
      frameCount: targetConfig.frameCount,
    };
  }, [seed, targetConfig.frameCount, targetConfig.path]);

  const renderWidth = useMemo(
    () => Math.max(1, Math.round((config?.frameWidth ?? targetConfig.frameWidth) * scale)),
    [config?.frameWidth, scale, targetConfig.frameWidth],
  );
  const renderHeight = useMemo(
    () => Math.max(1, Math.round((config?.frameHeight ?? targetConfig.frameHeight) * scale)),
    [config?.frameHeight, scale, targetConfig.frameHeight],
  );

  const effectiveFps = config?.fps ?? targetConfig.fps;

  useEffect(() => {
    const activeConfig = config ?? targetConfig;
    if (activeConfig.frameCount <= 1 || effectiveFps <= 0) return;

    const timer = window.setInterval(() => {
      setFrameIndex((previous) => {
        if (previous >= activeConfig.frameCount - 1) {
          if (playOnce || !activeConfig.loop) return previous;
          return 0;
        }
        return previous + 1;
      });
    }, 1000 / effectiveFps);

    return () => window.clearInterval(timer);
  }, [config, effectiveFps, playOnce, targetConfig]);

  const safeFrameIndex = clamp(frameIndex, 0, Math.max((config?.frameCount ?? targetConfig.frameCount) - 1, 0));
  const frameWidth = Math.max(1, config?.frameWidth ?? targetConfig.frameWidth);
  const frameHeight = Math.max(1, config?.frameHeight ?? targetConfig.frameHeight);

  useEffect(() => {
    const activeConfig = config ?? targetConfig;
    if (!playOnce || completedRef.current) return;
    if (safeFrameIndex < activeConfig.frameCount - 1) return;
    completedRef.current = true;
    onCompleteRef.current?.();
  }, [config, playOnce, safeFrameIndex, targetConfig]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const activeConfig = config ?? targetConfig;
    const image = getLoadedSpriteImage(activeConfig.path);
    if (!image) return;

    if (canvas.width !== renderWidth) canvas.width = renderWidth;
    if (canvas.height !== renderHeight) canvas.height = renderHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, renderWidth, renderHeight);
    context.imageSmoothingEnabled = false;

    const columnIndex = safeFrameIndex % activeConfig.columns;
    const rowIndex = Math.floor(safeFrameIndex / activeConfig.columns);
    const sourceX = columnIndex * frameWidth;
    const sourceY = rowIndex * frameHeight;

    context.drawImage(image, sourceX, sourceY, frameWidth, frameHeight, 0, 0, renderWidth, renderHeight);
  }, [
    config,
    frameHeight,
    frameWidth,
    renderHeight,
    renderWidth,
    safeFrameIndex,
    targetConfig,
  ]);

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
      }}>
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
