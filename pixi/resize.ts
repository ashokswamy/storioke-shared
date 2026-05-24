export interface FitScale {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function getContainScale(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number
): FitScale {
  const scale = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight);
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;

  return {
    scale,
    offsetX: (viewportWidth - scaledWidth) * 0.5,
    offsetY: (viewportHeight - scaledHeight) * 0.5
  };
}
