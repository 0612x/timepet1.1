const LOADED_SPRITE_PATHS = new Set<string>();
const LOADING_SPRITE_TASKS = new Map<string, Promise<boolean>>();
const LOADED_SPRITE_IMAGES = new Map<string, HTMLImageElement>();

const loadSpritePath = (path: string): Promise<boolean> => {
  const existingTask = LOADING_SPRITE_TASKS.get(path);
  if (existingTask) return existingTask;

  const task = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (ok) {
        LOADED_SPRITE_PATHS.add(path);
        LOADED_SPRITE_IMAGES.set(path, image);
      }
      LOADING_SPRITE_TASKS.delete(path);
      resolve(ok);
    };

    image.onload = () => {
      if (typeof image.decode === 'function') {
        image.decode().catch(() => undefined).finally(() => finish(true));
        return;
      }
      finish(true);
    };

    image.onerror = () => finish(false);
    image.src = path;

    if (image.complete && image.naturalWidth > 0) {
      finish(true);
    }
  });

  LOADING_SPRITE_TASKS.set(path, task);
  return task;
};

export const isSpritePathLoaded = (path: string) => LOADED_SPRITE_PATHS.has(path);
export const getLoadedSpriteImage = (path: string) => LOADED_SPRITE_IMAGES.get(path) ?? null;

export const ensureSpritePathLoaded = (path: string): Promise<boolean> => {
  if (!path) return Promise.resolve(false);
  if (LOADED_SPRITE_PATHS.has(path)) return Promise.resolve(true);
  return loadSpritePath(path);
};

export const preloadSpritePaths = async (paths: string[]) => {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const results = await Promise.all(uniquePaths.map((path) => ensureSpritePathLoaded(path)));
  return {
    loadedCount: results.filter(Boolean).length,
    failedPaths: uniquePaths.filter((_, index) => !results[index]),
  };
};
