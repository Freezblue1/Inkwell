import { Box, FormControlLabel, MenuItem, Slider, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useStore } from '@/store';
import { MANUSCRIPT_FONTS } from '@/lib/defaults';

function SliderRow({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  const id = `slider-${label.replace(/\s/g, '-')}`;
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

/** Editor typography and behaviour settings (font, size, spacing, width, indent, spellcheck, paper). */
export function EditorSettingsForm() {
  const es = useStore((s) => s.settings.editor);
  const update = useStore((s) => s.updateEditorSettings);

  return (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      <TextField select label="Manuscript font" value={es.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })} fullWidth>
        {MANUSCRIPT_FONTS.map((f) => (
          <MenuItem key={f.label} value={f.value} sx={{ fontFamily: f.value }}>
            {f.label}
          </MenuItem>
        ))}
      </TextField>
      <SliderRow label="Font size" value={es.fontSize} min={12} max={28} step={1} unit="px" onChange={(v) => update({ fontSize: v })} />
      <SliderRow label="Line height" value={es.lineHeight} min={1.1} max={2.4} step={0.05} onChange={(v) => update({ lineHeight: Number(v.toFixed(2)) })} />
      <SliderRow label="Paragraph spacing" value={es.paragraphSpacing} min={0} max={1.5} step={0.1} unit="em" onChange={(v) => update({ paragraphSpacing: Number(v.toFixed(1)) })} />
      <SliderRow label="First-line indent" value={es.firstLineIndent} min={0} max={4} step={0.25} unit="em" onChange={(v) => update({ firstLineIndent: v })} />
      <SliderRow label="Page width" value={es.pageWidth} min={480} max={1100} step={20} unit="px" onChange={(v) => update({ pageWidth: v })} />
      <TextField label="Scene break glyph" value={es.sceneBreakGlyph} onChange={(e) => update({ sceneBreakGlyph: e.target.value.slice(0, 12) })} />
      <Box>
        <Typography variant="body2" gutterBottom>
          Paper
        </Typography>
        <ToggleButtonGroup exclusive size="small" value={es.paperTheme} onChange={(_, v) => v && update({ paperTheme: v })} aria-label="Editor paper">
          <ToggleButton value="default">Match theme</ToggleButton>
          <ToggleButton value="sepia">Sepia</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <FormControlLabel control={<Switch checked={es.spellcheck} onChange={(e) => update({ spellcheck: e.target.checked })} />} label="Spellcheck (right-click for suggestions)" />
      <FormControlLabel control={<Switch checked={es.typewriter} onChange={(e) => update({ typewriter: e.target.checked })} />} label="Typewriter scrolling" />
    </Stack>
  );
}
