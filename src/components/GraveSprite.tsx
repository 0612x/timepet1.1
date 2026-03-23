import React, {useState} from 'react';
import {cn} from '../utils/cn';

const GRAVE_ICON_PATHS = [
  '/images/pets/farm/farm_grave.png',
  '/images/pets/farm/grave.png',
] as const;

interface GraveSpriteProps {
  size?: number;
  className?: string;
}

export function GraveSprite({size = 28, className}: GraveSpriteProps) {
  const [imageError, setImageError] = useState(false);
  const [iconPathIndex, setIconPathIndex] = useState(0);
  const iconPath = GRAVE_ICON_PATHS[iconPathIndex];

  if (!imageError && iconPath) {
    return (
      <img
        src={iconPath}
        alt="grave"
        width={size}
        height={size}
        onError={() => {
          if (iconPathIndex < GRAVE_ICON_PATHS.length - 1) {
            setIconPathIndex((previous) => previous + 1);
            return;
          }
          setImageError(true);
        }}
        className={cn('block [image-rendering:pixelated]', className)}
      />
    );
  }

  return (
    <span
      className={cn('leading-none opacity-95', className)}
      style={{fontSize: `${Math.max(18, Math.round(size * 0.9))}px`}}
    >
      🪦
    </span>
  );
}
