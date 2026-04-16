import React, { useEffect, useState } from 'react';
import { Search, Bell, User, ChevronLeft, ChevronRight, LogIn, LogOut, Menu } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import AuthModal from './AuthModal';
import { usePlayerStore } from '../store/usePlayerStore';

export default function Header() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { queue, setCurrentSong, setSearchQuery, searchQuery, setActiveView, sidebarCollapsed, setSidebarCollapsed } = usePlayerStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      setActiveView('search');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <header className="h-16 px-8 flex items-center justify-between bg-transparent sticky top-0 z-40 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 hover:bg-white/5 rounded-full transition-colors md:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="hidden md:flex items-center gap-2">
          <button 
            onClick={() => setActiveView('home')}
            className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-white transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={handleSearchChange}
            className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 w-32 md:w-64 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff4e00]/50 focus:bg-white/10 transition-all"
          />
        </form>
      </div>

      <div className="flex items-center gap-4">
        <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#ff4e00] rounded-full border-2 border-[#0a0502]" />
        </button>
        
        {user ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-full p-1 pr-4 border border-white/10"
            >
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-white/10" />
              <span className="text-sm font-medium">{user.displayName}</span>
              <LogOut size={16} className="text-zinc-400" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-2 bg-[#ff4e00] hover:bg-[#ff6a2a] transition-all rounded-full px-6 py-2 font-bold text-sm shadow-lg shadow-[#ff4e00]/20"
          >
            <LogIn size={18} />
            Login
          </button>
        )}
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </header>
  );
}
