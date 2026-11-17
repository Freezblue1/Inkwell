import { useState } from 'react';
import { ButtonBase, InputBase, Tooltip, Typography } from '@mui/material';
import { useStore } from '@/store';

/** Project title in the app bar; click to rename inline. */
export function ProjectTitle() {
  const title = useStore((s) => s.project?.title ?? '');
  const updateProject = useStore((s) => s.updateProject);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  const commit = () => {
    const v = value.trim();
    if (v && v !== title) void updateProject({ title: v });
    setEditing(false);
  };

  if (editing) {
    return (
      <InputBase
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        inputProps={{ 'aria-label': 'Project title', maxLength: 120 }}
        sx={{ typography: 'h6', px: 1, borderRadius: 1, bgcolor: 'action.hover', minWidth: 160, maxWidth: 360 }}
      />
    );
  }

  return (
    <Tooltip title="Rename project">
      <ButtonBase
        onClick={() => {
          setValue(title);
          setEditing(true);
        }}
        sx={{ borderRadius: 1, px: 1, py: 0.25, maxWidth: { xs: 140, sm: 280, md: 360 }, '&:hover': { bgcolor: 'action.hover' } }}
        aria-label={`Project: ${title}. Click to rename.`}
      >
        <Typography variant="h6" noWrap component="h1" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
          {title}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}
