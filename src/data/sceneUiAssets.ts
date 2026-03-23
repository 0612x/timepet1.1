export const SCENE_UI_ASSETS = {
  // 例如: '/images/scenes/farm/farm_ui_shop_button.png'
  shopButton: null,
  // 例如: '/images/scenes/farm/farm_ui_floating_panel.png'
  floatingPanel: null,
  // 例如: '/images/scenes/farm/farm_ui_toggle_handle.png'
  toggleHandle: null,
  // 例如: '/images/scenes/farm/farm_ui_feed_place.png'
  feedPlacement: null,
} as const;

export type SceneUiAssetKey = keyof typeof SCENE_UI_ASSETS;

export function getSceneUiAssetPath(key: SceneUiAssetKey) {
  const path = SCENE_UI_ASSETS[key];
  return typeof path === 'string' && path.trim().length > 0 ? path : null;
}
