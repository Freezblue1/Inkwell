import { Box, Divider, FormControlLabel, MenuItem, Slider, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { ExportProfile, TrimSize } from '@/types/models';
import { EXPORT_FONTS, TRIM_SIZES } from '@/lib/export/trim';
import { useExportProfile } from './profileStore';

function Num({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  const id = `exp-${label.replace(/\W/g, '')}`;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" id={id}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {value}
          {unit}
        </Typography>
      </Stack>
      <Slider size="small" value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(v as number)} aria-labelledby={id} />
    </Box>
  );
}

/** Template, page, typography and front-matter controls for compile/export. */
export function ProfileControls() {
  const profile = useExportProfile((s) => s.profile);
  const update = useExportProfile((s) => s.update);
  const applyTemplate = useExportProfile((s) => s.applyTemplate);
  if (!profile) return null;
  const p = profile;
  const set = (patch: Partial<ExportProfile>) => update(patch);
  const manuscript = p.template === 'manuscript';

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Template
        </Typography>
        <ToggleButtonGroup exclusive fullWidth size="small" value={p.template} onChange={(_, v) => v && applyTemplate(v)} aria-label="Template">
          <ToggleButton value="manuscript">Manuscript</ToggleButton>
          <ToggleButton value="paperback">Paperback</ToggleButton>
          <ToggleButton value="ebook">eBook</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {manuscript
            ? 'Standard Manuscript Format: 12 pt Courier, double-spaced, 1" margins, header with surname/title/page.'
            : p.template === 'paperback'
              ? 'Print interior with trim size, mirrored margins, drop caps and running heads.'
              : 'Reflowable ebook. The preview shows a typical reader page.'}
        </Typography>
      </Box>

      <Divider />
      <Typography variant="overline" color="text.secondary">
        Page
      </Typography>
      <TextField select label="Trim size" value={p.trim} onChange={(e) => set({ trim: e.target.value as TrimSize })} disabled={manuscript}>
        {(Object.keys(TRIM_SIZES) as TrimSize[]).map((k) => (
          <MenuItem key={k} value={k}>
            {TRIM_SIZES[k].label}
          </MenuItem>
        ))}
      </TextField>
      {!manuscript && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {(['top', 'bottom', 'inside', 'outside'] as const).map((k) => (
            <TextField
              key={k}
              label={`${k[0].toUpperCase()}${k.slice(1)} (in)`}
              type="number"
              value={p.margins[k]}
              inputProps={{ step: 0.125, min: 0.25, max: 2 }}
              onChange={(e) => set({ margins: { ...p.margins, [k]: Math.max(0.25, Math.min(2, Number(e.target.value) || 0.25)) } })}
            />
          ))}
        </Box>
      )}

      <Divider />
      <Typography variant="overline" color="text.secondary">
        Typography
      </Typography>
      <TextField select label="Body font" value={p.bodyFont} onChange={(e) => set({ bodyFont: e.target.value })}>
        {EXPORT_FONTS.map((f) => (
          <MenuItem key={f} value={f} sx={{ fontFamily: `"${f}", serif` }}>
            {f}
          </MenuItem>
        ))}
      </TextField>
      <Num label="Font size" value={p.fontSize} min={8} max={16} step={0.5} unit=" pt" onChange={(v) => set({ fontSize: v })} />
      <Num label="Line spacing" value={p.lineHeight} min={1} max={2.5} step={0.05} onChange={(v) => set({ lineHeight: Number(v.toFixed(2)) })} />
      <Num label="Paragraph spacing" value={p.paragraphSpacing} min={0} max={1.5} step={0.1} unit=" em" onChange={(v) => set({ paragraphSpacing: Number(v.toFixed(1)) })} />
      <Num label="First-line indent" value={p.firstLineIndent} min={0} max={4} step={0.25} unit=" em" onChange={(v) => set({ firstLineIndent: v })} />
      <FormControlLabel control={<Switch checked={p.justify} onChange={(e) => set({ justify: e.target.checked })} />} label="Justify text" />
      <FormControlLabel control={<Switch checked={p.dropCaps} onChange={(e) => set({ dropCaps: e.target.checked })} />} label="Drop caps (preview & EPUB)" />
      <FormControlLabel control={<Switch checked={p.runningHeaders} onChange={(e) => set({ runningHeaders: e.target.checked })} />} label="Running headers & page numbers" />
      <TextField select label="Chapter headings" value={p.chapterHeadingStyle} onChange={(e) => set({ chapterHeadingStyle: e.target.value as ExportProfile['chapterHeadingStyle'] })}>
        <MenuItem value="number-title">Chapter One + title</MenuItem>
        <MenuItem value="number">Chapter One</MenuItem>
        <MenuItem value="title">Title only</MenuItem>
        <MenuItem value="ornamental">❦ 1 ❦ + title</MenuItem>
      </TextField>
      <TextField label="Scene break" value={p.sceneBreakGlyph} onChange={(e) => set({ sceneBreakGlyph: e.target.value.slice(0, 16) })} helperText="e.g. * * *, #, ⁂" />

      <Divider />
      <Typography variant="overline" color="text.secondary">
        Front matter
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField label="Author name" value={p.authorName} onChange={(e) => set({ authorName: e.target.value })} fullWidth />
        <TextField label="Surname (header)" value={p.authorSurname} onChange={(e) => set({ authorSurname: e.target.value })} sx={{ width: 140 }} />
      </Stack>
      <FormControlLabel control={<Switch checked={p.titlePage} onChange={(e) => set({ titlePage: e.target.checked })} />} label="Title page" />
      <FormControlLabel control={<Switch checked={p.copyrightPage} onChange={(e) => set({ copyrightPage: e.target.checked })} />} label="Copyright page" />
      {p.copyrightPage && <TextField label="Copyright text" multiline minRows={2} value={p.copyrightText} onChange={(e) => set({ copyrightText: e.target.value })} />}
      <TextField label="Dedication (optional)" multiline minRows={2} value={p.dedication} onChange={(e) => set({ dedication: e.target.value })} />
      <FormControlLabel control={<Switch checked={p.toc} onChange={(e) => set({ toc: e.target.checked })} />} label="Table of contents" />
    </Stack>
  );
}
