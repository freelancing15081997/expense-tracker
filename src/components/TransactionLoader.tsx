import React from 'react';
import { motion } from 'framer-motion';

interface TransactionLoaderProps {
  message?: string;
}

export default function TransactionLoader({ message = 'Processing transaction...' }: TransactionLoaderProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6 max-w-sm mx-4"
      >
        {/* Animated Transaction Icon */}
        <div className="relative w-24 h-24">
          {/* Outer rotating ring */}
          <motion.div
            className="absolute inset-0 border-4 border-emerald-100 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Middle pulsing ring */}
          <motion.div
            className="absolute inset-2 border-4 border-emerald-300 rounded-full"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          
          {/* Inner icon container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                y: [-2, 2, -2],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-emerald-600"
            >
              {/* Money transfer icon */}
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </motion.div>
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">{message}</h3>
          <div className="flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-emerald-500 rounded-full"
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Alternative compact loader for inline use
export function CompactTransactionLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      <motion.div
        className="absolute inset-0 border-2 border-emerald-200 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-1 border-2 border-emerald-500 border-t-transparent rounded-full"
        animate={{ rotate: -360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-emerald-600"
        >
          <svg className={size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="3" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
