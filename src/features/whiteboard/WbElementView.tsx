import { memo } from 'react';
import type { WbElement } from '@/types/models';
import { arrowHead, NOTE_FONT_SIZE, NOTE_PADDING, pointsToPath, TEXT_LINE_HEIGHT, wrapText } from '@/lib/whiteboard';

export const WB_FONT = '"Caveat", "Comic Sans MS", cursive';

interface Props {
  el: WbElement;
  ink: string;
  /** Hide text while it is being edited in the overlay. */
  hideText?: boolean;
  docTitle?: string;
}

/** Renders one whiteboard element as SVG. */
export const WbElementView = memo(function WbElementView({ el, ink, hideText, docTitle }: Props) {
  const color = el.color === 'ink' ? ink : el.color;
  switch (el.type) {
    case 'path':
      return <path d={pointsToPath(el.points)} fill="none" stroke={color} strokeWidth={el.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
    case 'rect':
      return <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6} fill={el.fill} stroke={color} strokeWidth={el.strokeWidth} />;
    case 'ellipse':
      return <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={el.fill} stroke={color} strokeWidth={el.strokeWidth} />;
    case 'arrow':
      return (
        <g>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={color} strokeWidth={el.strokeWidth} strokeLinecap="round" />
          <polygon points={arrowHead(el.x1, el.y1, el.x2, el.y2, 10 + el.strokeWidth * 2)} fill={color} />
        </g>
      );
    case 'note': {
      const lines = hideText ? [] : wrapText(el.text, el.w - NOTE_PADDING * 2, NOTE_FONT_SIZE);
      const maxLines = Math.max(0, Math.floor((el.h - NOTE_PADDING * 2 - (el.docId ? 18 : 0)) / (NOTE_FONT_SIZE * TEXT_LINE_HEIGHT)));
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={3} fill={el.fill} filter="url(#wb-shadow)" />
          {el.docId && (
            <g>
              <text x={el.x + NOTE_PADDING} y={el.y + NOTE_PADDING + 10} fontSize={11} fontFamily="Roboto, sans-serif" fontWeight={600} fill="#5d4037">
                SCENE{docTitle ? '' : ' (deleted)'}
              </text>
              <text x={el.x + el.w - 22} y={el.y + 20} fontSize={15} fontFamily="Roboto, sans-serif" fill="#5d4037" style={{ cursor: 'pointer' }}>
                ↗
              </text>
            </g>
          )}
          <text fontFamily={WB_FONT} fontSize={NOTE_FONT_SIZE} fill="#3e2723">
            {lines.slice(0, maxLines).map((line, i) => (
              <tspan key={i} x={el.x + NOTE_PADDING} y={el.y + NOTE_PADDING + (el.docId ? 18 : 0) + NOTE_FONT_SIZE + i * NOTE_FONT_SIZE * TEXT_LINE_HEIGHT}>
                {i === maxLines - 1 && lines.length > maxLines ? `${line.slice(0, -1)}…` : line || ' '}
              </tspan>
            ))}
          </text>
        </g>
      );
    }
    case 'text': {
      if (hideText) return null;
      const lines = wrapText(el.text || ' ', el.w, el.fontSize);
      return (
        <text fontFamily={WB_FONT} fontSize={el.fontSize} fill={color}>
          {lines.map((line, i) => (
            <tspan key={i} x={el.x} y={el.y + el.fontSize + i * el.fontSize * TEXT_LINE_HEIGHT}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      );
    }
  }
});
