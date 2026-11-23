import { createContext, memo, useContext } from 'react';
import type { WbCard, WbElement, WbFrame, WbImage, WbLink } from '@/types/models';
import { linkInfo, PROVIDER_LABELS } from '@/lib/linkEmbed';
import { arrowHead, arrowLineEnd, textBoxWidth, DEFAULT_NOTE_TEXT, FRAME_TITLE_H, localBounds, NOTE_FONT_SIZE, NOTE_PADDING, noteFill, noteTilt, pointsToPath, rotationOf, shade, TEXT_LINE_HEIGHT, wrapText } from '@/lib/whiteboard';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { useStore } from '@/store';
import { BIBLE_KIND_LABELS } from '@/lib/bible';

/**
 * Prefix for this board's SVG <defs> ids (shadows, gradients). Every open board
 * tab is mounted (hidden ones with display:none), so ids must be unique per
 * board: a url(#id) that resolves into a hidden board draws nothing.
 */
export const WbDefsContext = createContext('wb');

export const WB_FONT = '"Caveat", "Comic Sans MS", cursive';
const UI_FONT = 'Roboto, "Segoe UI", sans-serif';

interface Props {
  el: WbElement;
  ink: string;
  /** Hide text while it is being edited in the overlay. */
  hideText?: boolean;
  docTitle?: string;
  /** Background for arrow labels. */
  paper?: string;
  /** A link's live preview takes the mouse (double-clicked to use it). */
  interactive?: boolean;
}

/** Renders one whiteboard element as SVG, turned by its rotation. */
export const WbElementView = memo(function WbElementView(props: Props) {
  const rot = rotationOf(props.el);
  if (!rot) return <ElementShape {...props} />;
  const b = localBounds(props.el);
  return (
    <g transform={`rotate(${rot} ${b.x + b.w / 2} ${b.y + b.h / 2})`}>
      <ElementShape {...props} />
    </g>
  );
});

function ElementShape({ el, ink, hideText, docTitle, paper = '#ffffff', interactive }: Props) {
  const defs = useContext(WbDefsContext);
  const color = el.color === 'ink' ? ink : el.color;
  switch (el.type) {
    case 'path':
      return <path d={pointsToPath(el.points)} fill="none" stroke={color} strokeWidth={el.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
    case 'rect':
      return <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6} fill={el.fill === 'ink' ? ink : el.fill} stroke={color} strokeWidth={el.strokeWidth} />;
    case 'ellipse':
      return <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={el.fill === 'ink' ? ink : el.fill} stroke={color} strokeWidth={el.strokeWidth} />;
    case 'arrow': {
      const label = hideText ? '' : el.label?.trim() ?? '';
      const mx = (el.x1 + el.x2) / 2;
      const my = (el.y1 + el.y2) / 2;
      const lw = label.length * 7.2 + 14;
      const head = 10 + el.strokeWidth * 2;
      // The line ends inside the head, so a thick stroke doesn't stick out past the point.
      const end = arrowLineEnd(el.x1, el.y1, el.x2, el.y2, head);
      return (
        <g>
          <line x1={el.x1} y1={el.y1} x2={end.x} y2={end.y} stroke={color} strokeWidth={el.strokeWidth} strokeLinecap="round" />
          <polygon points={arrowHead(el.x1, el.y1, el.x2, el.y2, head)} fill={color} strokeLinejoin="round" stroke={color} strokeWidth={Math.min(2, el.strokeWidth / 2)} />
          {label && (
            <g>
              <rect x={mx - lw / 2} y={my - 11} width={lw} height={22} rx={11} fill={paper} stroke={color} strokeWidth={1} />
              <text x={mx} y={my + 4.5} textAnchor="middle" fontSize={13} fontFamily={UI_FONT} fill={color}>
                {label}
              </text>
            </g>
          )}
        </g>
      );
    }
    case 'note': {
      const lines = hideText ? [] : wrapText(el.text, el.w - NOTE_PADDING * 2, NOTE_FONT_SIZE);
      const maxLines = Math.max(0, Math.floor((el.h - NOTE_PADDING * 2 - (el.docId ? 18 : 0)) / (NOTE_FONT_SIZE * TEXT_LINE_HEIGHT)));
      const { x, y, w, h } = el;
      const fill = noteFill(el.fill);
      const textInk = el.textColor ?? DEFAULT_NOTE_TEXT;
      // A small hand-placed tilt, unless the note was rotated on purpose (and none while its text is edited).
      const tilt = hideText || el.rotation !== undefined ? 0 : noteTilt(el.id);
      const curl = Math.max(8, Math.min(20, w * 0.11, h * 0.14));
      const band = Math.min(20, h * 0.15);
      // Paper with its bottom-right corner lifting off the board.
      const body = `M${x},${y} H${x + w} V${y + h - curl} Q${x + w - curl * 0.2},${y + h - curl * 0.2} ${x + w - curl},${y + h} H${x} Z`;
      const flap = `M${x + w},${y + h - curl} Q${x + w - curl * 0.2},${y + h - curl * 0.2} ${x + w - curl},${y + h} Q${x + w - curl * 0.7},${y + h - curl * 0.5} ${x + w - curl * 0.62},${y + h - curl * 0.62} Q${x + w - curl * 0.5},${y + h - curl * 0.7} ${x + w},${y + h - curl} Z`;
      return (
        <g transform={tilt ? `rotate(${tilt} ${x + w / 2} ${y + h / 2})` : undefined}>
          {/* Shadow drawn separately, so the paper always shows even if a filter can't render. */}
          <path d={body} fill="#000" filter={`url(#${defs}-note-shadow)`} />
          <path d={body} fill={fill} />
          <path d={body} fill={`url(#${defs}-note-sheen)`} />
          <rect x={x} y={y} width={w} height={band} fill="rgba(0,0,0,0.055)" />
          <line x1={x} y1={y + band} x2={x + w} y2={y + band} stroke="rgba(0,0,0,0.05)" strokeWidth={1} />
          <path d={flap} fill={shade(fill, -0.16)} />
          <path d={body} fill="none" stroke={shade(fill, -0.3)} strokeOpacity={0.55} strokeWidth={0.8} />
          {el.docId && (
            <g>
              <text x={x + NOTE_PADDING} y={y + NOTE_PADDING + 10} fontSize={11} fontFamily={UI_FONT} fontWeight={600} fill={textInk} fillOpacity={0.75}>
                SCENE{docTitle ? '' : ' (deleted)'}
              </text>
              <text x={x + w - 22} y={y + 20} fontSize={15} fontFamily={UI_FONT} fill={textInk} fillOpacity={0.75} style={{ cursor: 'pointer' }}>
                ↗
              </text>
            </g>
          )}
          <text fontFamily={WB_FONT} fontSize={NOTE_FONT_SIZE} fill={textInk}>
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
      const lines = wrapText(el.text || ' ', textBoxWidth(el), el.fontSize);
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
    case 'image':
      return <ImageView el={el} />;
    case 'card':
      return <CardView el={el} />;
    case 'frame':
      return <FrameView el={el} hideText={hideText} />;
    case 'link':
      return <LinkView el={el} interactive={!!interactive} />;
  }
}

export const LINK_HEADER_H = 40;
const PROVIDER_COLORS: Record<string, string> = { maps: '#34a853', youtube: '#ff0000', vimeo: '#1ab7ea', spotify: '#1db954' };

/** A link card: title and site, then a live preview (if the site allows embedding) or the address. */
function LinkView({ el, interactive }: { el: WbLink; interactive: boolean }) {
  const defs = useContext(WbDefsContext);
  const info = linkInfo(el.url);
  const embed = el.preview !== false ? info?.embedUrl ?? null : null;
  const accent = (info?.provider && PROVIDER_COLORS[info.provider]) || '#5c6bc0';
  const title = el.title || (info?.provider ? PROVIDER_LABELS[info.provider] : info?.host) || el.url;
  const pad = 12;
  const bodyY = el.y + LINK_HEADER_H;
  const bodyH = Math.max(0, el.h - LINK_HEADER_H);
  const urlLines = wrapText(info?.url ?? el.url, el.w - pad * 2, 12.5, UI_FONT);
  return (
    <g>
      <clipPath id={`${defs}-link-${el.id}`}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} />
      </clipPath>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill="#ffffff" filter={`url(#${defs}-shadow)`} />
      <g clipPath={`url(#${defs}-link-${el.id})`}>
        <rect x={el.x} y={el.y} width={el.w} height={LINK_HEADER_H} fill="#f6f7fb" />
        <circle cx={el.x + 20} cy={el.y + LINK_HEADER_H / 2} r={8} fill={accent} />
        <text x={el.x + 36} y={el.y + 17} fontSize={13} fontWeight={700} fontFamily={UI_FONT} fill="#212121">
          {title.length > Math.floor((el.w - 80) / 7) ? `${title.slice(0, Math.max(4, Math.floor((el.w - 80) / 7) - 1))}…` : title}
        </text>
        <text x={el.x + 36} y={el.y + 32} fontSize={11} fontFamily={UI_FONT} fill="#666">
          {info?.host ?? 'link'}
        </text>
        <text x={el.x + el.w - 24} y={el.y + 25} fontSize={16} fontFamily={UI_FONT} fill="#5d4037" style={{ cursor: 'pointer' }}>
          ↗
        </text>
        {embed && bodyH > 20 ? (
          <foreignObject x={el.x} y={bodyY} width={el.w} height={bodyH}>
            <iframe
              src={embed}
              title={title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="fullscreen; encrypted-media; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              style={{ width: '100%', height: '100%', border: 0, display: 'block', pointerEvents: interactive ? 'auto' : 'none' }}
            />
          </foreignObject>
        ) : (
          <text fontSize={12.5} fontFamily={UI_FONT} fill="#1565c0">
            {urlLines.slice(0, Math.max(1, Math.floor((bodyH - pad) / 16))).map((line, i) => (
              <tspan key={i} x={el.x + pad} y={bodyY + 18 + i * 16}>
                {line}
              </tspan>
            ))}
          </text>
        )}
      </g>
      {embed && !interactive && bodyH > 60 && (
        <g pointerEvents="none">
          <rect x={el.x + el.w / 2 - 92} y={el.y + el.h - 30} width={184} height={22} rx={11} fill="rgba(0,0,0,0.6)" />
          <text x={el.x + el.w / 2} y={el.y + el.h - 15} textAnchor="middle" fontSize={11.5} fontFamily={UI_FONT} fill="#fff">
            Double-click to use the preview
          </text>
        </g>
      )}
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill="none" stroke={interactive ? accent : 'rgba(0,0,0,0.14)'} strokeWidth={interactive ? 3 : 1} />
    </g>
  );
}

function ImageView({ el }: { el: WbImage }) {
  const url = useAssetUrl(el.assetId);
  if (!url)
    return (
      <g>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="rgba(128,128,128,0.15)" stroke="rgba(128,128,128,0.5)" strokeDasharray="6 4" />
        <text x={el.x + el.w / 2} y={el.y + el.h / 2} textAnchor="middle" fontSize={13} fontFamily={UI_FONT} fill="#888">
          {el.name || 'Picture'}
        </text>
      </g>
    );
  return <image href={url} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="none" />;
}

const KIND_COLORS: Record<string, string> = { character: '#3949ab', location: '#00897b', item: '#ef6c00', lore: '#8e24aa' };

function CardView({ el }: { el: WbCard }) {
  const defs = useContext(WbDefsContext);
  const entry = useStore((s) => s.bible.find((b) => b.id === el.bibleId));
  const portrait = useAssetUrl(entry?.imageAssetId ?? null);
  const accent = entry?.color || (entry ? KIND_COLORS[entry.kind] : '#9e9e9e');
  const pad = 12;
  const imgSize = portrait ? Math.min(64, el.h - pad * 2) : 0;
  const textW = el.w - pad * 2 - 6 - (imgSize ? imgSize + 10 : 0);
  const detail = entry ? (entry.kind === 'character' ? [entry.role, entry.summary].filter(Boolean).join(' — ') : entry.summary) : 'This Story Bible entry was deleted.';
  const lines = wrapText(detail || '', textW, 13, UI_FONT);
  const maxLines = Math.max(0, Math.floor((el.h - 58) / 17));
  return (
    <g>
      <clipPath id={`${defs}-card-${el.id}`}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={8} />
      </clipPath>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={8} fill="#ffffff" filter={`url(#${defs}-shadow)`} />
      {/* The colour strip follows the card's rounded corners instead of sticking out past them. */}
      <rect x={el.x} y={el.y} width={6} height={el.h} fill={accent} clipPath={`url(#${defs}-card-${el.id})`} />
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={8} fill="none" stroke="rgba(0,0,0,0.12)" />
      <text x={el.x + pad + 6} y={el.y + pad + 9} fontSize={10.5} fontWeight={700} letterSpacing={0.8} fontFamily={UI_FONT} fill={accent}>
        {entry ? BIBLE_KIND_LABELS[entry.kind].singular.toUpperCase() : 'STORY BIBLE'}
      </text>
      <text x={el.x + el.w - 22} y={el.y + 20} fontSize={15} fontFamily={UI_FONT} fill="#5d4037" style={{ cursor: 'pointer' }}>
        ↗
      </text>
      <text x={el.x + pad + 6} y={el.y + pad + 30} fontSize={17} fontWeight={700} fontFamily={UI_FONT} fill="#212121">
        {entry?.name ?? 'Missing entry'}
      </text>
      <text fontSize={13} fontFamily={UI_FONT} fill="#555">
        {lines.slice(0, maxLines).map((line, i) => (
          <tspan key={i} x={el.x + pad + 6} y={el.y + pad + 50 + i * 17}>
            {i === maxLines - 1 && lines.length > maxLines ? `${line.slice(0, -1)}…` : line || ' '}
          </tspan>
        ))}
      </text>
      {portrait && (
        <g>
          <clipPath id={`wb-clip-${el.id}`}>
            <circle cx={el.x + el.w - pad - imgSize / 2} cy={el.y + el.h / 2 + 6} r={imgSize / 2} />
          </clipPath>
          <image
            href={portrait}
            x={el.x + el.w - pad - imgSize}
            y={el.y + el.h / 2 + 6 - imgSize / 2}
            width={imgSize}
            height={imgSize}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#wb-clip-${el.id})`}
          />
        </g>
      )}
    </g>
  );
}

function FrameView({ el, hideText }: { el: WbFrame; hideText?: boolean }) {
  const title = hideText ? '' : el.title || 'Frame';
  const tabW = Math.min(el.w, Math.max(90, title.length * 8.5 + 28));
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={10} fill={`${el.fill}26`} stroke={el.fill} strokeWidth={2} />
      <rect x={el.x} y={el.y - FRAME_TITLE_H + 2} width={tabW} height={FRAME_TITLE_H} rx={8} fill={el.fill} />
      <text x={el.x + 12} y={el.y - 8} fontSize={14} fontWeight={700} fontFamily={UI_FONT} fill="#1a1a1a">
        {title}
      </text>
    </g>
  );
}
