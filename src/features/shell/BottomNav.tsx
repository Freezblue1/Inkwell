import { useState } from 'react';
import { BottomNavigation, BottomNavigationAction, Menu, MenuItem, ListItemIcon, Paper } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useStore } from '@/store';
import { NAV_ITEMS } from './navigation';

const PRIMARY = ['write', 'plan', 'goals', 'export'];

/** Mobile bottom navigation: four main sections plus a "More" menu. */
export function BottomNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const primary = NAV_ITEMS.filter((i) => PRIMARY.includes(i.view));
  const more = NAV_ITEMS.filter((i) => !PRIMARY.includes(i.view));
  const value = PRIMARY.includes(view) ? view : 'more';

  return (
    <Paper component="nav" aria-label="Main sections" elevation={3} sx={{ borderRadius: 0, pb: 'env(safe-area-inset-bottom)' }}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={(e, v) => {
          if (v === 'more') setAnchor(e.currentTarget as HTMLElement);
          else setView(v);
        }}
      >
        {primary.map((i) => (
          <BottomNavigationAction key={i.view} value={i.view} label={i.shortLabel} icon={i.icon} />
        ))}
        <BottomNavigationAction value="more" label="More" icon={<MoreHorizIcon />} />
      </BottomNavigation>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {more.map((i) => (
          <MenuItem
            key={i.view}
            selected={view === i.view}
            onClick={() => {
              setView(i.view);
              setAnchor(null);
            }}
          >
            <ListItemIcon>{i.icon}</ListItemIcon>
            {i.label}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}
