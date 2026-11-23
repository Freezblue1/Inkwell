import { useRef, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemText, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import CasinoIcon from '@mui/icons-material/CasinoOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useStore } from '@/store';
import { generateNameDetails, NAME_AGE_LABELS, NAME_STYLE_LABELS, NAME_STYLES, type NameAge, type NameGender, type NameStyle } from '@/lib/names';

const PREFS_KEY = 'inkwell:nameGenerator';

interface Prefs {
  style: NameStyle;
  gender: NameGender;
  age: NameAge;
}

function loadPrefs(): Prefs {
  const fallback: Prefs = { style: 'english', gender: 'any', age: 'any' };
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      style: NAME_STYLE_LABELS.some(([k]) => k === p.style) ? p.style : fallback.style,
      gender: ['any', 'feminine', 'masculine'].includes(p.gender) ? p.gender : fallback.gender,
      age: p.age in NAME_AGE_LABELS ? p.age : fallback.age,
    };
  } catch {
    return fallback;
  }
}

/** Character name generator; add a name straight to the story bible. */
export default function NameGenerator() {
  const close = () => useStore.getState().closeDialog('nameGen');
  const [prefs, setPrefs] = useState(loadPrefs);
  const recent = useRef(new Set<string>());
  const roll = (p: Prefs) => generateNameDetails({ ...p, recent: recent.current });
  const [names, setNames] = useState(() => roll(prefs));
  const { style, gender, age } = prefs;
  const showOrigin = style !== 'fantasy' && NAME_STYLES[style].regions.length > 1;

  /** Changing an option re-rolls straight away. */
  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setNames(roll(next));
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby="names-title">
      <DialogTitle id="names-title">Name generator</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ my: 1 }}>
          <TextField select size="small" label="Style" value={style} onChange={(e) => update({ style: e.target.value as NameStyle })} sx={{ flex: 1, minWidth: 0 }}>
            {NAME_STYLE_LABELS.map(([k, label]) => (
              <MenuItem key={k} value={k}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Names" value={gender} onChange={(e) => update({ gender: e.target.value as NameGender })} sx={{ minWidth: 130 }}>
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="feminine">Feminine</MenuItem>
            <MenuItem value="masculine">Masculine</MenuItem>
          </TextField>
          <TextField select size="small" label="Age" value={age} onChange={(e) => update({ age: e.target.value as NameAge })} sx={{ minWidth: 140 }}>
            {(Object.entries(NAME_AGE_LABELS) as [NameAge, string][]).map(([k, label]) => (
              <MenuItem key={k} value={k}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
          <Button variant="contained" startIcon={<CasinoIcon />} onClick={() => setNames(roll(prefs))} sx={{ flexShrink: 0 }}>
            More names
          </Button>
          {age !== 'any' && (
            <Typography variant="caption" color="text.secondary">
              {style === 'fantasy' ? 'Younger fantasy names are shorter; older ones are longer and grander.' : 'Names that were popular when someone this age was born.'}
            </Typography>
          )}
        </Stack>
        <List dense aria-label="Generated names" sx={{ columns: { sm: 2 } }}>
          {names.map(({ name: n, origin }) => (
            <ListItem
              key={n}
              sx={{ breakInside: 'avoid' }}
              secondaryAction={
                <Box>
                  <Tooltip title="Copy">
                    <IconButton size="small" aria-label={`Copy ${n}`} onClick={() => void navigator.clipboard?.writeText(n)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Add as character">
                    <IconButton
                      size="small"
                      aria-label={`Add ${n} as character`}
                      onClick={async () => {
                        const e = await useStore.getState().createBibleEntry('character', { name: n });
                        useStore.getState().notify(`Added ${n} to the story bible`, 'success', { label: 'Open', run: () => useStore.getState().openBibleEntry(e.id) });
                      }}
                    >
                      <PersonAddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            >
              <ListItemText primary={n} secondary={showOrigin ? origin : undefined} />
            </ListItem>
          ))}
        </List>
        <Chip size="small" label="Works offline" variant="outlined" />
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
