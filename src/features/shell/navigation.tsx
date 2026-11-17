import EditNoteIcon from '@mui/icons-material/EditNote';
import ViewQuiltIcon from '@mui/icons-material/ViewQuiltOutlined';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooksOutlined';
import FlagIcon from '@mui/icons-material/FlagOutlined';
import IosShareIcon from '@mui/icons-material/IosShare';
import HistoryIcon from '@mui/icons-material/History';
import type { ReactNode } from 'react';
import type { View } from '@/store/uiSlice';

export interface NavItem {
  view: View;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  shortcut: string;
}

/** Main sections (left rail on desktop/tablet, bottom bar on mobile). */
export const NAV_ITEMS: NavItem[] = [
  { view: 'write', label: 'Write', shortLabel: 'Write', icon: <EditNoteIcon />, shortcut: 'Alt+1' },
  { view: 'plan', label: 'Plan', shortLabel: 'Plan', icon: <ViewQuiltIcon />, shortcut: 'Alt+2' },
  { view: 'research', label: 'Research', shortLabel: 'Research', icon: <LibraryBooksIcon />, shortcut: 'Alt+3' },
  { view: 'goals', label: 'Goals', shortLabel: 'Goals', icon: <FlagIcon />, shortcut: 'Alt+4' },
  { view: 'export', label: 'Format & Export', shortLabel: 'Export', icon: <IosShareIcon />, shortcut: 'Alt+5' },
  { view: 'history', label: 'History', shortLabel: 'History', icon: <HistoryIcon />, shortcut: 'Alt+6' },
];
