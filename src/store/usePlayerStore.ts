import { create } from 'zustand';
import { Song } from '../types';

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  queue: Song[];
  currentIndex: number;
  progress: number;
  duration: number;
  player: any | null; // YouTube player instance
  searchQuery: string;
  favorites: string[]; // Array of song IDs
  activeView: 'home' | 'search' | 'library' | 'playlist';
  selectedPlaylistId: string | null;
  sidebarCollapsed: boolean;
  playerMode: 'audio' | 'video';
  playerType: 'youtube' | 'audio';
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  setPlayerType: (type: 'youtube' | 'audio') => void;

  setCurrentSong: (song: Song) => void;
  playWithQueue: (song: Song, newQueue: Song[]) => void;
  setQueue: (songs: Song[]) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
  seek: (position: number) => void;
  updateProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setPlayer: (player: any) => void;
  setSearchQuery: (query: string) => void;
  toggleFavorite: (songId: string) => void;
  setActiveView: (view: 'home' | 'search' | 'library' | 'playlist', playlistId?: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setPlayerMode: (mode: 'audio' | 'video') => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  volume: 0.5,
  queue: [],
  currentIndex: -1,
  progress: 0,
  duration: 0,
  player: null,
  searchQuery: '',
  favorites: [],
  activeView: 'home',
  selectedPlaylistId: null,
  sidebarCollapsed: false,
  playerMode: 'audio',
  playerType: 'youtube',
  toast: null,

  showToast: (message: string, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => get().hideToast(), 3000);
  },

  hideToast: () => {
    set({ toast: null });
  },

  setCurrentSong: (song: Song) => {
    const { queue } = get();
    let index = queue.findIndex(s => s.id === song.id);
    
    // If not in queue, add it to the start of the remaining queue
    if (index === -1) {
      const { currentIndex } = get();
      const newQueue = [...queue];
      newQueue.splice(currentIndex + 1, 0, song);
      set({ queue: newQueue, currentIndex: currentIndex + 1 });
      index = currentIndex + 1;
    }

    set({ 
      currentSong: song, 
      currentIndex: index,
      isPlaying: true,
      progress: 0
    });
  },

  playWithQueue: (song: Song, newQueue: Song[]) => {
    const index = newQueue.findIndex(s => s.id === song.id);
    set({ 
      queue: newQueue,
      currentIndex: index !== -1 ? index : 0,
      currentSong: song,
      isPlaying: true,
      progress: 0
    });
  },

  setQueue: (songs: Song[]) => {
    set({ queue: songs });
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  setVolume: (volume: number) => {
    set({ volume });
  },

  next: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    
    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = 0;
    } else {
      nextIndex = (currentIndex + 1) % queue.length;
    }
    
    const nextSong = queue[nextIndex];
    set({ currentIndex: nextIndex, currentSong: nextSong, isPlaying: true, progress: 0 });
  },

  previous: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    
    let prevIndex;
    if (currentIndex <= 0) {
      prevIndex = queue.length - 1;
    } else {
      prevIndex = currentIndex - 1;
    }
    
    const prevSong = queue[prevIndex];
    set({ currentIndex: prevIndex, currentSong: prevSong, isPlaying: true, progress: 0 });
  },

  seek: (position: number) => {
    set({ progress: position });
  },

  updateProgress: (progress: number) => {
    set({ progress });
  },

  setDuration: (duration: number) => {
    set({ duration });
  },

  setPlayer: (player: any) => {
    set({ player });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  toggleFavorite: (songId: string) => {
    set((state) => ({
      favorites: state.favorites.includes(songId)
        ? state.favorites.filter(id => id !== songId)
        : [...state.favorites, songId]
    }));
  },

  setActiveView: (view, playlistId = null) => {
    set({ activeView: view, selectedPlaylistId: playlistId });
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
  },

  setPlayerMode: (mode: 'audio' | 'video') => {
    set({ playerMode: mode });
  },
  
  setPlayerType: (type: 'youtube' | 'audio') => {
    set({ playerType: type });
  },
}));
