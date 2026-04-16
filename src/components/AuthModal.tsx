import React, { useState } from 'react';
import { X, Mail, Lock, User, LogIn, Github, Chrome } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          displayName,
          email,
          favoriteSongs: [],
          role: 'user',
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Create user profile if it doesn't exist
      await setDoc(doc(db, 'users', result.user.uid), {
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        favoriteSongs: [],
        role: 'user',
        lastLogin: new Date().toISOString()
      }, { merge: true });
      
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
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
          className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl my-auto"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-black tracking-tighter mb-2">
              {isLogin ? 'Welcome Back' : 'Join Harmony'}
            </h2>
            <p className="text-zinc-400 text-sm">
              {isLogin ? 'Login to access your library' : 'Create an account to start listening'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                <input 
                  type="text"
                  placeholder="Full Name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#ff4e00]/50 transition-all"
                />
              </div>
            )}
            
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input 
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#ff4e00]/50 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input 
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#ff4e00]/50 transition-all"
              />
            </div>

            <button 
              disabled={loading}
              className="w-full py-4 bg-[#ff4e00] hover:bg-[#ff6a2a] disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-lg transition-all shadow-lg shadow-[#ff4e00]/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  {isLogin ? 'Login' : 'Sign Up'}
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1a1a1a] px-4 text-zinc-500">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-3 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
            >
              <Chrome size={20} />
              Google
            </button>
          </div>

          <p className="mt-8 text-center text-zinc-400 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#ff4e00] font-bold hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
