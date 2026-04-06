import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const actions = [
  { id: 'power',   label: 'Ρεύμα',    emoji: '⚡', color: 'bg-yellow-500 hover:bg-yellow-600' },
  { id: 'water',   label: 'Νερό',     emoji: '💧', color: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'payment', label: 'Πληρωμή',  emoji: '💰', color: 'bg-green-500 hover:bg-green-600' },
  { id: 'note',    label: 'Σημείωση', emoji: '✏️', color: 'bg-purple-500 hover:bg-purple-600' },
];

export default function FAB({ onAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const handleAction = (id) => { setIsOpen(false); onAction(id); };

  return (
    <div className="fixed bottom-8 right-5 z-[9999] flex flex-col-reverse items-end gap-3">
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsOpen(!isOpen)}
        className={cn("w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all border-2 border-white/20",
          isOpen ? "bg-foreground text-background rotate-45" : "bg-primary text-primary-foreground")}>
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col-reverse gap-2 mb-1">
            {actions.map((action, index) => (
              <motion.button key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }} transition={{ delay: index * 0.05 }}
                onClick={() => handleAction(action.id)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white transition-all", action.color)}>
                <span className="text-lg">{action.emoji}</span>
                <span className="text-sm font-medium">{action.label}</span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
