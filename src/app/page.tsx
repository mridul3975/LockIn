"use client";

import React, { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useHabitStore } from '@/store/useHabitStore';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const DAYS_OF_WEEK = [
  { label: 'SU', name: 'Sunday' },
  { label: 'M', name: 'Monday' },
  { label: 'T', name: 'Tuesday' },
  { label: 'W', name: 'Wednesday' },
  { label: 'TH', name: 'Thursday' },
  { label: 'F', name: 'Friday' },
  { label: 'SA', name: 'Saturday' }
];

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();

  // Themes and layout state
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to Dark mode (Obsidian Monolith)

  // Local state for habit creation form
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitFreq, setNewHabitFreq] = useState<'daily' | 'weekly' | 'specific_days'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Local state for sleep logging
  const [selectedSleepDate, setSelectedSleepDate] = useState('');
  const [sleepHoursInput, setSleepHoursInput] = useState('');

  // Compliance circular progress modes
  const [complianceMode, setComplianceMode] = useState<'day' | 'week' | 'month'>('day');
  const [activeView, setActiveView] = useState<'matrix' | 'trends' | 'compliance' | 'settings'>('matrix');

  // Zustand Store
  const {
    habits,
    logs,
    sleepLogs,
    isSyncing,
    toggleHabit,
    addHabit,
    deleteHabit,
    logSleep,
    syncWithDb,
    clearLocalCache
  } = useHabitStore();

  // Handle Hydration mismatch prevention
  useEffect(() => {
    setMounted(true);
    const todayStr = getTodayString();
    setSelectedSleepDate(todayStr);
  }, []);

  // Sync when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      syncWithDb();
    }
  }, [status]);

  const handleLogout = () => {
    clearLocalCache();
    signOut();
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#000000]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#050505] border border-white/10 animate-spin">
            <span className="material-symbols-outlined text-white">sync</span>
          </div>
          <span className="font-mono text-xs text-white uppercase tracking-widest">LOADING SECURE INSTANCE...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#000000] px-4">
        <div className="p-10 rounded-2xl bg-[#050505] border border-white/10 max-w-sm w-full text-center">
          <h1 className="font-mono text-3xl font-black text-white tracking-tighter mb-1">
            LOCK//In
          </h1>
          <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest mb-8">
            Obsidian V1.2
          </p>
          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-3 bg-[#0a0a0a] hover:bg-white/5 text-white border border-white/10 font-mono font-bold py-4 px-6 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Get current week dates (starting Sunday)
  const currentWeekDates = getCurrentWeekDates();
  const todayDateStr = getTodayString();

  function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getCurrentWeekDates() {
    const current = new Date();
    const week = [];
    const distanceToSunday = current.getDay();
    const sunday = new Date(current);
    sunday.setDate(current.getDate() - distanceToSunday);

    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, '0');
      const d = String(day.getDate()).padStart(2, '0');
      week.push({
        dateString: `${y}-${m}-${d}`,
        dayOfWeek: i,
        dayOfMonth: day.getDate()
      });
    }
    return week;
  }

  // Dynamic calculations
  const todayHabits = habits.filter(h => {
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'specific_days') {
      const todayDayOfWeek = new Date().getDay();
      return h.frequencyDays.includes(todayDayOfWeek);
    }
    return true;
  });

  const todayCompletedCount = todayHabits.reduce((acc, h) => {
    const isCompleted = logs.some(l => l.habitId === h.id && l.date === todayDateStr && l.completed);
    return acc + (isCompleted ? 1 : 0);
  }, 0);

  const todayCompletionPercentage = todayHabits.length > 0
    ? Math.round((todayCompletedCount / todayHabits.length) * 100)
    : 0;

  const computeMonthlyComplianceScore = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayDay = now.getDate();

    let totalTargetOccurrences = 0;
    let actualCompletedOccurrences = 0;

    for (let d = 1; d <= todayDay; d++) {
      const dateVal = new Date(currentYear, currentMonth, d);
      const dayOfWeek = dateVal.getDay();
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      habits.forEach(h => {
        let isHabitActiveOnDay = false;
        if (h.frequency === 'daily') {
          isHabitActiveOnDay = true;
        } else if (h.frequency === 'specific_days') {
          isHabitActiveOnDay = h.frequencyDays.includes(dayOfWeek);
        } else if (h.frequency === 'weekly') {
          isHabitActiveOnDay = dayOfWeek === 0;
        }

        if (isHabitActiveOnDay) {
          totalTargetOccurrences++;
          const log = logs.find(l => l.habitId === h.id && l.date === dateStr);
          if (log && log.completed) {
            actualCompletedOccurrences++;
          }
        }
      });
    }

    if (totalTargetOccurrences === 0) return 0;
    return Math.round((actualCompletedOccurrences / totalTargetOccurrences) * 100);
  };

  const monthlyScore = computeMonthlyComplianceScore();

  let weeklyCompletedCount = 0;
  let weeklyTotalTarget = 0;

  currentWeekDates.forEach(day => {
    habits.forEach(h => {
      let active = false;
      if (h.frequency === 'daily') active = true;
      else if (h.frequency === 'specific_days') active = h.frequencyDays.includes(day.dayOfWeek);
      else if (h.frequency === 'weekly') active = day.dayOfWeek === 0;

      if (active) {
        weeklyTotalTarget++;
        const isComp = logs.some(l => l.habitId === h.id && l.date === day.dateString && l.completed);
        if (isComp) weeklyCompletedCount++;
      }
    });
  });

  const weeklyMissedCount = Math.max(0, weeklyTotalTarget - weeklyCompletedCount);

  const activeComplianceScore =
    complianceMode === 'day'
      ? todayCompletionPercentage
      : complianceMode === 'week'
        ? (weeklyTotalTarget > 0 ? Math.round((weeklyCompletedCount / weeklyTotalTarget) * 100) : 0)
        : monthlyScore;

  const handleToggleDay = (habitId: string, dateString: string) => {
    toggleHabit(habitId, dateString);
  };

  const handleAddHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    addHabit(newHabitName, newHabitFreq, selectedDays);
    setNewHabitName('');
    setNewHabitFreq('daily');
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const handleSleepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(sleepHoursInput);
    if (isNaN(hours) || hours < 0 || hours > 24) return;
    logSleep(selectedSleepDate, hours);
    setSleepHoursInput('');
  };

  const toggleDaySelection = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const getSleepGraphData = () => {
    return currentWeekDates.map(day => {
      const log = sleepLogs.find(l => l.date === day.dateString);
      return {
        name: DAYS_OF_WEEK[day.dayOfWeek].label,
        hours: log ? log.hours : 0
      };
    });
  };

  const sleepGraphData = getSleepGraphData();

  // SVG parameters
  const strokeDasharray = 301;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * activeComplianceScore) / 100;

  return (
    <div className={`min-h-screen flex w-full transition-colors duration-300 font-mono ${
      isDarkMode ? 'dark-mode-theme bg-black' : 'light-mode-theme bg-[#94a3b8]'
    }`}>

      {/* ---------------------------------------------------- */}
      {/* LIGHT MODE STRUCTURE (Vertical Command Layout)      */}
      {/* ---------------------------------------------------- */}
      {!isDarkMode && (
        <div className="flex flex-col lg:flex-row gap-12 w-full max-w-[1400px] mx-auto p-8 lg:p-12 justify-center items-stretch">
          
          {/* Command Center Sidebar */}
          <aside className="flex flex-col gap-12 w-full lg:w-[320px] shrink-0">
            <div className="flex flex-col items-start pb-8 border-b border-white/40 shadow-[0_1px_0_rgba(100,116,139,0.3)]">
              <div className="flex items-center justify-between w-full">
                <h1 className="font-headline-md text-xl etched-text tracking-[0.2em] uppercase text-[#334155] font-bold">LOCK//In</h1>
                {/* Theme toggle in light mode sidebar top */}
                <button
                  onClick={() => setIsDarkMode(true)}
                  className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center bg-slate-200/50 hover:bg-slate-300/50 transition-colors shadow-inner"
                  title="Switch to Obsidian Monolith"
                >
                  <span className="material-symbols-outlined text-xs text-[#334155]">dark_mode</span>
                </button>
              </div>
              <h2 className="font-label-caps text-[9px] text-[#718096] opacity-80 uppercase font-bold mt-2">Platinum Habit Matrix V1.1</h2>
            </div>

            <div className="flex flex-col gap-8 w-full">
              {/* Live Completion */}
              <div className="embossed-panel p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-label-caps text-[10px] etched-text uppercase tracking-[0.2em] text-[#334155] font-bold">Completion IDX</h3>
                  <span className="font-headline-md text-[#334155] etched-text font-bold">{todayCompletionPercentage}%</span>
                </div>
                <div className="w-full h-3 carved-cell rounded-full p-0.5 overflow-hidden">
                  <div className="h-full jewel-silver rounded-full shadow-[0_0_12px_rgba(100,116,139,0.8)]" style={{ width: `${todayCompletionPercentage}%` }}></div>
                </div>
                <p className="font-label-caps text-[9px] etched-text uppercase mt-4 opacity-80 text-[#334155] font-bold">
                  {todayCompletedCount} / {todayHabits.length} Active
                </p>
              </div>

              {/* Compliance Mini Radial */}
              <div className="embossed-panel p-8 flex flex-col items-center text-center gap-6">
                <div>
                  <h3 className="font-label-caps text-[10px] etched-text uppercase tracking-[0.2em] mb-2 text-[#334155] font-bold">Compliance</h3>
                  <div className="flex p-1 carved-cell rounded-lg mb-2">
                    {(['day', 'week', 'month'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setComplianceMode(mode)}
                        className={`px-3 py-1 font-label-caps text-[8px] rounded transition-all ${
                          complianceMode === mode
                            ? 'jewel-silver text-slate-800 font-bold'
                            : 'text-[#718096]'
                        }`}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative w-32 h-32 carved-cell rounded-full flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle className="text-slate-400/40" cx="50%" cy="50%" fill="transparent" r="48" stroke="currentColor" stroke-width="8"></circle>
                    <circle className="text-slate-600 drop-shadow-[0_0_6px_rgba(100,116,139,0.6)]" cx="50%" cy="50%" fill="transparent" r="48" stroke="currentColor" stroke-dasharray={strokeDasharray} stroke-dashoffset={strokeDashoffset} stroke-linecap="round" stroke-width="8"></circle>
                  </svg>
                  <span className="font-label-caps text-[14px] etched-text text-[#334155] font-bold">{activeComplianceScore}%</span>
                </div>
              </div>

              {/* User and logout */}
              <div className="embossed-panel p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#334155]">account_circle</span>
                  <div className="text-left">
                    <p className="font-label-caps text-[10px] text-[#334155] font-bold">{session?.user?.name || "Jason"}</p>
                    <p className="font-label-caps text-[8px] text-[#718096]">OPERATOR</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2 px-4 rounded-xl jewel-silver font-label-caps text-[10px] text-[#334155] font-bold text-center"
                >
                  DISCONNECT SESSION
                </button>
              </div>
            </div>
          </aside>

          {/* Main Matrix Area */}
          <div className="flex flex-col gap-8 flex-1">
            {/* Header Area Navigation */}
            <div className="flex flex-wrap items-center gap-4 lg:justify-end pb-8 lg:border-b lg:border-white/40 lg:shadow-[0_1px_0_rgba(100,116,139,0.3)]">
              <button
                onClick={syncWithDb}
                disabled={isSyncing}
                className="flex items-center gap-2 carved-cell px-6 py-3 rounded-full hover:scale-95 transition-transform"
              >
                <span className={`w-2 h-2 rounded-full jewel-silver ${isSyncing ? 'animate-spin' : ''}`}></span>
                <span className="font-label-caps text-label-caps etched-text text-[#334155] font-bold">SYNC VECTORS</span>
              </button>
              <div className="flex items-center gap-4 carved-cell px-6 py-3 rounded-full">
                <span className="font-label-caps text-label-caps etched-text text-[#334155] font-bold">WK: {currentWeekDates[0]?.dateString} / {currentWeekDates[6]?.dateString}</span>
              </div>
            </div>

            {/* Carved Matrix */}
            <div className="carved-area p-6 lg:p-10 w-full flex flex-col gap-8">
              <div className="overflow-x-auto w-full">
                <table className="w-full border-separate border-spacing-y-4 border-spacing-x-4">
                  <thead>
                    <tr className="etched-text font-label-caps text-[9px] uppercase tracking-[0.3em] text-[#334155] font-bold">
                      <th className="text-left py-2 px-4 w-1/4">Identifier</th>
                      {currentWeekDates.map((day, idx) => (
                        <th key={idx} className="text-center">
                          {day.dayOfMonth}<br/>
                          <span className="opacity-70 text-[8px]">{DAYS_OF_WEEK[day.dayOfWeek].label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-body-md">
                    {habits.map((habit) => (
                      <tr key={habit.id}>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-[#334155] font-body-lg etched-text uppercase tracking-widest font-bold">{habit.name}</span>
                            <span className="font-label-caps text-[8px] text-[#718096]">
                              {habit.frequency === 'daily' && 'DAILY'}
                              {habit.frequency === 'weekly' && 'WEEKLY'}
                            </span>
                          </div>
                        </td>
                        {currentWeekDates.map((day, idx) => {
                          let isScheduled = false;
                          if (habit.frequency === 'daily') isScheduled = true;
                          else if (habit.frequency === 'specific_days') isScheduled = habit.frequencyDays.includes(day.dayOfWeek);
                          else if (habit.frequency === 'weekly') isScheduled = day.dayOfWeek === 0;

                          const isCompleted = logs.some(
                            (l) => l.habitId === habit.id && l.date === day.dateString && l.completed
                          );

                          return (
                            <td key={idx} className="text-center">
                              {isScheduled ? (
                                <div
                                  onClick={() => handleToggleDay(habit.id, day.dateString)}
                                  className={`mx-auto w-10 h-10 carved-cell rounded-xl cursor-pointer hover:bg-black/5 transition-all flex items-center justify-center ${
                                    isCompleted ? 'jewel-silver scale-90' : ''
                                  }`}
                                >
                                  {isCompleted && (
                                    <span className="w-3 h-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)]"></span>
                                  )}
                                </div>
                              ) : (
                                <div className="mx-auto w-10 h-10 flex items-center justify-center text-slate-500/20 select-none">-</div>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <button
                            onClick={() => deleteHabit(habit.id)}
                            className="material-symbols-outlined text-[#718096] hover:text-[#991b1b] transition-colors"
                          >
                            delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Creator Form inside light mode matrix */}
              <div className="embossed-panel p-6 mt-4">
                <h3 className="font-headline-md text-sm font-bold text-[#334155] uppercase mb-4">Define Vector</h3>
                <form onSubmit={handleAddHabitSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="Parameter Name..."
                    className="w-full carved-cell rounded-xl px-4 py-2.5 bg-[#cbd5e1] text-xs text-[#334155] placeholder-[#718096]/50 border-0 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl jewel-silver font-label-caps text-[10px] text-[#334155] font-bold uppercase"
                  >
                    DEPLOY VECTOR
                  </button>
                </form>
              </div>

              {/* Sleep log in light mode */}
              <div className="embossed-panel p-6">
                <h3 className="font-headline-md text-sm font-bold text-[#334155] uppercase mb-4">Sleep Log Coordinates</h3>
                <div className="h-32 w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sleepGraphData}>
                      <defs>
                        <linearGradient id="sleepColorLight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#475569" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#475569" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#718096" fontSize={9} fontFamily="monospace" tickLine={false} />
                      <YAxis stroke="#718096" fontSize={9} fontFamily="monospace" tickLine={false} domain={[0, 12]} />
                      <Area type="monotone" dataKey="hours" stroke="#334155" strokeWidth={2} fill="url(#sleepColorLight)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <form onSubmit={handleSleepSubmit} className="grid grid-cols-3 gap-4 items-end">
                  <select
                    value={selectedSleepDate}
                    onChange={(e) => setSelectedSleepDate(e.target.value)}
                    className="carved-cell rounded-xl px-2 py-2 bg-[#cbd5e1] text-xs text-[#334155] border-0 focus:outline-none"
                  >
                    {currentWeekDates.map(day => (
                      <option key={day.dateString} value={day.dateString}>
                        {day.dayOfMonth} ({DAYS_OF_WEEK[day.dayOfWeek].label})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    value={sleepHoursInput}
                    onChange={(e) => setSleepHoursInput(e.target.value)}
                    placeholder="Hours..."
                    className="carved-cell rounded-xl px-2 py-2 bg-[#cbd5e1] text-xs text-[#334155] border-0 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="py-2 rounded-xl jewel-silver font-label-caps text-[9px] text-[#334155] font-bold uppercase"
                  >
                    LOG SLEEP
                  </button>
                </form>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* DARK MODE STRUCTURE (Obsidian Monolith Variant)     */}
      {/* ---------------------------------------------------- */}
      {isDarkMode && (
        <div className="flex flex-col md:flex-row w-full bg-black min-h-screen">
          {/* SideNavBar Component */}
          <nav className="w-full md:w-[72px] lg:w-[240px] flex-shrink-0 bg-[#050505] border-r border-white/5 flex flex-col justify-between h-auto md:h-screen sticky top-0 z-40 transition-all duration-300">
            <div className="flex flex-col">
              <div className="h-16 flex items-center justify-between lg:justify-start lg:px-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-white active-text">grid_view</span>
                  <span className="hidden lg:block font-label-caps uppercase tracking-widest text-white active-text">Matrix</span>
                </div>
                {/* Theme switcher in dark mode sidebar top */}
                <button
                  onClick={() => setIsDarkMode(false)}
                  className="mr-3 lg:mr-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-black hover:bg-white/5 transition-colors"
                  title="Switch to Platinum Light Mode"
                >
                  <span className="material-symbols-outlined text-xs text-white">light_mode</span>
                </button>
              </div>
              <div className="flex md:flex-col gap-2 p-3 overflow-x-auto md:overflow-visible">
                <button
                  onClick={() => setActiveView('matrix')}
                  className={`nav-item flex items-center p-3 rounded-lg w-full ${
                    activeView === 'matrix' ? 'active bg-white/5 border-l-2 border-white' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined mx-auto lg:mx-0">calendar_month</span>
                  <span className="hidden lg:block ml-3 font-label-caps uppercase text-left">Habits</span>
                </button>
                <button
                  onClick={() => setActiveView('trends')}
                  className={`nav-item flex items-center p-3 rounded-lg w-full ${
                    activeView === 'trends' ? 'active bg-white/5 border-l-2 border-white' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined mx-auto lg:mx-0">monitoring</span>
                  <span className="hidden lg:block ml-3 font-label-caps uppercase text-left">Analytics</span>
                </button>
              </div>
            </div>
            <div className="hidden md:flex flex-col p-3 border-t border-white/5">
              <button
                onClick={handleLogout}
                className="nav-item flex items-center p-3 rounded-lg hover:bg-white/5 w-full text-left"
              >
                <span className="material-symbols-outlined mx-auto lg:mx-0">logout</span>
                <span className="hidden lg:block ml-3 font-label-caps uppercase">Logout</span>
              </button>
            </div>
          </nav>

          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            {/* TopAppBar Component */}
            <header className="h-16 flex items-center justify-between px-6 bg-[#050505] border-b border-white/5 shrink-0 z-30">
              <div className="flex items-center gap-4">
                <h1 className="font-headline-lg-mobile text-white active-text tracking-wider uppercase m-0 leading-none">LOCK//In</h1>
                <span className="font-label-mono text-on-surface-variant opacity-60 bg-white/5 px-2 py-1 rounded">Obsidian V1.2</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={syncWithDb}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:scale-95 transition-transform"
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff] ${isSyncing ? 'animate-ping' : 'animate-pulse'}`}></span>
                  <span className="font-label-mono text-[10px] text-white">SYS.SYNC</span>
                </button>
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 text-white">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="User avatar" className="w-6 h-6 rounded-full" />
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">account_circle</span>
                  )}
                </div>
              </div>
            </header>

            {/* Main scrollable body */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
              <div className="ceramic-slab p-6 md:p-10 flex flex-col gap-8 w-full max-w-[900px] rounded-[24px]">
                
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 w-full relative z-20 pb-4 border-b border-white/10">
                  <div className="flex flex-col items-start">
                    <h2 className="font-label-mono text-on-surface-variant uppercase mb-1">Current Week</h2>
                    <p className="font-label-mono text-white active-text text-sm">{currentWeekDates[0]?.dateString} / {currentWeekDates[6]?.dateString}</p>
                  </div>
                </header>

                {/* Main Carved Matrix Area */}
                <div className="carved-area p-6 w-full relative z-20">
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-y-4 border-spacing-x-2 md:border-spacing-x-4">
                      <thead>
                        <tr className="etched-text font-label-mono text-[10px] uppercase tracking-[0.2em]">
                          <th className="text-left py-2 px-2 w-1/4">Identifier</th>
                          {currentWeekDates.map((day, idx) => (
                            <th key={idx} className="text-center">
                              {day.dayOfMonth}<br/>
                              <span className="opacity-50 text-[8px]">{DAYS_OF_WEEK[day.dayOfWeek].label}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="font-body-md">
                        {habits.map((habit) => (
                          <tr key={habit.id}>
                            <td className="px-2 py-3">
                              <div className="flex flex-col">
                                <span className="text-white active-text font-body-lg uppercase tracking-wider text-[12px]">{habit.name}</span>
                              </div>
                            </td>
                            {currentWeekDates.map((day, idx) => {
                              let isScheduled = false;
                              if (habit.frequency === 'daily') isScheduled = true;
                              else if (habit.frequency === 'specific_days') isScheduled = habit.frequencyDays.includes(day.dayOfWeek);
                              else if (habit.frequency === 'weekly') isScheduled = day.dayOfWeek === 0;

                              const isCompleted = logs.some(
                                (l) => l.habitId === habit.id && l.date === day.dateString && l.completed
                              );

                              return (
                                <td key={idx} className="text-center">
                                  {isScheduled ? (
                                    <div
                                      onClick={() => handleToggleDay(habit.id, day.dateString)}
                                      className={`mx-auto w-8 h-8 carved-cell cursor-pointer flex items-center justify-center hover:scale-95 transition-all ${
                                        isCompleted ? 'jewel-active' : ''
                                      }`}
                                    ></div>
                                  ) : (
                                    <div className="mx-auto w-8 h-8 flex items-center justify-center text-white/10 select-none">-</div>
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              <button
                                onClick={() => deleteHabit(habit.id)}
                                className="material-symbols-outlined text-[#888888] hover:text-red-500 transition-colors"
                              >
                                delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Forms inside dark mode Monolith */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full relative z-20">
                  <div className="embossed-panel p-6">
                    <h3 className="font-label-mono text-[10px] etched-text uppercase tracking-widest mb-4">Define Vector</h3>
                    <form onSubmit={handleAddHabitSubmit} className="space-y-4">
                      <input
                        type="text"
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
                        placeholder="Label..."
                        className="w-full px-3 py-2 bg-black border border-white/10 rounded-md text-white text-xs placeholder-white/30 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 bg-white text-black font-mono font-bold text-xs rounded-md"
                      >
                        DEPLOY VECTOR
                      </button>
                    </form>
                  </div>

                  <div className="embossed-panel p-6">
                    <h3 className="font-label-mono text-[10px] etched-text uppercase tracking-widest mb-4">Sleep Log Coordinates</h3>
                    <form onSubmit={handleSleepSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={selectedSleepDate}
                          onChange={(e) => setSelectedSleepDate(e.target.value)}
                          className="bg-black border border-white/10 rounded-md text-white text-xs px-2 py-1.5 focus:outline-none"
                        >
                          {currentWeekDates.map(day => (
                            <option key={day.dateString} value={day.dateString}>
                              {day.dayOfMonth} ({DAYS_OF_WEEK[day.dayOfWeek].label})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.5"
                          value={sleepHoursInput}
                          onChange={(e) => setSleepHoursInput(e.target.value)}
                          placeholder="Hours..."
                          className="bg-black border border-white/10 rounded-md text-white text-xs px-2 py-1.5 placeholder-white/30 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-white text-black font-mono font-bold text-xs rounded-md"
                      >
                        LOG SLEEP
                      </button>
                    </form>
                  </div>
                </div>

                {/* Recharts Area for Sleep coordinates in Obsidian Monolith */}
                <div className="embossed-panel p-6 w-full relative z-20">
                  <h3 className="font-label-mono text-[10px] etched-text uppercase tracking-widest mb-4">Sleep Matrix Analytics</h3>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sleepGraphData}>
                        <defs>
                          <linearGradient id="sleepColorDark" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#666666" fontSize={9} fontFamily="monospace" tickLine={false} />
                        <YAxis stroke="#666666" fontSize={9} fontFamily="monospace" tickLine={false} domain={[0, 12]} />
                        <Area type="monotone" dataKey="hours" stroke="#ffffff" strokeWidth={1.5} fill="url(#sleepColorDark)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bottom Metrics Area in Obsidian Monolith */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full relative z-20">
                  {/* Live Completion */}
                  <div className="embossed-panel p-6 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-label-mono text-[10px] etched-text uppercase tracking-widest">Completion IDX</h3>
                      <span className="font-label-mono text-white active-text">{todayCompletionPercentage}%</span>
                    </div>
                    <div className="w-full h-1.5 carved-cell rounded-full p-0 overflow-hidden border-none shadow-inner bg-black">
                      <div className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ width: `${todayCompletionPercentage}%` }}></div>
                    </div>
                    <p className="font-label-mono text-[8px] etched-text uppercase mt-3">
                      {todayCompletedCount} / {todayHabits.length} Active
                    </p>
                  </div>

                  {/* Compliance Mini Radial */}
                  <div className="embossed-panel p-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-label-mono text-[10px] etched-text uppercase tracking-widest mb-1">Compliance</h3>
                      <div className="flex gap-2 mb-2 mt-1">
                        {(['day', 'week', 'month'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setComplianceMode(mode)}
                            className={`font-label-mono text-[8px] tracking-normal ${
                              complianceMode === mode ? 'text-white font-bold' : 'text-[#666666]'
                            }`}
                          >
                            {mode.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative w-16 h-16 carved-cell rounded-full flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                        <circle className="text-black" cx="50%" cy="50%" fill="transparent" r="24" stroke="currentColor" stroke-width="4"></circle>
                        <circle className="text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" cx="50%" cy="50%" fill="transparent" r="24" stroke="currentColor" stroke-dasharray={strokeDasharray} stroke-dashoffset={strokeDashoffset} stroke-linecap="round" stroke-width="4"></circle>
                      </svg>
                      <span className="font-label-mono text-[10px] text-white active-text">{activeComplianceScore}%</span>
                    </div>
                  </div>
                </div>

              </div>
            </main>
          </div>
        </div>
      )}

    </div>
  );
}
