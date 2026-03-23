import React, {useEffect, useState} from 'react';
import {getFoodItemById, type FoodId} from '../data/foods';
import {cn} from '../utils/cn';

interface FoodSpriteProps {
  foodId: FoodId;
  size?: number;
  className?: string;
}

export function FoodSprite({foodId, size = 20, className}: FoodSpriteProps) {
  const food = getFoodItemById(foodId);
  const [pathIndex, setPathIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const imagePathSignature = food.imagePaths.join('|');

  useEffect(() => {
    setPathIndex(0);
    setImageError(false);
  }, [foodId, imagePathSignature]);

  const currentPath = food.imagePaths[pathIndex];

  if (!imageError && currentPath) {
    return (
      <img
        src={currentPath}
        alt={food.label}
        width={size}
        height={size}
        onError={() => {
          if (pathIndex < food.imagePaths.length - 1) {
            setPathIndex((previous) => previous + 1);
            return;
          }
          setImageError(true);
        }}
        className={cn('block object-contain [image-rendering:pixelated]', className)}
      />
    );
  }

  return (
    <span
      className={cn('inline-flex items-center justify-center leading-none', className)}
      style={{fontSize: `${Math.max(14, Math.round(size * 0.9))}px`}}
      aria-label={food.label}
    >
      {food.fallbackEmoji}
    </span>
  );
}
