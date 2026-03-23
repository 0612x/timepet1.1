import React from 'react';
import {cn} from '../utils/cn';

interface UiTextureLayerProps {
  path?: string | null;
  className?: string;
  opacity?: number;
}

export function UiTextureLayer({path, className, opacity = 1}: UiTextureLayerProps) {
  if (!path) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 bg-center bg-no-repeat [background-size:100%_100%]',
        className,
      )}
      style={{
        backgroundImage: `url(${path})`,
        opacity,
      }}
    />
  );
}
