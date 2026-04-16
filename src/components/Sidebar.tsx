import React, { useState, useEffect } from 'react';
import { Home, Search, Library, PlusCircle, Heart, Music2, ListMusic, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CreatePlaylistModal from './CreatePlaylistModal';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Playlist } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ icon: Icon, label, active = false, onClick, collapsed = false }: { icon: any, label: string, active?: boolean, onClick?: () => void, collapsed?: boolean, key?: any }) => (
  <div 
    onClick={onClick}
    className={cn(
      "flex items-center gap-4 px-4 py-3 cursor-pointer rounded-xl transition-all duration-300 group relative",
      active ? "text-white bg-white/10 shadow-lg shadow-black/20" : "text-zinc-400 hover:text-white hover:bg-white/5",
      collapsed && "justify-center px-0"
    )}
  >
    <Icon size={24} className={cn("transition-transform duration-300 group-hover:scale-110 shrink-0", active && "text-[#ff4e00]")} />
    {!collapsed && <span className="font-medium truncate">{label}</span>}
    {collapsed && (
      <div className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
        {label}
      </div>
    )}
  </div>
);

export default function Sidebar() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const { activeView, setActiveView, selectedPlaylistId, sidebarCollapsed, setSidebarCollapsed } = usePlayerStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(collection(db, 'users', user.uid, 'playlists'));
        const unsubscribePlaylists = onSnapshot(q, (snapshot) => {
          const fetchedPlaylists = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Playlist));
          setPlaylists(fetchedPlaylists);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/playlists`);
        });
        return () => unsubscribePlaylists();
      } else {
        setPlaylists([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-xl border-t border-white/5 z-[60] flex items-center justify-around px-4">
        <button onClick={() => setActiveView('home')} className={cn("p-2", activeView === 'home' ? "text-[#ff4e00]" : "text-zinc-400")}>
          <Home size={24} />
        </button>
        <button onClick={() => setActiveView('search')} className={cn("p-2", activeView === 'search' ? "text-[#ff4e00]" : "text-zinc-400")}>
          <Search size={24} />
        </button>
        <button onClick={() => setActiveView('library')} className={cn("p-2", activeView === 'library' ? "text-[#ff4e00]" : "text-zinc-400")}>
          <Library size={24} />
        </button>
        <button onClick={() => setActiveView('playlist', 'liked')} className={cn("p-2", activeView === 'playlist' && selectedPlaylistId === 'liked' ? "text-[#ff4e00]" : "text-zinc-400")}>
          <Heart size={24} />
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={false}
      animate={{ width: sidebarCollapsed ? 80 : 260 }}
      className="h-full bg-black/40 backdrop-blur-md border-r border-white/5 flex flex-col p-4 gap-6 relative group/sidebar overflow-y-auto scrollbar-hide"
    >
      <button 
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-[#ff4e00] rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover/sidebar:opacity-100 transition-opacity z-50"
      >
        {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={cn("flex items-center gap-3 px-4 py-2 cursor-pointer", sidebarCollapsed && "justify-center px-0")} onClick={() => setActiveView('home')}>
        <div className="w-10 h-10 bg-[#ff4e00] rounded-xl flex items-center justify-center shadow-lg shadow-[#ff4e00]/20 shrink-0">
          <Music2 className="text-white" size={24} />
        </div>
        {!sidebarCollapsed && <h1 className="text-xl font-bold tracking-tight">Harmony</h1>}
      </div>

      <nav className="flex flex-col gap-1">
        <SidebarItem 
          icon={Home} 
          label="Home" 
          active={activeView === 'home'} 
          onClick={() => setActiveView('home')} 
          collapsed={sidebarCollapsed}
        />
        <SidebarItem 
          icon={Search} 
          label="Search" 
          active={activeView === 'search'} 
          onClick={() => setActiveView('search')} 
          collapsed={sidebarCollapsed}
        />
        <SidebarItem 
          icon={Library} 
          label="Your Library" 
          active={activeView === 'library'} 
          onClick={() => setActiveView('library')} 
          collapsed={sidebarCollapsed}
        />
      </nav>

      <div className="flex flex-col gap-1">
        {!sidebarCollapsed && <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 mt-4">Playlists</h2>}
        <SidebarItem icon={PlusCircle} label="Create Playlist" onClick={() => setIsCreateModalOpen(true)} collapsed={sidebarCollapsed} />
        <SidebarItem 
          icon={Heart} 
          label="Liked Songs" 
          active={activeView === 'playlist' && selectedPlaylistId === 'liked'} 
          onClick={() => setActiveView('playlist', 'liked')}
          collapsed={sidebarCollapsed}
        />
        
        <div className="mt-2 space-y-1">
          {playlists.map((playlist) => (
            <SidebarItem 
              key={playlist.id} 
              icon={ListMusic} 
              label={playlist.name} 
              active={activeView === 'playlist' && selectedPlaylistId === playlist.id}
              onClick={() => setActiveView('playlist', playlist.id)}
              collapsed={sidebarCollapsed}
            />
          ))}
        </div>
      </div>

      {!sidebarCollapsed && (
        <div className="mt-auto px-4 py-4 border-t border-white/5">
          <div className="text-[10px] text-zinc-500 font-medium">
            <p>© 2026 HarmonyStream</p>
            <p className="mt-1">Premium Audio Experience</p>
          </div>
        </div>
      )}

      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </motion.div>
  );
}
