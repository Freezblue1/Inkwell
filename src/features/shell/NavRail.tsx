import { Box, ButtonBase, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import { useStore } from '@/store';
import { NAV_ITEMS } from './navigation';

/** Material 3 navigation rail with the six main sections. */
export function NavRail() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const toggleDialog = useStore((s) => s.toggleDialog);
  const openDialog = useStore((s) => s.openDialog);

  return (
    <Box
      component="nav"
      aria-label="Main sections"
      sx={{
        width: 84,
        flex: '0 0 84px',
        borderRight: 1,
        borderColor: 'divider',
        // Illustrated themes: bamboo, bookshelves, bubbles…
        background: (t) => t.inkwell.rail ?? t.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1,
        gap: 0.5,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const selected = view === item.view;
        return (
          <Tooltip key={item.view} title={`${item.label} (${item.shortcut})`} placement="right">
            <ButtonBase
              onClick={() => setView(item.view)}
              aria-current={selected ? 'page' : undefined}
              sx={{ flexDirection: 'column', width: 76, py: 0.75, borderRadius: 2, gap: 0.25 }}
            >
              <Box
                sx={(t) => ({
                  width: 56,
                  height: 32,
                  borderRadius: 4,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: selected ? alpha(t.palette.secondary.main, t.palette.mode === 'dark' ? 0.24 : 0.18) : 'transparent',
                  color: selected ? 'text.primary' : 'text.secondary',
                  transition: 'background-color 150ms',
                  '.MuiButtonBase-root:hover &': { bgcolor: selected ? undefined : 'action.hover' },
                })}
              >
                {item.icon}
              </Box>
              <Typography variant="caption" sx={{ fontWeight: selected ? 700 : 500, lineHeight: 1.2, textAlign: 'center' }} color={selected ? 'text.primary' : 'text.secondary'}>
                {item.shortLabel}
              </Typography>
            </ButtonBase>
          </Tooltip>
        );
      })}
      <Box sx={{ flex: 1 }} />
      <Divider flexItem sx={{ mx: 2 }} />
      <Tooltip title="Scratchpad (Ctrl+.)" placement="right">
        <IconButton onClick={() => toggleDialog('scratchpad')} aria-label="Toggle scratchpad">
          <StickyNote2Icon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Settings" placement="right">
        <IconButton onClick={() => openDialog('settings')} aria-label="Open settings">
          <SettingsIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
