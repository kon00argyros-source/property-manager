import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CORRECT_PIN = '22860';

export default function PinLock({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePress = (val) => {
    if (pin.length >= 5) return;
    const newPin = pin + val;
    setPin(newPin);
    setError(false);
    if (newPin.length === 5) {
      if (newPin === CORRECT_PIN) setTimeout(() => onUnlock(), 300);
      else setTimeout(() => { setError(true); setPin(''); }, 400);
    }
  };

  const handleDelete = () => { setPin(pin.slice(0, -1)); setError(false); };
  const buttons = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xs">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
            <span className="text-3xl">🏠</span>
          </div>
        </div>
        <h1 className="text-white text-2xl font-semibold text-center mb-1">Διαχείριση Ακινήτου</h1>
        <p className="text-blue-300/70 text-sm text-center mb-8">Εισάγετε το PIN σας</p>
        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div key={i}
              animate={{ scale: pin.length === i + 1 ? [1, 1.3, 1] : 1, backgroundColor: error ? '#ef4444' : pin.length > i ? '#3b82f6' : 'rgba(255,255,255,0.15)' }}
              transition={{ duration: 0.2 }}
              className="w-4 h-4 rounded-full"
            />
          ))}
        </div>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm text-center mb-4">
              Λάθος PIN, δοκιμάστε ξανά
            </motion.p>
          )}
        </AnimatePresence>
        <div className="grid grid-cols-3 gap-3">
          {buttons.map((btn, i) => (
            <motion.button key={i} whileTap={{ scale: btn ? 0.92 : 1 }}
              onClick={() => { if (btn === '⌫') handleDelete(); else if (btn !== '') handlePress(btn); }}
              className={`h-16 rounded-2xl text-xl font-medium transition-colors ${btn === '' ? 'invisible' : btn === '⌫' ? 'bg-white/5 text-blue-300 hover:bg-white/10' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}>
              {btn}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
