/** Map a finger in viewport CSS pixels onto the game world. */

export interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function clientToGame(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  viewW: number,
  viewH: number,
  scrollX = 0,
  scrollY = 0,
): { x: number; y: number } {
  const width = rect.width > 0 ? rect.width : 1;
  const height = rect.height > 0 ? rect.height : 1;
  return {
    x: ((clientX - rect.left) * viewW) / width + scrollX,
    y: ((clientY - rect.top) * viewH) / height + scrollY,
  };
}
