export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  thumbnailUrl?: string;
  youtubeId?: string;
  videoId?: string;
  genre?: string;
  year?: number;
  search_keywords?: string[];
  title_keywords?: string[];
  title_lowercase?: string;
  audioUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  songs: Song[]; // Array of song objects
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
