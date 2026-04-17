import React from 'react';
import { Play, Heart } from 'lucide-react';
import { Song } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { motion } from 'motion/react';
import { getSongCoverUrl } from '../lib/song-utils';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

interface SongCardProps {
  song: Song;
}

const SongCard: React.FC<SongCardProps> = ({ song }) => {
  const { setCurrentSong, currentSong, isPlaying, favorites, toggleFavorite } = usePlayerStore();
  const isActive = currentSong?.id === song.id;
  const isFavorite = favorites.includes(song.id);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const user = auth.currentUser;
    if (!user) return;

    const likedRef = doc(db, 'users', user.uid, 'liked-songs', song.id);
    if (isFavorite) {
      await deleteDoc(likedRef);
    } else {
      await setDoc(likedRef, song);
    }
    toggleFavorite(song.id);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-all duration-300 group cursor-pointer border border-white/5"
      onClick={() => setCurrentSong(song)}
    >
      <div className="relative aspect-square mb-4 overflow-hidden rounded-lg shadow-xl">
        <img 
          src={getSongCoverUrl(song)} 
          alt={song.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 bg-[#ff4e00] rounded-full flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <Play size={24} fill="white" className="text-white ml-1" />
          </div>
        </div>
        
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-mono text-white opacity-90">
          {formatDuration(song.duration)}
        </div>

        <button 
          onClick={handleLike}
          className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition-all duration-300 ${
            isFavorite 
              ? "bg-[#ff4e00] text-white opacity-100" 
              : "bg-black/20 text-white opacity-0 group-hover:opacity-100 hover:bg-black/40"
          }`}
        >
          <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
        </button>

        {isActive && isPlaying && (
          <div className="absolute bottom-2 right-2 flex gap-0.5 items-end h-4">
            <div className="w-1 bg-[#ff4e00] animate-[bounce_0.6s_infinite]" />
            <div className="w-1 bg-[#ff4e00] animate-[bounce_0.8s_infinite]" />
            <div className="w-1 bg-[#ff4e00] animate-[bounce_0.5s_infinite]" />
          </div>
        )}
      </div>
      <h3 className="font-bold text-sm truncate mb-1">{song.title}</h3>
      <p className="text-xs text-zinc-400 truncate">{song.artist}</p>
    </motion.div>
  );
};

export default SongCard;
