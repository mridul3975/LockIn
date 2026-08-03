"use client";

import React, { useState, useEffect } from 'react';
import {
  Check,
  Plus,
  Trash2,
  Activity,
  Moon,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Zap,
  RefreshCw
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useHabitStore, Habit, HabitLog } from '@/store/useHabitStore';

// Days of the week utility
const DAYS_OF_WEEK = [
  { label: 'Su', name: 'Sunday' },
  { label: 'M', name: 'Monday' },
  { label: 'T', name: 'Tuesday' },
  { label: 'W', name: 'Wednesday' },
  { label: 'Th', name: 'Thursday' },
  { label: 'F', name: 'Friday' },
  { label: 'Sa', name: 'Saturday' }
];

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();

  // Local state for habit creation form
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitFreq, setNewHabitFreq] = useState<'daily' | 'weekly' | 'specific_days'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Local state for sleep logging
  const [selectedSleepDate, setSelectedSleepDate] = useState('');
  const [sleepHoursInput, setSleepHoursInput] = useState('');

  // Compliance circular progress swipable/toggleable states
  const [complianceMode, setComplianceMode] = useState<'day' | 'week' | 'month'>('day');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

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
    // Set default sleep date to today
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-cyber-neon animate-spin" />
          <span className="text-sm font-mono tracking-widest text-slate-400">INITIALIZING SECURE PROTOCOL...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background relative overflow-hidden px-4">
        {/* Glow behind the login box */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyber-neon/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="glass-card rounded-2xl p-8 max-w-md w-full border border-slate-800/80 text-center relative z-10 shadow-neon-border">
          <div className="flex flex-col items-center mb-8">
            <span className="h-3 w-3 rounded-full bg-cyber-neon mb-3" />
            <h1 className="text-4xl font-black font-mono tracking-widest text-white mb-2">
              LOCK<span className="text-cyber-neon">//</span>IN
            </h1>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Identity Synchronization Required
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-lg text-left">
              <p className="text-xs font-mono text-slate-400 leading-relaxed">
                To isolate and protect your personal productivity engrams, habits, sleep telemetry, and score metrics, secure authentication via Google Sign-In is required.
              </p>
            </div>

            <button
              onClick={() => signIn('google')}
              className="w-full flex items-center justify-center gap-3 bg-cyber-neon hover:bg-emerald-400 text-slate-950 font-mono font-black text-sm uppercase py-3.5 rounded-lg transition-all shadow-neon-glow"
            >
              <Zap className="h-4 w-4 stroke-[3px]" /> Access with Google
            </button>
          </div>

          <div className="mt-8 text-[10px] font-mono text-slate-600">
            SYSTEM STATUS: OPERATIONAL // SECURE PROTOCOL ACTIVE
          </div>
        </div>
      </div>
    );
  }

  // Get current week dates (starting Sunday)
  const currentWeekDates = getCurrentWeekDates();
  const todayDateStr = getTodayString();

  // Helpers
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
    // Distance to Sunday
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

  // --- Dynamic Metric Calculations ---

  // Today's Habit Stats
  const todayHabits = habits.filter(h => {
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'specific_days') {
      const todayDayOfWeek = new Date().getDay();
      return h.frequencyDays.includes(todayDayOfWeek);
    }
    return true; // Simple approximation for weekly
  });

  const todayCompletedCount = todayHabits.reduce((acc, h) => {
    const isCompleted = logs.some(l => l.habitId === h.id && l.date === todayDateStr && l.completed);
    return acc + (isCompleted ? 1 : 0);
  }, 0);

  const todayCompletionPercentage = todayHabits.length > 0
    ? Math.round((todayCompletedCount / todayHabits.length) * 100)
    : 0;

  // Monthly Score Donut Data (Calculated based on logs this calendar month)
  const currentMonthLogs = logs.filter(l => {
    const logDate = new Date(l.date);
    const now = new Date();
    return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
  });

  // Calculate target days of compliance in this month up to today
  // Let's compute a dynamic performance compliance score:
  // (Actual Completed Logs in current month) / (Total target occurrences in current month)
  const computeMonthlyComplianceScore = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayDay = now.getDate();

    let totalTargetOccurrences = 0;
    let actualCompletedOccurrences = 0;

    // Filter active habits
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
          // Approximate weekly as active on Sundays
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

  // Weekly Completion Statistics
  const weeklyHabitCount = habits.length;
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

  // Active compliance score selection based on Day / Week / Month mode
  const activeComplianceScore =
    complianceMode === 'day'
      ? todayCompletionPercentage
      : complianceMode === 'week'
        ? (weeklyTotalTarget > 0 ? Math.round((weeklyCompletedCount / weeklyTotalTarget) * 100) : 0)
        : monthlyScore;

  const donutData = [
    { name: 'Completed', value: activeComplianceScore, color: '#10B981' },
    { name: 'Remaining', value: 100 - activeComplianceScore, color: '#1e293b' }
  ];

  // Touch swipe handlers for shifting compliance mode
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    const modes: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
    const currentIndex = modes.indexOf(complianceMode);

    if (isLeftSwipe) {
      const nextIndex = Math.min(modes.length - 1, currentIndex + 1);
      setComplianceMode(modes[nextIndex]);
    } else if (isRightSwipe) {
      const prevIndex = Math.max(0, currentIndex - 1);
      setComplianceMode(modes[prevIndex]);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Sleep Logging Graph Setup (Past 7 days)
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

  // Actions handlers
  const handleToggleDay = (habitId: string, dateString: string) => {
    toggleHabit(habitId, dateString);
  };

  const handleAddHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    addHabit(newHabitName, newHabitFreq, selectedDays);
    setNewHabitName('');
    // Reset selections
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl relative">

      {/* 1. Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name || 'User Profile'}
              className="w-10 h-10 rounded-full border border-cyber-neon/50 shadow-neon-glow"
            />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-cyber-neon animate-pulse" />
              <h1 className="text-3xl font-black font-mono tracking-wider text-white">
                LOCK<span className="text-cyber-neon">//</span>IN
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-950 border border-cyber-neon/40 text-cyber-neon tracking-widest uppercase">
                Alpha v1.0
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              OPERATOR: {session?.user?.name || session?.user?.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-slate-950/80 px-4 py-3 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyber-neon" />
            <span className="text-sm font-mono font-medium text-slate-200">
              WEEK INDEX: {currentWeekDates[0].dateString} to {currentWeekDates[6].dateString}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-800 hidden md:block" />

          <button
            onClick={syncWithDb}
            disabled={isSyncing}
            className={`flex items-center gap-2 font-mono text-xs font-semibold px-2.5 py-1 rounded transition-colors ${isSyncing
                ? 'bg-slate-900 text-slate-500 cursor-not-allowed'
                : 'bg-cyber-neon/10 border border-cyber-neon/30 text-cyber-neon hover:bg-cyber-neon/20'
              }`}
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'SYNCING...' : 'SYNC SQLITE'}
          </button>

          <div className="h-4 w-[1px] bg-slate-800" />

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-1 rounded transition-colors bg-cyber-rose/10 border border-cyber-rose/30 text-cyber-rose hover:bg-cyber-rose/20"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT & CENTER: Habit matrix grid */}
        <div className="lg:col-span-2 space-y-8">

          {/* A. Dynamic Habit Matrix Table */}
          <div className="glass-card rounded-xl p-6 neon-glow-border transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyber-neon" />
                <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-white">Daily Habit Matrix</h2>
              </div>
            </div>

            <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/60 pb-3">
                        <th className="text-left font-mono text-xs text-slate-500 font-semibold uppercase pb-3 pr-4">Habit</th>
                        {currentWeekDates.map((day, idx) => {
                          const isToday = day.dateString === todayDateStr;
                          return (
                            <th key={idx} className="text-center pb-3 px-1">
                              <div className={`flex flex-col items-center justify-center p-1.5 rounded min-w-[44px] ${isToday ? 'bg-cyber-neon/10 border border-cyber-neon/30' : ''
                                }`}>
                                <span className={`text-xs font-mono font-bold uppercase ${isToday ? 'text-cyber-neon' : 'text-slate-400'
                                  }`}>
                                  {DAYS_OF_WEEK[day.dayOfWeek].label}
                                </span>
                                <span className={`text-[10px] font-mono mt-0.5 ${isToday ? 'text-cyber-neon/80' : 'text-slate-600'
                                  }`}>
                                  {day.dayOfMonth}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                        <th className="text-center font-mono text-xs text-slate-500 font-semibold uppercase pb-3 pl-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {habits.map((habit) => (
                        <tr key={habit.id} className="group hover:bg-slate-900/20 transition-all">
                          {/* Habit Name / Freq details */}
                          <td className="py-4 pr-4">
                            <div className="font-mono text-sm font-medium text-white">{habit.name}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5 uppercase tracking-wide">
                              {habit.frequency === 'daily' && 'Daily'}
                              {habit.frequency === 'weekly' && 'Weekly'}
                              {habit.frequency === 'specific_days' &&
                                `Days: ${habit.frequencyDays.map(d => DAYS_OF_WEEK[d].label).join(', ')}`
                              }
                            </div>
                          </td>

                          {/* Week grid checkboxes */}
                          {currentWeekDates.map((day, idx) => {
                            // Check if habit is scheduled for this day
                            let isScheduled = false;
                            if (habit.frequency === 'daily') isScheduled = true;
                            else if (habit.frequency === 'specific_days') isScheduled = habit.frequencyDays.includes(day.dayOfWeek);
                            else if (habit.frequency === 'weekly') isScheduled = day.dayOfWeek === 0; // standard sunday check

                            const isCompleted = logs.some(
                              (l) => l.habitId === habit.id && l.date === day.dateString && l.completed
                            );

                            return (
                              <td key={idx} className="text-center py-2 px-1">
                                {isScheduled ? (
                                  <button
                                    onClick={() => handleToggleDay(habit.id, day.dateString)}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${isCompleted
                                        ? 'bg-cyber-neon text-slate-950 shadow-neon-glow hover:bg-emerald-400'
                                        : 'border border-slate-700 bg-slate-950/50 hover:border-cyber-neon/50 hover:bg-cyber-neon/5 text-transparent hover:text-slate-600'
                                      }`}
                                  >
                                    <Check className="h-4 w-4 stroke-[3px]" />
                                  </button>
                                ) : (
                                  <div className="w-8 h-8 flex items-center justify-center text-slate-800 text-xs font-mono font-black select-none">
                                //
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Delete action */}
                          <td className="text-center py-2 pl-4">
                            <button
                              onClick={() => deleteHabit(habit.id)}
                              className="p-2 text-slate-600 hover:text-cyber-rose rounded hover:bg-cyber-rose/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Purge Habit"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {habits.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-sm font-mono text-slate-500">
                            NO ACTIVE HABIT MODULES DETECTED. INITIALIZE ONE BELOW.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* B. Habit Creator Form */}
              <div className="glass-card rounded-xl p-6 border border-slate-800">
                <h3 className="text-md font-mono font-bold tracking-widest uppercase mb-4 text-white">Initialize Habit Module</h3>

                <form onSubmit={handleAddHabitSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">Habit Label</label>
                      <input
                        type="text"
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
                        placeholder="e.g. Meditate 15m"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyber-neon font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">Frequency</label>
                      <select
                        value={newHabitFreq}
                        onChange={(e) => setNewHabitFreq(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-neon font-mono"
                      >
                        <option value="daily">Daily Loop</option>
                        <option value="weekly">Weekly Checklist</option>
                        <option value="specific_days">Specific Cycle</option>
                      </select>
                    </div>
                  </div>

                  {newHabitFreq === 'specific_days' && (
                    <div className="bg-slate-950/60 p-3 rounded border border-slate-800/80">
                      <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">Select Active Days</label>
                      <div className="flex gap-2 flex-wrap">
                        {DAYS_OF_WEEK.map((day, idx) => {
                          const selected = selectedDays.includes(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggleDaySelection(idx)}
                              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${selected
                                  ? 'bg-cyber-neon text-slate-950 font-bold'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700'
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
                    className="flex items-center gap-2 bg-cyber-neon hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs uppercase px-4 py-2.5 rounded transition-all shadow-neon-glow"
                  >
                    <Plus className="h-4 w-4" /> Add Habit
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT COLUMN: Analytics, Sleep tracker, and Compliance score */}
            <div className="space-y-8">

              {/* A. Live Progress Meter */}
              <div className="glass-card rounded-xl p-6 border border-slate-800/80">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-slate-400 tracking-wider uppercase">Live Completion Bar</span>
                  <span className="text-sm font-mono text-cyber-neon font-bold">{todayCompletionPercentage}%</span>
                </div>

                <h3 className="text-md font-mono font-bold tracking-widest uppercase mb-1 text-white">Today's Matrix</h3>
                <p className="text-xs font-mono text-slate-500 mb-4">COMPLETED: {todayCompletedCount} / {todayHabits.length} ACTIVE</p>

                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyber-neon transition-all duration-500 shadow-neon-glow"
                    style={{ width: `${todayCompletionPercentage}%` }}
                  />
                </div>
              </div>

              {/* B. Compliance Score Donut (Day / Week / Month Swipable/Toggleable) */}
              <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="glass-card rounded-xl p-6 border border-slate-800/80 flex flex-col items-center select-none"
              >
                <div className="w-full flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-cyber-neon" />
                    <h3 className="text-sm font-mono font-bold tracking-widest uppercase text-slate-200">Compliance</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Interactive Radial</span>
                </div>

                {/* Slider Switcher */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800/80 mb-6 w-full">
                  {(['day', 'week', 'month'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setComplianceMode(mode)}
                      className={`flex-1 text-center py-1.5 rounded-md text-xs font-mono font-bold transition-all uppercase ${
                        complianceMode === mode
                          ? 'bg-cyber-neon text-slate-950 shadow-neon-glow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="relative w-40 h-40 flex items-center justify-center cursor-ew-resize" title="Swipe left/right to change mode">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={70}
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={0}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            style={entry.name === 'Completed' ? { filter: 'drop-shadow(0px 0px 4px rgba(16,185,129,0.3))' } : {}}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-black font-mono tracking-tighter text-white">{activeComplianceScore}%</span>
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center mt-0.5">
                      {complianceMode} Score
                    </span>
                  </div>
                </div>

                <div className="text-[9px] font-mono text-slate-600 mt-2">
                  ← Swipe donut to change cycle →
                </div>

                <div className="w-full grid grid-cols-2 gap-4 mt-4 text-center border-t border-slate-800/60 pt-4">
                  <div>
                    <div className="text-xs font-mono text-slate-500 uppercase mb-0.5">COMPLETED</div>
                    <div className="text-md font-mono text-cyber-neon font-black">{weeklyCompletedCount}</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-slate-500 uppercase mb-0.5">MISSED</div>
                    <div className="text-md font-mono text-cyber-rose font-black">{weeklyMissedCount}</div>
                  </div>
                </div>
              </div>

              {/* C. Sleep Log Input and chart */}
              <div className="glass-card rounded-xl p-6 border border-slate-800/80">
                <div className="flex items-center gap-2 mb-4">
                  <Moon className="h-5 w-5 text-cyber-blue" />
                  <h3 className="text-md font-mono font-bold tracking-widest uppercase text-white">Sleep telemetry</h3>
                </div>

                <div className="h-40 w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sleepGraphData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sleepColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} fontFamily="monospace" tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} fontFamily="monospace" tickLine={false} domain={[0, 12]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090D16', borderColor: '#3B82F6', borderRadius: '6px' }}
                        labelStyle={{ fontFamily: 'monospace', color: '#94A3B8', fontSize: '10px' }}
                        itemStyle={{ fontFamily: 'monospace', color: '#f8fafc', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="hours" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#sleepColor)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <form onSubmit={handleSleepSubmit} className="space-y-3 bg-slate-950/60 p-3 rounded border border-slate-900">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Target Date</label>
                      <select
                        value={selectedSleepDate}
                        onChange={(e) => setSelectedSleepDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue font-mono"
                      >
                        {currentWeekDates.map(day => (
                          <option key={day.dateString} value={day.dateString}>
                            {DAYS_OF_WEEK[day.dayOfWeek].name} ({day.dayOfMonth})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Sleep Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={sleepHoursInput}
                        onChange={(e) => setSleepHoursInput(e.target.value)}
                        placeholder="e.g. 7.5"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-cyber-blue font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-cyber-blue hover:bg-blue-600 text-white font-mono font-bold text-[10px] uppercase py-2 rounded transition-all"
                  >
                    <Zap className="h-3.5 w-3.5" /> Log sleep coordinates
                  </button>
                </form>
              </div>

            </div>

          </div>

        </div>
        );
}
