import { useState } from 'react';
import { Box, Button, Card, CardActions, CardContent, Chip, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined';
import { useStore } from '@/store';
import { STRUCTURE_TEMPLATES, type StructureTemplate } from '@/lib/structureTemplates';
import { confirmDialog } from '@/components/DialogHost';

type Mode = 'chapters' | 'scenes';

/** Structure templates that generate a starter outline in the manuscript. */
export function StructureTemplates() {
  const [mode, setMode] = useState<Mode>('chapters');

  const generate = async (t: StructureTemplate) => {
    const beats = t.acts.reduce((n, a) => n + a.beats.length, 0);
    const ok = await confirmDialog({
      title: `Generate a ${t.name} outline?`,
      message: `Adds ${t.acts.length} parts and ${beats} ${mode === 'chapters' ? 'chapters' : 'scenes'} with synopses (status “Outline”) to the end of your manuscript. Nothing existing is changed.`,
      confirmLabel: 'Generate',
    });
    if (!ok) return;
    const s = useStore.getState();
    for (const act of t.acts) {
      const part = await s.createDoc({ type: 'part', parentId: null, title: act.title, status: 'Outline', synopsis: '' });
      let chapter = mode === 'scenes' ? await s.createDoc({ type: 'chapter', parentId: part.id, title: act.title.replace(/^.*?:\s*/, '') || 'Chapter', status: 'Outline' }) : null;
      for (const beat of act.beats) {
        if (mode === 'chapters') {
          chapter = await s.createDoc({ type: 'chapter', parentId: part.id, title: beat.title, synopsis: beat.synopsis, status: 'Outline' });
          await s.createDoc({ type: 'scene', parentId: chapter.id, title: `${beat.title} — scene 1`, synopsis: beat.synopsis, status: 'Outline' });
        } else {
          await s.createDoc({ type: 'scene', parentId: chapter!.id, title: beat.title, synopsis: beat.synopsis, status: 'Outline' });
        }
      }
    }
    s.notify(`${t.name} outline added — see the corkboard`, 'success', { label: 'Corkboard', run: () => useStore.getState().setPlanTab('corkboard') });
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h2">
            Story structure
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pick a structure to generate a starter outline. Every beat becomes a card with a synopsis you can rewrite.
          </Typography>
        </Box>
        <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Generate beats as">
          <FormControlLabel value="chapters" control={<Radio size="small" />} label="One chapter per beat" />
          <FormControlLabel value="scenes" control={<Radio size="small" />} label="One scene per beat" />
        </RadioGroup>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        {STRUCTURE_TEMPLATES.map((t) => (
          <Card key={t.id} sx={{ display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <AccountTreeIcon color="primary" />
                <Typography variant="h6" component="h3">
                  {t.name}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t.description}
              </Typography>
              {t.acts.map((a) => (
                <Box key={a.title} sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {a.title}
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {a.beats.map((b) => (
                      <Chip key={b.title} size="small" label={b.title} title={b.synopsis} variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              ))}
            </CardContent>
            <CardActions>
              <Button variant="contained" onClick={() => void generate(t)}>
                Generate outline
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
