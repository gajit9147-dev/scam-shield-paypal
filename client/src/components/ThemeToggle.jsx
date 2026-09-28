import React from 'react';

/**
 * Custom Sun/Moon Animated Pill Theme Switch
 * Accurately replicates the warm doodle sun and amber ring slider knob aesthetic.
 *
 * In Light Mode (default):
 * - Left side: Hand-drawn amber doodle sun with 8 radiant rays
 * - Right side: Warm circular knob with thick amber ring (#f59e0b) and cream fill (#fdecc8)
 * - Track: Clean soft-white pill with subtle border and shadow
 *
 * In Dark Mode:
 * - Knob smoothly slides to the left with spring ease, morphing to a lunar ring
 * - Right side reveals a glowing crescent moon and twinkling stars
 * - Track transitions to midnight slate
 */
export default function ThemeToggle({ theme, onToggle, label = 'Theme', className = '' }) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`group relative inline-flex items-center w-[70px] h-[36px] rounded-full p-[3px] transition-all duration-300 ease-out cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
        isDark
          ? 'bg-slate-900 border-2 border-slate-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),_0_2px_8px_rgba(0,0,0,0.3)] hover:border-indigo-500/60'
          : 'bg-white border-2 border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.06),_0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300'
      } ${className}`}
    >
      {/* Background Track Icons */}
      <div className="absolute inset-0 flex items-center justify-between px-[5px] pointer-events-none">
        {/* Left Slot: Doodle Sun Icon */}
        <div
          className={`w-[26px] h-[26px] flex items-center justify-center transition-all duration-300 ${
            isDark ? 'opacity-20 scale-75' : 'opacity-100 scale-100'
          }`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            className="transition-transform duration-300 group-hover:rotate-12"
          >
            {/* Center sun circle */}
            <circle cx="12" cy="12" r="4.2" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            {/* 8 doodle radiant rays */}
            <line x1="12" y1="2.2" x2="12" y2="4.6" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="12" y1="19.4" x2="12" y2="21.8" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="2.2" y1="12" x2="4.6" y2="12" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="19.4" y1="12" x2="21.8" y2="12" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="5.1" y1="5.1" x2="6.8" y2="6.8" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="17.2" y1="17.2" x2="18.9" y2="18.9" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="5.1" y1="18.9" x2="6.8" y2="17.2" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="17.2" y1="6.8" x2="18.9" y2="5.1" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Right Slot: Crescent Moon & Stars Doodle */}
        <div
          className={`w-[26px] h-[26px] flex items-center justify-center transition-all duration-300 ${
            isDark ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M17 12.5A6.5 6.5 0 0 1 9.5 5a6.5 6.5 0 1 0 7.5 7.5z"
              stroke="#818cf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="#818cf8"
              fillOpacity="0.25"
            />
            <circle cx="17.5" cy="4.5" r="0.85" fill="#c7d2fe" />
            <circle cx="19.5" cy="8.5" r="0.55" fill="#a5b4fc" />
          </svg>
        </div>
      </div>

      {/* Sliding Knob (Thumb) */}
      <span
        className={`relative z-10 w-[26px] h-[26px] rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center ${
          isDark
            ? 'translate-x-0 border-[3px] border-indigo-400 bg-indigo-950/90 shadow-[0_0_10px_rgba(129,140,248,0.4)]'
            : 'translate-x-[36px] border-[3px] border-[#f59e0b] bg-[#fdecc8] shadow-[0_1px_3px_rgba(245,158,11,0.25)]'
        }`}
      >
        {/* Subtle glowing center accent in dark mode */}
        {isDark && (
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
        )}
      </span>
    </button>
  );
}
