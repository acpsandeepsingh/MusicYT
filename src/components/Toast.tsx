import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toast, hideToast } = usePlayerStore();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl bg-[#1a1a1a] border border-white/10 shadow-2xl min-w-[300px]"
        >
          <div className={`p-2 rounded-full ${
            toast.type === 'error' ? 'bg-red-500/20 text-red-500' :
            toast.type === 'success' ? 'bg-green-500/20 text-green-500' :
            'bg-blue-500/20 text-blue-500'
          }`}>
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
          </div>
          
          <p className="flex-1 text-sm font-medium text-zinc-200">{toast.message}</p>
          
          <button 
            onClick={hideToast}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
