/** Combined store type. Each slice lives in its own file. */
import type { StateCreator } from 'zustand';
import type { ProjectSlice } from './projectSlice';
import type { StorySlice } from './storySlice';
import type { EditorSlice } from './editorSlice';
import type { UISlice } from './uiSlice';
import type { GoalsSlice } from './goalsSlice';

export type AppState = ProjectSlice & StorySlice & EditorSlice & UISlice & GoalsSlice;

export type SliceCreator<T> = StateCreator<AppState, [], [], T>;
