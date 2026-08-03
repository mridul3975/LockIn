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
  RefreshCw,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Sun
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
  const [isDarkMode, setIsDarkMode] = useState(false);

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
      <div className="flex items-center justify-center min-h-screen bg-black px-4">
        <div className="border border-slate-800/80 p-8 rounded-xl max-w-sm w-full text-center bg-zinc-950/80">
          <h1 className="text-3xl font-black font-mono tracking-widest text-slate-200 mb-8">
            LOCK<span className="text-slate-500">//</span>In
          </h1>
          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-200 text-slate-950 font-mono font-bold text-sm py-3 rounded-lg border border-slate-300 transition-all shadow-sm"
          >
            Sign in with Google
          </button>
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

  const themeClass = isDarkMode ? 'dark-theme' : 'light-theme';

  return (
    <div className={`${themeClass} min-h-screen flex w-full font-mono transition-all duration-300`}>
      
      {/* LEFT SIDEBAR PANEL */}
      <aside className="w-64 sidebar hidden md:flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-8">
          
          {/* Logo & Subtitle */}
          <div>
            <h1 className={`text-2xl font-black font-mono tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              LOCK<span className="text-slate-400">//</span>In
            </h1>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
              OPERATOR V1.1
            </div>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 bg-slate-950/5 p-3 rounded-lg border border-slate-300/30">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt="User Profile"
                className="w-10 h-10 rounded-full border border-slate-300/80 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-mono font-bold text-slate-600 border border-slate-300">
                U
              </div>
            )}
            <div>
              <div className="text-sm font-mono font-bold text-slate-800">
                {session?.user?.name || "Jason"}
              </div>
              <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                Operator
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
              isDarkMode 
                ? 'bg-cyber-neon/10 border border-cyber-neon/30 text-cyber-neon' 
                : 'bg-white border border-slate-300/80 text-slate-800 shadow-sm'
            }`}>
              <LayoutGrid className="h-4 w-4" />
              <span>MATRIX</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-bold uppercase text-slate-400 hover:text-slate-600 transition-all">
              <TrendingUp className="h-4 w-4" />
              <span>TRENDS</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-bold uppercase text-slate-400 hover:text-slate-600 transition-all">
              <ShieldCheck className="h-4 w-4" />
              <span>COMPLIANCE</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-bold uppercase text-slate-400 hover:text-slate-600 transition-all">
              <Settings className="h-4 w-4" />
              <span>SETTINGS</span>
            </button>
          </nav>
        </div>

        {/* Theme Switcher Toggle at bottom */}
        <div className="border-t border-slate-300/30 pt-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-300/60 bg-white hover:bg-slate-50 text-xs font-mono font-bold uppercase text-slate-600 transition-all shadow-sm"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-700" />}
            <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
      </aside>

      {/* MAIN MAIN CONTENT CONTAINER */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* Top Navigation Row */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 mb-8 gap-4 border-b border-slate-300/30">
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-2xl font-black font-mono tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                DAILY HABIT MATRIX
              </h2>
              <span className="h-2.5 w-2.5 rounded-full bg-cyber-neon animate-pulse" />
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
              • ACTIVE PROTOCOL
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Action */}
            <button
              onClick={syncWithDb}
              disabled={isSyncing}
              className="flex items-center gap-2 font-mono text-xs font-bold px-3 py-2 rounded-lg transition-all border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>SYNC</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="font-mono text-xs font-bold px-3 py-2 rounded-lg border border-red-300/40 bg-red-100 hover:bg-red-200 text-red-700 transition-all"
            >
              LOGOUT
            </button>
          </div>
        </header>

        {/* Main Columns Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Habit Matrix & Creator */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Habit Table plate */}
            <div className="glass-card rounded-xl p-6 transition-all">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-slate-400" />
                  <h3 className={`text-md font-mono font-bold tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Daily Habit Matrix
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300/20 pb-3">
                      <th className="text-left font-mono text-xs text-slate-500 font-semibold uppercase pb-3 pr-4">Habit</th>
                      {currentWeekDates.map((day, idx) => {
                        const isToday = day.dateString === todayDateStr;
                        return (
                          <th key={idx} className={`text-center pb-3 px-1 ${isToday && !isDarkMode ? 'highlight-day-col rounded-t-lg' : ''}`}>
                            <div className="flex flex-col items-center justify-center p-1.5 min-w-[44px]">
                              <span className={`text-xs font-mono font-bold uppercase ${isToday ? 'text-slate-800' : 'text-slate-400'}`}>
                                {DAYS_OF_WEEK[day.dayOfWeek].label}
                              </span>
                              <span className={`text-[10px] font-mono mt-0.5 ${isToday ? 'text-slate-700' : 'text-slate-600'}`}>
                                {day.dayOfMonth}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="text-center font-mono text-xs text-slate-500 font-semibold uppercase pb-3 pl-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300/10">
                    {habits.map((habit) => (
                      <tr key={habit.id} className="group hover:bg-slate-900/5 transition-all">
                        <td className="py-4 pr-4">
                          <div className={`font-mono text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{habit.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5 uppercase tracking-wide">
                            {habit.frequency === 'daily' && 'Daily'}
                            {habit.frequency === 'weekly' && 'Weekly'}
                            {habit.frequency === 'specific_days' &&
                              `Days: ${habit.frequencyDays.map(d => DAYS_OF_WEEK[d].label).join(', ')}`
                            }
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
                          const isToday = day.dateString === todayDateStr;

                          return (
                            <td key={idx} className={`text-center py-2 px-1 ${isToday && !isDarkMode ? 'highlight-day-col' : ''}`}>
                              {isScheduled ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleDay(habit.id, day.dateString)}
                                  className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
                                    isCompleted
                                      ? 'neu-checkbox-checked font-bold'
                                      : 'neu-checkbox-unchecked'
                                  }`}
                                >
                                  {isCompleted && <Check className="h-4 w-4 stroke-[3px]" />}
                                </button>
                              ) : (
                                <div className="w-8 h-8 flex items-center justify-center text-slate-400/30 text-xs font-mono font-bold select-none">
                                  //
                                </div>
                              )}
                            </td>
                          );
                        })}

                        <td className="text-center py-2 pl-4">
                          <button
                            onClick={() => deleteHabit(habit.id)}
                            className="text-xs font-mono text-slate-400 hover:text-red-500 uppercase font-bold transition-all"
                            title="Purge Habit"
                          >
                            delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Ghost Rows for Demo */}
                    {habits.length === 0 && (
                      <>
                        {[
                          'Wake up at 5:30',
                          'Gym Training',
                          'Project Deep Work',
                          'Drink 4L Water'
                        ].map((ghostName, idx) => (
                          <tr key={`ghost-${idx}`} className="opacity-30 select-none pointer-events-none border-b border-slate-300/10">
                            <td className="py-4 pr-4">
                              <div className="font-mono text-sm font-medium text-slate-600 italic">{ghostName}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wide">Daily</div>
                            </td>
                            {currentWeekDates.map((day, dayIdx) => {
                              const isToday = day.dateString === todayDateStr;
                              return (
                                <td key={dayIdx} className={`text-center py-2 px-1 ${isToday && !isDarkMode ? 'highlight-day-col' : ''}`}>
                                  <div className={`w-8 h-8 rounded mx-auto flex items-center justify-center ${
                                    isDarkMode 
                                      ? 'border border-slate-800 bg-slate-950/20' 
                                      : 'neu-checkbox-unchecked'
                                  } text-transparent`}>
                                    <Check className="h-4 w-4" />
                                  </div>
                                </td>
                              );
                            })}
                            <td className="text-center py-2 pl-4">
                              <span className="text-xs font-mono text-slate-300 uppercase">delete</span>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Creator form */}
            <div className="glass-card rounded-xl p-6 transition-all">
              <h3 className={`text-md font-mono font-bold tracking-widest uppercase mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                New Habit
              </h3>
              <form onSubmit={handleAddHabitSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">Habit Label</label>
                    <input
                      type="text"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                      placeholder="e.g. Meditate 15m"
                      className={`w-full border rounded px-3 py-2 text-sm font-mono ${
                        isDarkMode 
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-700 focus:border-cyber-neon' 
                          : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-slate-500 font-mono shadow-inner'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">Frequency</label>
                    <select
                      value={newHabitFreq}
                      onChange={(e) => setNewHabitFreq(e.target.value as any)}
                      className={`w-full border rounded px-3 py-2 text-sm font-mono ${
                        isDarkMode 
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-cyber-neon' 
                          : 'bg-white border-slate-300 text-slate-800 focus:border-slate-500 font-mono shadow-sm'
                      }`}
                    >
                      <option value="daily">Daily Loop</option>
                      <option value="weekly">Weekly Checklist</option>
                      <option value="specific_days">Specific Days</option>
                    </select>
                  </div>
                </div>

                {newHabitFreq === 'specific_days' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Active Week Days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day, idx) => {
                        const active = selectedDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDaySelection(idx)}
                            className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all ${
                              active
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
                  className={`flex items-center gap-2 font-mono font-bold text-xs uppercase px-4 py-2.5 rounded transition-all shadow-sm ${
                    isDarkMode 
                      ? 'bg-cyber-neon hover:bg-emerald-400 text-slate-950 shadow-neon-glow' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  <Plus className="h-4 w-4" /> Add Habit
                </button>
              </form>
            </div>
          </div>

          {/* Column 2: Analytics & Sleep */}
          <div className="space-y-8">
            
            {/* Live Progress Card */}
            <div className="glass-card rounded-xl p-6 transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">PROTOCOL PROGRESS</span>
                <span className="text-sm font-mono text-slate-800 font-bold">{todayCompletionPercentage}%</span>
              </div>
              <h4 className={`text-md font-mono font-bold tracking-widest uppercase mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Current Matrix
              </h4>
              <p className="text-[10px] font-mono text-slate-500 mb-4 uppercase">
                {todayCompletedCount} OF {todayHabits.length || 4} PARAMETERS MET
              </p>
              <div className="w-full h-3 bg-slate-950/10 rounded-full overflow-hidden border border-slate-300/30 p-[1px]">
                <div
                  className="h-full bg-slate-400/60 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${todayCompletionPercentage}%` }}
                />
              </div>
            </div>

            {/* Compliance card */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="glass-card rounded-xl p-6 transition-all flex flex-col items-center select-none"
            >
              <div className="w-full flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-500" />
                  <h3 className={`text-sm font-mono font-bold tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    PERFORMANCE
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">STEEL INDEX</span>
              </div>

              {/* Slider switch */}
              <div className="flex bg-slate-950/5 p-1 rounded-lg border border-slate-300/60 mb-6 w-full shadow-inner">
                {(['day', 'week', 'month'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setComplianceMode(mode)}
                    className={`flex-1 text-center py-1.5 rounded-md text-xs font-mono font-bold transition-all uppercase ${
                      complianceMode === mode
                        ? (isDarkMode 
                            ? 'bg-cyber-neon text-slate-950 shadow-neon-glow' 
                            : 'bg-white text-slate-800 border border-slate-300 shadow-sm')
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="relative w-40 h-40 flex items-center justify-center cursor-ew-resize">
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
                          fill={entry.name === 'Completed' ? (isDarkMode ? '#10B981' : '#64748b') : (isDarkMode ? '#1e293b' : '#cbd5e1')} 
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black font-mono tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    {activeComplianceScore}%
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center mt-0.5">
                    COMPLIANCE
                  </span>
                </div>
              </div>

              <div className="text-[9px] font-mono text-slate-400 mt-2">
                ← Swipe donut to change cycle →
              </div>

              <div className="w-full grid grid-cols-2 gap-4 mt-4 text-center border-t border-slate-300/30 pt-4">
                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase mb-0.5">MET</div>
                  <div className={`text-lg font-mono font-bold ${isDarkMode ? 'text-cyber-neon' : 'text-slate-700'}`}>
                    {weeklyCompletedCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase mb-0.5 text-red-500">MISSED</div>
                  <div className={`text-lg font-mono font-bold ${isDarkMode ? 'text-cyber-rose' : 'text-red-600'}`}>
                    {weeklyMissedCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Sleep card */}
            <div className="glass-card rounded-xl p-6 transition-all">
              <div className="flex items-center gap-2 mb-4">
                <Moon className="h-5 w-5 text-slate-500" />
                <h3 className={`text-md font-mono font-bold tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Sleep Schedule
                </h3>
              </div>

              <div className="h-40 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sleepGraphData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sleepColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isDarkMode ? '#3B82F6' : '#64748b'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={isDarkMode ? '#3B82F6' : '#64748b'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontFamily="monospace" tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" tickLine={false} domain={[0, 12]} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#090D16' : '#f1f5f9', 
                        borderColor: isDarkMode ? '#3B82F6' : '#cbd5e1', 
                        borderRadius: '6px' 
                      }}
                      labelStyle={{ fontFamily: 'monospace', color: '#64748b', fontSize: '10px' }}
                      itemStyle={{ fontFamily: 'monospace', color: isDarkMode ? '#f8fafc' : '#1e293b', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="hours" stroke={isDarkMode ? '#3B82F6' : '#64748b'} strokeWidth={2} fillOpacity={1} fill="url(#sleepColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <form onSubmit={handleSleepSubmit} className="space-y-3 p-3 rounded border border-slate-300/30">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Target Date</label>
                    <select
                      value={selectedSleepDate}
                      onChange={(e) => setSelectedSleepDate(e.target.value)}
                      className={`w-full border rounded px-2 py-1.5 text-xs font-mono ${
                        isDarkMode 
                          ? 'bg-slate-900 border-slate-800 text-white' 
                          : 'bg-white border-slate-300 text-slate-800'
                      }`}
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
                      className={`w-full border rounded px-2 py-1.5 text-xs font-mono ${
                        isDarkMode 
                          ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-700' 
                          : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className={`w-full flex items-center justify-center gap-2 font-mono font-bold text-[10px] uppercase py-2 rounded transition-all ${
                    isDarkMode 
                      ? 'bg-cyber-blue hover:bg-blue-600 text-white' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white shadow-sm'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" /> Log sleep coordinates
                </button>
              </form>
            </div>

          </div>

        </div>

      </main>

    </div>
  );
}
