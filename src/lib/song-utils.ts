import { Song } from '../types';

export type YoutubeThumbnailSize = 'default' | 'mqdefault' | 'hqdefault' | 'sddefault' | 'maxresdefault';

export const getSongCoverUrl = (song: Song, size: YoutubeThumbnailSize = 'mqdefault') => {
  if (song.coverUrl) return song.coverUrl;
  if (song.thumbnailUrl) return song.thumbnailUrl;
  
  if (song.youtubeId || song.videoId) {
    const id = song.youtubeId || song.videoId;
    return `https://img.youtube.com/vi/${id}/${size}.jpg`;
  }
  
  // Fallback to a seeded placeholder if no cover or youtubeId
  return `https://picsum.photos/seed/${song.id || song.title}/400/400`;
};

export const getAudioUrl = (song: Song) => {
  if (song.audioUrl) return song.audioUrl;
  
  const videoId = song.youtubeId || song.videoId;
  if (videoId) {
    // Use the local proxy to handle extraction and CORS
    return `/api/extract?id=${videoId}&t=${Date.now()}`;
  }
  
  return null;
};
