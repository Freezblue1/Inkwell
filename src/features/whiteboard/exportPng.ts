/** Exports the visible whiteboard content to a PNG (2× resolution). */
import type { WbElement } from '@/types/models';
import { unionBounds } from '@/lib/whiteboard';
import { downloadBlob, fileSafe } from '@/lib/export/download';
import { blobToDataUrl } from '@/db/repos/assets';

export async function exportWhiteboardPng(svg: SVGSVGElement, elements: WbElement[], background: string, name: string): Promise<void> {
  const b = unionBounds(elements);
  if (!b) throw new Error('The board is empty.');
  const pad = 40;
  const box = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Drop UI layers (selection, grid) and the pan/zoom transform.
  clone.querySelectorAll('.wb-ui, .wb-bg').forEach((n) => n.remove());
  clone.querySelector('.wb-world')?.removeAttribute('transform');
  clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
  clone.setAttribute('width', String(box.w));
  clone.setAttribute('height', String(box.h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', String(box.x));
  bg.setAttribute('y', String(box.y));
  bg.setAttribute('width', String(box.w));
  bg.setAttribute('height', String(box.h));
  bg.setAttribute('fill', background);
  clone.insertBefore(bg, clone.firstChild);
  // Pictures use blob: URLs, which an SVG rendered as an image can't load: inline them.
  await Promise.all(
    [...clone.querySelectorAll('image')].map(async (img) => {
      const href = img.getAttribute('href');
      if (!href?.startsWith('blob:')) return;
      try {
        img.setAttribute('href', await blobToDataUrl(await (await fetch(href)).blob()));
      } catch {
        img.remove();
      }
    }),
  );

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the board'));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(box.w * scale);
    canvas.height = Math.ceil(box.h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, box.w, box.h);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Could not create the image');
    downloadBlob(png, `${fileSafe(name)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
