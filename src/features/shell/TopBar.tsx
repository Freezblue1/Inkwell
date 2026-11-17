import { useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  ButtonBase,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderOpenIcon from '@mui/icons-material/FolderOpenOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import InsightsIcon from '@mui/icons-material/InsightsOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import KeyboardIcon from '@mui/icons-material/KeyboardOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import ForestIcon from '@mui/icons-material/ForestOutlined';
import WavesIcon from '@mui/icons-material/Waves';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunchOutlined';
import LocalLibraryIcon from '@mui/icons-material/LocalLibraryOutlined';
import LocalFloristIcon from '@mui/icons-material/LocalFloristOutlined';
import { SCENE_LIST, type SceneId } from '@/theme/scenes';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import { usePwa } from '@/features/pwa/pwaStore';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { manuscriptWordCount } from '@/lib/tree';
import { dayKey } from '@/lib/dates';
import { SaveIndicator } from './SaveIndicator';
import { ProjectTitle } from './ProjectTitle';
import type { ThemeMode } from '@/types/models';

export const SCENE_ICONS: Record<SceneId, typeof ForestIcon> = {
  jungle: ForestIcon,
  ocean: WavesIcon,
  space: RocketLaunchIcon,
  library: LocalLibraryIcon,
  sakura: LocalFloristIcon,
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

/** Top app bar: project, save status, search, word count, theme and focus mode. */
export function TopBar() {
  const layout = useLayoutMode();
  const view = useStore((s) => s.view);
  const docs = useStore((s) => s.docs);
  const goal = useStore((s) => s.goal);
  const sessions = useStore((s) => s.sessions);
  const sessionStart = useStore((s) => s.sessionStartWords);
  const project = useStore((s) => s.project);
  const activeDocId = useStore((s) => s.activeDocId);
  const themeMode = useStore((s) => s.settings.themeMode);
  const updateSettings = useStore((s) => s.updateSettings);
  const openDialog = useStore((s) => s.openDialog);
  const setFocusMode = useStore((s) => s.setFocusMode);
  const setBinderDrawer = useStore((s) => s.setBinderDrawer);
  const online = usePwa((s) => s.online);
  const canInstall = usePwa((s) => !!s.installEvent);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);

  const total = useMemo(() => manuscriptWordCount(docs), [docs]);
  const today = sessions.find((s) => s.date === dayKey())?.net ?? 0;
  const sessionWords = sessionStart === null ? 0 : total - sessionStart;
  const pct = goal?.targetWords ? Math.min(100, Math.round((total / goal.targetWords) * 100)) : null;

  const ThemeIcon = themeMode === 'light' ? LightModeIcon : themeMode === 'dark' ? DarkModeIcon : themeMode === 'system' ? SettingsBrightnessIcon : SCENE_ICONS[themeMode as SceneId] ?? SettingsBrightnessIcon;
  const setTheme = (m: ThemeMode) => {
    updateSettings({ themeMode: m });
    setThemeAnchor(null);
  };

  const menuAction = (fn: () => void) => () => {
    setMoreAnchor(null);
    fn();
  };

  return (
    <AppBar position="static" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', pt: 'env(safe-area-inset-top)' }}>
      <Toolbar sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
        {layout !== 'desktop' && view === 'write' && (
          <IconButton edge="start" aria-label="Open binder" onClick={() => setBinderDrawer(true)}>
            <MenuIcon />
          </IconButton>
        )}
        <Tooltip title={`Home — all projects (${MOD}+Alt+H)`}>
          <IconButton aria-label="Home (all projects)" onClick={() => void useStore.getState().goHome()} edge={layout === 'desktop' || view !== 'write' ? 'start' : undefined}>
            <HomeIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Switch project">
          <Avatar
            component="button"
            onClick={() => openDialog('projects')}
            aria-label="Switch project"
            sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 16, border: 0, cursor: 'pointer' }}
          >
            {(project?.title ?? 'I').charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
        <ProjectTitle />
        {layout !== 'mobile' && <SaveIndicator />}
        {!online && (
          <Tooltip title="You’re offline. Inkwell keeps working and saving on this device; only dictionary lookups and the AI assistant need a connection.">
            <Chip size="small" icon={<CloudOffIcon />} label="Offline" variant="outlined" />
          </Tooltip>
        )}

        <Box sx={{ flex: 1 }} />

        {layout === 'mobile' ? (
          <IconButton aria-label="Search and commands" onClick={() => openDialog('palette')}>
            <SearchIcon />
          </IconButton>
        ) : (
          <ButtonBase
            onClick={() => openDialog('palette')}
            aria-label={`Search or run a command (${MOD}+K)`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              height: 36,
              minWidth: { sm: 180, md: 280 },
              borderRadius: 18,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              justifyContent: 'flex-start',
            }}
          >
            <SearchIcon fontSize="small" />
            <Typography variant="body2" sx={{ flex: 1, textAlign: 'left' }}>
              Search or jump to…
            </Typography>
            <Typography variant="caption" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: 0.5 }}>
              {MOD} K
            </Typography>
          </ButtonBase>
        )}

        {layout !== 'mobile' && (
          <Tooltip title="Search the whole project (Ctrl+Shift+F)">
            <IconButton aria-label="Project search" onClick={() => openDialog('search')}>
              <ManageSearchIcon />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip
          title={
            <Box>
              <div>Manuscript: {total.toLocaleString()} words</div>
              <div>Today: {today.toLocaleString()} · This session: {sessionWords.toLocaleString()}</div>
              {pct !== null && <div>{pct}% of {goal!.targetWords.toLocaleString()}</div>}
            </Box>
          }
        >
          <Chip
            label={layout === 'mobile' ? `${(total / 1000).toFixed(1)}k` : `${total.toLocaleString()} words`}
            color="secondary"
            variant="outlined"
            onClick={() => useStore.getState().setView('goals')}
            aria-label={`${total} words in manuscript. Open goals.`}
          />
        </Tooltip>

        <Tooltip title="Theme">
          <IconButton aria-label="Change theme" onClick={(e) => setThemeAnchor(e.currentTarget)}>
            <ThemeIcon />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={themeAnchor} open={!!themeAnchor} onClose={() => setThemeAnchor(null)}>
          <MenuItem selected={themeMode === 'light'} onClick={() => setTheme('light')}>
            <ListItemIcon>
              <LightModeIcon fontSize="small" />
            </ListItemIcon>
            Light
          </MenuItem>
          <MenuItem selected={themeMode === 'dark'} onClick={() => setTheme('dark')}>
            <ListItemIcon>
              <DarkModeIcon fontSize="small" />
            </ListItemIcon>
            Dark
          </MenuItem>
          <MenuItem selected={themeMode === 'system'} onClick={() => setTheme('system')}>
            <ListItemIcon>
              <SettingsBrightnessIcon fontSize="small" />
            </ListItemIcon>
            Match system
          </MenuItem>
          <Divider />
          {SCENE_LIST.map((sc) => {
            const Icon = SCENE_ICONS[sc.id];
            return (
              <MenuItem key={sc.id} selected={themeMode === sc.id} onClick={() => setTheme(sc.id)}>
                <ListItemIcon>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={sc.name} secondary={sc.tagline} />
              </MenuItem>
            );
          })}
        </Menu>

        {layout !== 'mobile' && (
          <Tooltip title="Focus mode (Ctrl+Shift+Enter)">
            <span>
              <IconButton aria-label="Enter focus mode" onClick={() => setFocusMode(true)} disabled={!activeDocId}>
                <CenterFocusStrongIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}

        <IconButton aria-label="More tools" onClick={(e) => setMoreAnchor(e.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
          <MenuItem onClick={menuAction(() => void useStore.getState().goHome())}>
            <ListItemIcon>
              <HomeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Home</ListItemText>
          </MenuItem>
          <MenuItem onClick={menuAction(() => openDialog('projects'))}>
            <ListItemIcon>
              <FolderOpenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Projects…</ListItemText>
          </MenuItem>
          <MenuItem onClick={menuAction(() => openDialog('scratchpad'))}>
            <ListItemIcon>
              <StickyNote2Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Scratchpad</ListItemText>
          </MenuItem>
          <MenuItem onClick={menuAction(() => openDialog('nameGen'))}>
            <ListItemIcon>
              <BadgeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Name generator</ListItemText>
          </MenuItem>
          <MenuItem onClick={menuAction(() => openDialog('analysis'))}>
            <ListItemIcon>
              <InsightsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Writing analysis</ListItemText>
          </MenuItem>
          <MenuItem onClick={menuAction(() => openDialog('ai'))}>
            <ListItemIcon>
              <AutoAwesomeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>AI assistant (optional)</ListItemText>
          </MenuItem>
          <Divider />
          {canInstall && (
            <MenuItem onClick={menuAction(() => void usePwa.getState().install())}>
              <ListItemIcon>
                <InstallDesktopIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Install Inkwell app</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={menuAction(() => openDialog('shortcuts'))}>
            <ListItemIcon>
              <KeyboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Keyboard shortcuts</ListItemText>
            <Typography variant="caption" color="text.secondary">
              ?
            </Typography>
          </MenuItem>
          <MenuItem onClick={menuAction(() => openDialog('settings'))}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
