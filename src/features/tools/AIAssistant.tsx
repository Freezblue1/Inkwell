import { useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Drawer,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { useStore } from '@/store';
import type { AIProvider } from '@/types/models';
import { getContent } from '@/db/repos/documents';
import { flushAll } from '@/features/editor/autosave';
import { createAIClient, SYSTEM_PROMPT } from './ai';

type Mode = 'brainstorm' | 'summarize' | 'rewrite';

/**
 * Optional AI assistant, clearly separated from the rest of the app.
 * Nothing is sent anywhere unless you enable it, add your own key and press a button.
 */
export default function AIAssistant() {
  const close = () => useStore.getState().closeDialog('ai');
  const ai = useStore((s) => s.settings.ai);
  const updateSettings = useStore((s) => s.updateSettings);
  const docId = useStore((s) => s.activeEditorDocId ?? s.activeDocId);
  const doc = useStore((s) => (docId ? s.docs[docId] : null));
  const editor = useStore((s) => s.activeEditor);
  const [mode, setMode] = useState<Mode>(editor && !editor.state.selection.empty ? 'rewrite' : 'brainstorm');
  const [input, setInput] = useState(mode === 'rewrite' ? 'Tighten this passage and make the verbs more vivid.' : '');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const selRange = useRef<{ from: number; to: number } | null>(editor && !editor.state.selection.empty ? { from: editor.state.selection.from, to: editor.state.selection.to } : null);

  const setAI = (patch: Partial<typeof ai>) => updateSettings({ ai: { ...ai, ...patch } });

  const run = async () => {
    setError('');
    setOutput('');
    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const client = createAIClient(ai);
      const s = useStore.getState();
      let prompt = '';
      if (mode === 'brainstorm') {
        const cast = s.bible
          .filter((b) => b.kind === 'character')
          .slice(0, 12)
          .map((b) => `- ${b.name}: ${b.summary}`)
          .join('\n');
        prompt = `Project: “${s.project?.title}”.\nCharacters:\n${cast || '(none yet)'}\n${doc ? `Current scene: “${doc.title}” — ${doc.synopsis || 'no synopsis'}\n` : ''}\nBrainstorm request: ${input || 'Suggest five surprising directions for what could happen next.'}\nReply with a short numbered list.`;
      } else if (mode === 'summarize') {
        if (!docId) throw new Error('Open a scene to summarize.');
        await flushAll();
        const text = (await getContent(docId))?.text ?? '';
        if (!text.trim()) throw new Error('This document is empty.');
        prompt = `Summarize this scene in two or three sentences for an index card (present tense, no spoilers beyond the scene):\n\n${text.slice(0, 24000)}`;
      } else {
        if (!editor || !selRange.current) throw new Error('Select some text in the editor first.');
        const passage = editor.state.doc.textBetween(selRange.current.from, selRange.current.to, '\n\n', ' ');
        prompt = `Rewrite the passage below. Instruction: ${input || 'improve clarity and rhythm'}.\nReturn only the rewritten passage.\n\n---\n${passage}`;
      }
      const text = await client.complete({ system: SYSTEM_PROMPT, prompt, maxTokens: mode === 'brainstorm' ? 900 : 1200 }, abortRef.current.signal);
      setOutput(text);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const applyRewrite = () => {
    if (!editor || editor.isDestroyed || !selRange.current) return;
    const paras = output.split(/\n{2,}/).map((p) => ({ type: 'paragraph', content: p.trim() ? [{ type: 'text', text: p.trim() }] : [] }));
    editor.chain().focus().insertContentAt(selRange.current, paras.length === 1 ? output.trim() : paras).run();
    useStore.getState().notify('Selection replaced (Ctrl+Z to undo)');
    close();
  };

  return (
    <Drawer anchor="right" open onClose={close} PaperProps={{ sx: { width: { xs: '100vw', sm: 440 } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 1.5 }} spacing={1}>
        <AutoAwesomeIcon color="secondary" />
        <Typography variant="h6" sx={{ flex: 1 }}>
          AI assistant
        </Typography>
        <IconButton aria-label="Close" onClick={close}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ p: 2, overflowY: 'auto' }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Optional and off by default. When you press a button, the relevant text is sent to the provider you choose, using your own key. Inkwell itself has no server.
        </Alert>
        <Accordion defaultExpanded={!ai.enabled || !ai.apiKey} disableGutters variant="outlined" sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Provider settings</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <FormControlLabel control={<Switch checked={ai.enabled} onChange={(e) => setAI({ enabled: e.target.checked })} />} label="Enable AI assistant" />
              <TextField
                select
                label="Provider"
                value={ai.provider}
                onChange={(e) => {
                  const provider = e.target.value as AIProvider;
                  setAI({ provider, model: provider === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-4o-mini', baseUrl: '' });
                }}
              >
                <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
                <MenuItem value="openai-compatible">OpenAI-compatible (OpenAI, OpenRouter, local LLM…)</MenuItem>
              </TextField>
              <TextField label="API key" type="password" autoComplete="off" value={ai.apiKey} onChange={(e) => setAI({ apiKey: e.target.value.trim() })} helperText="Stored only in this browser’s IndexedDB." />
              <TextField label="Model" value={ai.model} onChange={(e) => setAI({ model: e.target.value })} />
              <TextField label="Base URL (optional)" value={ai.baseUrl} placeholder={ai.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'} onChange={(e) => setAI({ baseUrl: e.target.value.trim() })} />
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Tabs value={mode} onChange={(_, v) => setMode(v)} variant="fullWidth" sx={{ mb: 2 }}>
          <Tab value="brainstorm" label="Brainstorm" />
          <Tab value="summarize" label="Summarize" />
          <Tab value="rewrite" label="Rewrite" />
        </Tabs>
        <Stack spacing={2}>
          {mode === 'brainstorm' && <TextField label="What do you need ideas for?" multiline minRows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. ways Mara could get into the clock tower" />}
          {mode === 'summarize' && <Typography variant="body2">Summarize “{doc?.title ?? 'the current document'}” into an index-card synopsis.</Typography>}
          {mode === 'rewrite' && (
            <>
              <Typography variant="body2" color={selRange.current ? 'text.primary' : 'error'}>
                {selRange.current ? 'Rewrites the text you selected in the editor.' : 'Select a passage in the editor, then reopen the assistant.'}
              </Typography>
              <TextField label="Instruction" value={input} onChange={(e) => setInput(e.target.value)} multiline minRows={2} />
            </>
          )}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => void run()} disabled={busy || !ai.enabled || !ai.apiKey}>
              {mode === 'brainstorm' ? 'Brainstorm' : mode === 'summarize' ? 'Summarize' : 'Rewrite'}
            </Button>
            {busy && <Button onClick={() => abortRef.current?.abort()}>Stop</Button>}
          </Stack>
          {!ai.enabled && <Typography variant="caption" color="text.secondary">Enable the assistant and add a key to use it.</Typography>}
          {busy && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
          {output && (
            <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: '"Literata", serif', fontSize: 15 }}>
              {output}
            </Paper>
          )}
          {output && mode === 'summarize' && docId && (
            <Button
              onClick={() => {
                void useStore.getState().updateDoc(docId, { synopsis: output });
                useStore.getState().notify('Synopsis updated');
              }}
            >
              Use as synopsis
            </Button>
          )}
          {output && mode === 'rewrite' && <Button onClick={applyRewrite}>Replace selection</Button>}
          {output && (
            <Button color="inherit" onClick={() => void navigator.clipboard?.writeText(output)}>
              Copy
            </Button>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
