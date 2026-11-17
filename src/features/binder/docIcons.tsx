import type { ReactElement } from 'react';
import type { InkDocument } from '@/types/models';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import FolderIcon from '@mui/icons-material/FolderOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import ArticleIcon from '@mui/icons-material/ArticleOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import StarIcon from '@mui/icons-material/StarOutline';
import BookmarkIcon from '@mui/icons-material/BookmarkBorder';
import FlagIcon from '@mui/icons-material/FlagOutlined';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import FavoriteIcon from '@mui/icons-material/FavoriteBorder';
import BoltIcon from '@mui/icons-material/BoltOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import PersonIcon from '@mui/icons-material/PersonOutline';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAddedOutlined';

export const CUSTOM_ICONS: Record<string, { label: string; el: ReactElement }> = {
  star: { label: 'Star', el: <StarIcon fontSize="inherit" /> },
  bookmark: { label: 'Bookmark', el: <BookmarkIcon fontSize="inherit" /> },
  flag: { label: 'Flag', el: <FlagIcon fontSize="inherit" /> },
  lightbulb: { label: 'Idea', el: <LightbulbIcon fontSize="inherit" /> },
  heart: { label: 'Heart', el: <FavoriteIcon fontSize="inherit" /> },
  bolt: { label: 'Action', el: <BoltIcon fontSize="inherit" /> },
  place: { label: 'Place', el: <PlaceIcon fontSize="inherit" /> },
  person: { label: 'Person', el: <PersonIcon fontSize="inherit" /> },
};

export const DOC_COLORS = ['#3949ab', '#00897b', '#f9a825', '#e53935', '#8e24aa', '#43a047', '#6d4c41', '#039be5'];

/** Icon for a binder document (custom icon, or by type). */
export function docIcon(doc: InkDocument, hasChildren: boolean): ReactElement {
  if (doc.metadata.icon && CUSTOM_ICONS[doc.metadata.icon]) return CUSTOM_ICONS[doc.metadata.icon].el;
  if (doc.metadata.special) return <BookmarkAddedIcon fontSize="inherit" />;
  switch (doc.type) {
    case 'part':
      return <AutoStoriesIcon fontSize="inherit" />;
    case 'chapter':
      return hasChildren ? <FolderIcon fontSize="inherit" /> : <MenuBookIcon fontSize="inherit" />;
    case 'scene':
      return <DescriptionIcon fontSize="inherit" />;
    case 'note':
      return hasChildren ? <FolderIcon fontSize="inherit" /> : <StickyNote2Icon fontSize="inherit" />;
    case 'research':
      switch (doc.metadata.researchKind) {
        case 'folder':
          return <FolderIcon fontSize="inherit" />;
        case 'link':
          return <LinkIcon fontSize="inherit" />;
        case 'image':
          return <ImageIcon fontSize="inherit" />;
        case 'pdf':
          return <PictureAsPdfIcon fontSize="inherit" />;
        default:
          return <StickyNote2Icon fontSize="inherit" />;
      }
    default:
      return hasChildren ? <FolderIcon fontSize="inherit" /> : <ArticleIcon fontSize="inherit" />;
  }
}
