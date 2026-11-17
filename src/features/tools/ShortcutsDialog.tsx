import { Box, Dialog, DialogContent, DialogTitle, IconButton, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '@/store';
import { SHORTCUTS } from './shortcuts';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function Keys({ combo }: { combo: string }) {
  const label = combo.replace(/Mod/g, isMac ? '⌘' : 'Ctrl').replace(/Alt/g, isMac ? '⌥' : 'Alt');
  return (
    <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12, px: 0.75, py: 0.25, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
      {label}
    </Box>
  );
}

/** Keyboard shortcut cheat sheet (press ?). */
export default function ShortcutsDialog() {
  const close = () => useStore.getState().closeDialog('shortcuts');
  return (
    <Dialog open onClose={close} maxWidth="md" fullWidth aria-labelledby="shortcuts-title">
      <DialogTitle id="shortcuts-title" sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>Keyboard shortcuts</Box>
        <IconButton aria-label="Close" onClick={close}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {SHORTCUTS.map((g) => (
            <Box key={g.title}>
              <Typography variant="subtitle2" gutterBottom>
                {g.title}
              </Typography>
              <Table size="small">
                <TableBody>
                  {g.items.map(([k, a]) => (
                    <TableRow key={k}>
                      <TableCell sx={{ width: '42%', pl: 0 }}>
                        <Keys combo={k} />
                      </TableCell>
                      <TableCell sx={{ pr: 0 }}>{a}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
