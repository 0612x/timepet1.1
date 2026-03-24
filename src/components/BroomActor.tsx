import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {type FacilityId, FACILITY_SPRITES, type FacilitySpriteAction} from '../data/facilities';
import {cn} from '../utils/cn';
import {
  ensureSpritePathLoaded,
  getLoadedSpriteImage,
  isSpritePathLoaded,
} from '../utils/spriteAssetLoader';

interface BroomActorProps {
  facilityId?: FacilityId;
  action?: FacilitySpriteAction;
  className?: string;
  scale?: number;
  seed?: number;
  ariaLabel?: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function BroomActor({
  facilityId = 'magicBroom',
  action = 'float',
  className,
  scale = 1,
  seed = 0,
  ariaLabel,
}: BroomActorProps) {
  const targetConfig = FACILITY_SPRITES[facilityId]?.[action] ?? null;
  const [resolvedPath, setResolvedPath] = useState<string | null>(() => {
    if (!targetConfig) return null;
    return isSpritePathLoaded(targetConfig.path) ? targetConfig.path : null;
  });
  const [frameIndex, setFrameIndex] = useState(0);
  const previousActionRef = useRef(action);
  const previousSeedRef = useRef(seed);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!targetConfig) {
      setResolvedPath(null);
      return () => {
        cancelled = true;
      };
    }

    if (isSpritePathLoaded(targetConfig.path)) {
      setResolvedPath(targetConfig.path);
      return () => {
        cancelled = true;
      };
    }

    ensureSpritePathLoaded(targetConfig.path).then((loaded) => {
      if (cancelled || !loaded) return;
      setResolvedPath(targetConfig.path);
    });

    return () => {
      cancelled = true;
    };
  }, [targetConfig]);

  useLayoutEffect(() => {
    const actionChanged = previousActionRef.current !== action;
    const seedChanged = previousSeedRef.current !== seed;
    previousActionRef.current = action;
    previousSeedRef.current = seed;

    if (actionChanged || seedChanged) {
      setFrameIndex(0);
    }
  }, [action, seed]);

  const config = targetConfig && resolvedPath === targetConfig.path ? targetConfig : null;
  const renderWidth = useMemo(
    () => Math.max(1, Math.round((config?.frameWidth ?? 32) * scale)),
    [config?.frameWidth, scale],
  );
  const renderHeight = useMemo(
    () => Math.max(1, Math.round((config?.frameHeight ?? 32) * scale)),
    [config?.frameHeight, scale],
  );

  useEffect(() => {
    if (!config || config.frameCount <= 1 || config.fps <= 0) return;

    const timer = window.setInterval(() => {
      setFrameIndex((previous) => {
        if (previous >= config.frameCount - 1) {
          return config.loop ? 0 : previous;
        }
        return previous + 1;
      });
    }, 1000 / config.fps);

    return () => window.clearInterval(timer);
  }, [config]);

  const safeFrameIndex = clamp(frameIndex, 0, Math.max((config?.frameCount ?? 1) - 1, 0));

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
    const sourceX = columnIndex * config.frameWidth;
    const sourceY = rowIndex * config.frameHeight;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      config.frameWidth,
      config.frameHeight,
      0,
      0,
      renderWidth,
      renderHeight,
    );
  }, [config, renderHeight, renderWidth, safeFrameIndex]);

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
