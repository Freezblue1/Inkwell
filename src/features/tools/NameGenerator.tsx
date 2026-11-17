import { useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemText, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import CasinoIcon from '@mui/icons-material/CasinoOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useStore } from '@/store';
import { generateNames, NAME_STYLES, type NameGender, type NameStyle } from '@/lib/names';

/** Character name generator; add a name straight to the story bible. */
export default function NameGenerator() {
  const close = () => useStore.getState().closeDialog('nameGen');
  const [style, setStyle] = useState<NameStyle>('english');
  const [gender, setGender] = useState<NameGender>('any');
  const [names, setNames] = useState(() => generateNames('english', 'any'));

  const roll = () => setNames(generateNames(style, gender));

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby="names-title">
      <DialogTitle id="names-title">Name generator</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ my: 1 }}>
          <TextField select label="Style" value={style} onChange={(e) => setStyle(e.target.value as NameStyle)} fullWidth>
            {Object.entries(NAME_STYLES).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v.label}
              </MenuItem>
            ))}
            <MenuItem value="fantasy">Fantasy (invented)</MenuItem>
          </TextField>
          <TextField select label="Names" value={gender} onChange={(e) => setGender(e.target.value as NameGender)} sx={{ minWidth: 160 }}>
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="feminine">Feminine</MenuItem>
            <MenuItem value="masculine">Masculine</MenuItem>
          </TextField>
          <Button variant="contained" startIcon={<CasinoIcon />} onClick={roll} sx={{ flexShrink: 0 }}>
            Generate
          </Button>
        </Stack>
        <List dense aria-label="Generated names" sx={{ columns: { sm: 2 } }}>
          {names.map((n) => (
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
              <ListItemText primary={n} />
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
