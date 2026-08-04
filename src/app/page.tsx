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

  // Local state for layout and interactions
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Local state for habit creation form
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitFreq, setNewHabitFreq] = useState<'daily' | 'weekly' | 'specific_days'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Local state for sleep logging
  const [selectedSleepDate, setSelectedSleepDate] = useState('');
  const [sleepHoursInput, setSleepHoursInput] = useState('');

  // Compliance circular progress modes
  const [complianceMode, setComplianceMode] = useState<'day' | 'week' | 'month'>('day');

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
      <div className="flex items-center justify-center min-h-screen bg-[#94a3b8]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#cbd5e1] border border-white/40 animate-spin">
            <span className="material-symbols-outlined text-[#334155]">sync</span>
          </div>
          <span className="font-mono text-xs text-[#334155] uppercase tracking-widest">LOADING INSTANCE...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#94a3b8] px-4">
        <div className="p-10 rounded-[40px] bg-[#cbd5e1] border border-white/60 shadow-[30px_30px_60px_#64748b,-30px_-30px_60px_#f1f5f9] max-w-sm w-full text-center">
          <h1 className="font-mono text-3xl font-black text-[#334155] tracking-tighter mb-1">
            LOCK//In
          </h1>
          <p className="font-mono text-[10px] text-[#718096] uppercase tracking-widest mb-8">
            Platinum Habit Matrix V1.1
          </p>
          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-3 bg-[#cbd5e1] hover:bg-[#b8c5d6] text-[#334155] font-mono font-bold py-4 px-6 rounded-xl border border-white/60 shadow-[6px_6px_12px_#94a3b8,-6px_-6px_12px_#f8fafc] transition-all"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const currentWeekDates = getCurrentWeekDates();
  const todayDateStr = getTodayString();

  function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Current week dates generator
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

  const strokeDasharray = 301;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * activeComplianceScore) / 100;

  // Shared completion index markup
  const renderCompletionIndex = () => (
    <div className="embossed-panel p-6 sm:p-8">
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
  );

  // Shared compliance donut gauge markup
  const renderComplianceIndex = () => (
    <div className="embossed-panel p-6 sm:p-8 flex flex-col items-center text-center gap-6">
      <div className="w-full">
        <h3 className="font-label-caps text-[10px] etched-text uppercase tracking-[0.2em] mb-3 text-[#334155] font-bold text-center">Compliance</h3>
        <div className="flex p-1 carved-cell rounded-lg mb-2 max-w-[200px] mx-auto">
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setComplianceMode(mode)}
              className={`flex-1 py-1 font-label-caps text-[8px] rounded transition-all ${
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
      <div className="relative w-32 h-32 carved-cell rounded-full flex items-center justify-center bg-[#cbd5e1]">
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle className="text-slate-400/40" cx="50%" cy="50%" fill="transparent" r="48" stroke="currentColor" stroke-width="8"></circle>
          <circle className="text-slate-600 drop-shadow-[0_0_6px_rgba(100,116,139,0.6)]" cx="50%" cy="50%" fill="transparent" r="48" stroke="currentColor" stroke-dasharray={strokeDasharray} stroke-dashoffset={strokeDashoffset} stroke-linecap="round" stroke-width="8"></circle>
        </svg>
        <span className="font-label-caps text-[14px] etched-text text-[#334155] font-bold">{activeComplianceScore}%</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full font-mono bg-[#94a3b8] text-[#1e293b]">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 w-full max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 justify-center items-stretch">
        
        {/* MOBILE TOP BAR (Only visible below lg) */}
        <header className="lg:hidden w-full flex items-center justify-between pb-6 mb-2 border-b border-white/40 shadow-[0_1px_0_rgba(100,116,139,0.3)] relative">
          <div>
            <h1 className="font-headline-md text-xl etched-text tracking-[0.2em] uppercase text-[#334155] font-bold">LOCK//In</h1>
            <h2 className="font-label-caps text-[9px] text-[#718096] opacity-80 uppercase font-bold mt-1">Platinum Habit Matrix V1.1</h2>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full jewel-silver flex items-center justify-center cursor-pointer hover:scale-95 transition-transform"
              title="View Profile"
            >
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-[#334155]">account_circle</span>
              )}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-64 embossed-panel p-6 z-50 flex flex-col gap-4 text-left">
                <div className="flex flex-col">
                  <span className="font-label-caps text-[9px] text-[#718096] uppercase font-bold">User Email</span>
                  <span className="font-mono text-xs text-[#334155] font-bold break-all">{session?.user?.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2 px-4 rounded-xl jewel-silver font-label-caps text-[10px] text-[#334155] font-bold text-center hover:scale-95 transition-transform"
                >
                  LOGOUT
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Command Center Sidebar (Desktop Only) */}
        <aside className="hidden lg:flex flex-col gap-12 w-[320px] shrink-0">
          <div className="flex flex-col items-start pb-8 border-b border-white/40 shadow-[0_1px_0_rgba(100,116,139,0.3)]">
            <h1 className="font-headline-md text-xl etched-text tracking-[0.2em] uppercase text-[#334155] font-bold">LOCK//In</h1>
            <h2 className="font-label-caps text-[9px] text-[#718096] opacity-80 uppercase font-bold mt-2">Platinum Habit Matrix V1.1</h2>
          </div>

          <div className="flex flex-col gap-8 w-full">
            {renderCompletionIndex()}
            {renderComplianceIndex()}
          </div>
        </aside>

        {/* Main Matrix Area */}
        <div className="flex flex-col gap-6 lg:gap-8 flex-1 w-full min-w-0">
          
          {/* Header Area Navigation (Desktop Only) */}
          <div className="hidden lg:flex flex-wrap items-center gap-4 justify-end pb-8 border-b border-white/40 shadow-[0_1px_0_rgba(100,116,139,0.3)] relative">
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

            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full jewel-silver flex items-center justify-center cursor-pointer hover:scale-95 transition-transform"
                title="View Profile"
              >
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-[#334155]">account_circle</span>
                )}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-64 embossed-panel p-6 z-50 flex flex-col gap-4 text-left">
                  <div className="flex flex-col">
                    <span className="font-label-caps text-[9px] text-[#718096] uppercase font-bold">User Email</span>
                    <span className="font-mono text-xs text-[#334155] font-bold break-all">{session?.user?.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 px-4 rounded-xl jewel-silver font-label-caps text-[10px] text-[#334155] font-bold text-center hover:scale-95 transition-transform"
                  >
                    LOGOUT
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sync Button & Week Indicator row for Mobile Only */}
          <div className="lg:hidden flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={syncWithDb}
              disabled={isSyncing}
              className="flex items-center justify-center gap-2 carved-cell w-full py-3 rounded-xl hover:scale-95 transition-transform"
            >
              <span className={`w-2 h-2 rounded-full jewel-silver ${isSyncing ? 'animate-spin' : ''}`}></span>
              <span className="font-label-caps text-[10px] etched-text text-[#334155] font-bold">SYNC VECTORS</span>
            </button>
            <div className="flex items-center justify-center gap-2 carved-cell w-full py-3 rounded-xl text-center">
              <span className="font-label-caps text-[9px] etched-text text-[#334155] font-bold">WK: {currentWeekDates[0]?.dateString} / {currentWeekDates[6]?.dateString}</span>
            </div>
          </div>

          {/* Carved Matrix */}
          <div className="carved-area p-4 sm:p-6 lg:p-10 w-full flex flex-col gap-6 lg:gap-8">
            <div className="overflow-x-auto w-full scrollbar-thin order-1">
              <table className="w-full border-separate border-spacing-y-3 border-spacing-x-2 sm:border-spacing-y-4 sm:border-spacing-x-4 min-w-[640px]">
                <thead>
                  <tr className="etched-text font-label-caps text-[9px] uppercase tracking-[0.3em] text-[#334155] font-bold">
                    <th className="text-left py-2 px-2 sm:px-4 w-1/4">Identifier</th>
                    {currentWeekDates.map((day, idx) => (
                      <th key={idx} className="text-center">
                        {day.dayOfMonth}<br/>
                        <span className="opacity-70 text-[8px]">{DAYS_OF_WEEK[day.dayOfWeek].label}</span>
                      </th>
                    ))}
                    <th className="text-right px-2 sm:px-4 w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="font-body-md">
                  {habits.map((habit) => (
                    <tr key={habit.id}>
                      <td className="px-2 sm:px-4 py-2">
                        <div className="flex flex-col max-w-[120px] sm:max-w-none overflow-hidden">
                          <span className="text-[#334155] font-body-lg etched-text uppercase tracking-widest font-bold text-xs sm:text-sm truncate">{habit.name}</span>
                          <span className="font-label-caps text-[8px] text-[#718096] truncate">
                            {habit.frequency === 'daily' && 'DAILY'}
                            {habit.frequency === 'weekly' && 'WEEKLY'}
                            {habit.frequency === 'specific_days' &&
                              `DAYS: ${habit.frequencyDays.map(d => DAYS_OF_WEEK[d].label).join(', ')}`
                            }
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
                                className={`mx-auto w-8 h-8 sm:w-10 sm:h-10 carved-cell rounded-xl cursor-pointer hover:bg-black/5 transition-all flex items-center justify-center ${
                                  isCompleted ? 'jewel-silver scale-90' : ''
                                }`}
                              >
                                {isCompleted && (
                                  <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)]"></span>
                                )}
                              </div>
                            ) : (
                              <div className="mx-auto w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500/20 select-none">-</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-right px-2 sm:px-4">
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="material-symbols-outlined text-[#718096] hover:text-[#991b1b] transition-colors text-base"
                        >
                          delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {habits.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-8 font-label-caps text-[10px] text-[#718096]">
                        No parameters defined. Deploy one below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Compliance (Only visible below lg) */}
            <div className="lg:hidden order-2 w-full">
              {renderComplianceIndex()}
            </div>

            {/* Creator Form */}
            <div className="embossed-panel p-4 sm:p-6 mt-2 order-3 lg:order-2">
              <h3 className="font-headline-md text-xs sm:text-sm font-bold text-[#334155] uppercase mb-4">Define Vector</h3>
              <form onSubmit={handleAddHabitSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="Parameter Name..."
                    className="w-full carved-cell rounded-xl px-4 py-2.5 bg-[#cbd5e1] text-xs text-[#334155] placeholder-[#718096]/50 border-0 focus:outline-none"
                  />
                  <select
                    value={newHabitFreq}
                    onChange={(e) => setNewHabitFreq(e.target.value as any)}
                    className="w-full carved-cell rounded-xl px-4 py-2.5 bg-[#cbd5e1] text-xs text-[#334155] border-0 focus:outline-none"
                  >
                    <option value="daily">Daily Loop</option>
                    <option value="weekly">Weekly Cycle</option>
                    <option value="specific_days">Specific Vectors</option>
                  </select>
                </div>

                {newHabitFreq === 'specific_days' && (
                  <div className="space-y-2">
                    <label className="block font-label-caps text-[9px] text-[#718096] uppercase tracking-widest">Active Vector Days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day, idx) => {
                        const active = selectedDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDaySelection(idx)}
                            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                              active
                                ? 'jewel-silver text-slate-800 font-bold'
                                : 'carved-cell text-[#718096]'
                            }`}
                          >
                            {day.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl jewel-silver font-label-caps text-[10px] text-[#334155] font-bold uppercase hover:scale-[0.98] transition-transform"
                >
                  DEPLOY VECTOR
                </button>
              </form>
            </div>

            {/* Mobile Completion IDX (Only visible below lg) */}
            <div className="lg:hidden order-4 w-full">
              {renderCompletionIndex()}
            </div>

            {/* Sleep log */}
            <div className="embossed-panel p-4 sm:p-6 order-5 lg:order-3">
              <h3 className="font-headline-md text-xs sm:text-sm font-bold text-[#334155] uppercase mb-4">Sleep Log Coordinates</h3>
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
              <form onSubmit={handleSleepSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <select
                  value={selectedSleepDate}
                  onChange={(e) => setSelectedSleepDate(e.target.value)}
                  className="carved-cell rounded-xl px-2 py-2 bg-[#cbd5e1] text-xs text-[#334155] border-0 focus:outline-none w-full"
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
                  className="carved-cell rounded-xl px-2 py-2 bg-[#cbd5e1] text-xs text-[#334155] border-0 focus:outline-none w-full"
                />
                <button
                  type="submit"
                  className="py-2 rounded-xl jewel-silver font-label-caps text-[9px] text-[#334155] font-bold uppercase w-full hover:scale-[0.98] transition-transform"
                >
                  LOG SLEEP
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
