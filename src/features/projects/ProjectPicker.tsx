import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import { useStore } from '@/store';
import { ProjectList } from './ProjectList';
import { NewProjectForm } from './NewProjectForm';

/** Project switcher dialog (open / new). */
export default function ProjectPicker() {
  const close = useStore((s) => s.closeDialog);
  const goHome = useStore((s) => s.goHome);
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const done = () => close('projects');

  return (
    <Dialog open onClose={done} maxWidth="md" fullWidth fullScreen={fullScreen} aria-labelledby="projects-title">
      <DialogTitle id="projects-title">Projects</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Open" />
        <Tab label="New project" />
      </Tabs>
      <DialogContent sx={{ minHeight: 360 }}>
        <Box sx={{ pt: 1 }}>{tab === 0 ? <ProjectList onOpened={done} /> : <NewProjectForm onCreated={done} />}</Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" startIcon={<HomeIcon />} onClick={() => void goHome()}>
          Go to Home
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={done}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
