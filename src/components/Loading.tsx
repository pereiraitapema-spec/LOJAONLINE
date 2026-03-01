import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

export const Loading = ({ message = 'Carregando...' }: { message?: string }) => {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-indigo-900 font-medium animate-pulse">{message}</p>
      </motion.div>
    </div>
  );
};
