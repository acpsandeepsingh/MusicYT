import React, { useState } from 'react';
import { X, Music2, Plus } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatePlaylistModal({ isOpen, onClose }: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError('You must be logged in to create a playlist');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'playlists'), {
        name,
        description,
        userId: auth.currentUser.uid,
        songs: [],
        createdAt: new Date().toISOString(),
        coverUrl: `https://picsum.photos/seed/${name}/400/400`
      });
      onClose();
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#ff4e00] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#ff4e00]/20">
              <Music2 className="text-white" size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tighter mb-2">Create Playlist</h2>
            <p className="text-zinc-400 text-sm">Give your playlist a name and description</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Playlist Name</label>
              <input 
                type="text"
                placeholder="My Awesome Playlist"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#ff4e00]/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Description (Optional)</label>
              <textarea 
                placeholder="What's this playlist about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-[#ff4e00]/50 transition-all"
              />
            </div>

            <button 
              disabled={loading}
              className="w-full py-4 bg-[#ff4e00] hover:bg-[#ff6a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-lg transition-all shadow-lg shadow-[#ff4e00]/20 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={20} />
                  Create Playlist
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
