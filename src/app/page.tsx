"use client";

import React, { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useHabitStore, Habit, HabitLog } from '@/store/useHabitStore';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Days of the week utility
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

  // Active view navigation (for mobile toggle or visual highlighting)
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
      <div className="flex items-center justify-center min-h-screen bg-[#f2f5f9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full neumorphic-extruded flex items-center justify-center bg-[#f2f5f9] animate-spin">
            <span className="material-symbols-outlined text-[#475569]">sync</span>
          </div>
          <span className="font-label-caps text-xs text-[#718096]">INITIALIZING PROTOCOL...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f2f5f9] px-4">
        <div className="p-10 rounded-3xl neumorphic-extruded max-w-sm w-full text-center bg-[#f2f5f9]">
          <h1 className="font-headline-lg text-3xl font-black text-[#475569] tracking-tighter mb-1">
            LOCK//In
          </h1>
          <p className="font-label-caps text-[10px] text-[#718096] uppercase tracking-widest mb-8">
            PLATINUM V1.1
          </p>
          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-3 bg-[#f2f5f9] hover:bg-[#e4e7ea] text-[#475569] font-label-caps font-bold py-4 px-6 rounded-xl neumorphic-extruded active:neumorphic-inset transition-all"
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

  // Weekly Completion Statistics
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

  // Donut chart path calculation to avoid heavy Recharts dependency for the exact neumorphic svg look
  const strokeDasharray = 452;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * activeComplianceScore) / 100;

  return (
    <div className="flex min-h-screen bg-[#f2f5f9] text-[#2c3e50] w-full font-sans">

      {/* SideNavBar (Platform Anchor) */}
      <aside className="hidden md:flex flex-col p-8 gap-6 h-screen sticky top-0 w-64 bg-[#f2f5f9] neumorphic-extruded z-50 border-r border-white/20 shrink-0">
        <div className="mb-6">
          <h1 className="font-headline-md text-2xl font-black text-[#475569] tracking-tighter">LOCK//In</h1>
          <p className="font-label-caps text-[10px] text-[#718096] mt-1">PLATINUM V1.1</p>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full neumorphic-extruded flex items-center justify-center bg-[#f2f5f9]">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt="User Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-[#475569] text-xl">person</span>
            )}
          </div>
          <div>
            <p className="font-body-md text-sm font-bold text-[#2d3748] leading-tight">
              {session?.user?.name || "Jason"}
            </p>
            <p className="font-label-caps text-[9px] text-[#718096]">Operator</p>
          </div>
        </div>
        <nav className="flex flex-col gap-4">
          <button
            onClick={() => setActiveView('matrix')}
            className={`flex items-center gap-3 text-left w-full rounded-xl p-4 transition-all hover:scale-[1.02] ${
              activeView === 'matrix'
                ? 'text-[#475569] bg-[#f2f5f9] neumorphic-inset'
                : 'text-[#718096]'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeView === 'matrix' ? "'FILL' 1" : "'FILL' 0" }}>grid_view</span>
            <span className="font-label-caps text-[10px] uppercase font-bold">Matrix</span>
          </button>
          <button
            onClick={() => setActiveView('trends')}
            className={`flex items-center gap-3 text-left w-full rounded-xl p-4 transition-all hover:scale-[1.02] ${
              activeView === 'trends'
                ? 'text-[#475569] bg-[#f2f5f9] neumorphic-inset'
                : 'text-[#718096]'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeView === 'trends' ? "'FILL' 1" : "'FILL' 0" }}>trending_up</span>
            <span className="font-label-caps text-[10px] uppercase font-bold">Trends</span>
          </button>
          <button
            onClick={() => setActiveView('compliance')}
            className={`flex items-center gap-3 text-left w-full rounded-xl p-4 transition-all hover:scale-[1.02] ${
              activeView === 'compliance'
                ? 'text-[#475569] bg-[#f2f5f9] neumorphic-inset'
                : 'text-[#718096]'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeView === 'compliance' ? "'FILL' 1" : "'FILL' 0" }}>verified</span>
            <span className="font-label-caps text-[10px] uppercase font-bold">Compliance</span>
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className={`flex items-center gap-3 text-left w-full rounded-xl p-4 transition-all hover:scale-[1.02] ${
              activeView === 'settings'
                ? 'text-[#475569] bg-[#f2f5f9] neumorphic-inset'
                : 'text-[#718096]'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: activeView === 'settings' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
            <span className="font-label-caps text-[10px] uppercase font-bold">Settings</span>
          </button>
        </nav>
        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-[#718096] p-4 w-full hover:scale-[1.02] transition-transform text-left"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span className="font-label-caps text-[10px] uppercase font-bold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto overflow-y-auto pb-24 md:pb-8">
        
        {/* TopNavBar */}
        <header className="w-full sticky top-0 bg-[#f2f5f9] z-40 px-8 py-6 flex justify-between items-center shadow-[inset_0_-1px_0_rgba(255,255,255,0.4)] md:shadow-none">
          <div className="flex flex-col">
            <h2 className="font-headline-md text-2xl font-bold tracking-tighter text-[#475569] uppercase drop-shadow-sm">Daily Habit Matrix</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full silver-gradient animate-pulse shadow-sm"></span>
              <span className="font-label-caps text-[10px] text-[#718096]">FOCUSED STATUS</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-3 px-6 py-4 neumorphic-inset rounded-full">
              <span className="material-symbols-outlined text-[#718096] text-sm">calendar_today</span>
              <span className="font-label-caps text-[10px] text-[#2d3748]">WEEK INDEX: {currentWeekDates[0]?.dateString} to {currentWeekDates[6]?.dateString}</span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={syncWithDb}
                disabled={isSyncing}
                className="px-8 py-4 neumorphic-extruded active:neumorphic-inset rounded-xl text-[#475569] font-label-caps font-bold transition-all flex items-center gap-2"
              >
                <span className={`material-symbols-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                SYNC
              </button>
            </div>
          </div>
        </header>

        {/* Content Columns */}
        <div className="p-8 grid grid-cols-12 gap-6">
          
          {/* Column 1: Habit Matrix & Form (8 Cols) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            
            {/* Habit Table Container */}
            <div className="bg-[#f2f5f9] p-8 rounded-3xl neumorphic-extruded">
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-4 border-spacing-x-1">
                  <thead>
                    <tr className="text-[#718096] font-label-caps text-[10px] uppercase tracking-[0.2em]">
                      <th className="text-left py-2 px-4 w-1/4">Habit</th>
                      {currentWeekDates.map((day, idx) => {
                        const isToday = day.dateString === todayDateStr;
                        return (
                          <th key={idx} className="text-center py-2">
                            {isToday ? (
                              <div className="bg-[#94a3b8]/5 p-2 rounded-xl text-[#475569] neumorphic-inset-sm inline-block min-w-[48px]">
                                {day.dayOfMonth}<br/>
                                <span className="text-[9px] font-bold">{DAYS_OF_WEEK[day.dayOfWeek].label}</span>
                              </div>
                            ) : (
                              <div className="min-w-[48px]">
                                {day.dayOfMonth}<br/>
                                <span className="text-[9px] text-[#718096]">{DAYS_OF_WEEK[day.dayOfWeek].label}</span>
                              </div>
                            )}
                          </th>
                        );
                      })}
                      <th className="text-right px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-sm">
                    {habits.map((habit) => (
                      <tr key={habit.id} className="group">
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-[#2d3748] font-bold drop-shadow-sm">{habit.name}</span>
                            <span className="font-label-caps text-[9px] text-[#718096]">
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
                                  className={`mx-auto w-10 h-10 neumorphic-inset rounded-xl cursor-pointer flex items-center justify-center transition-all hover:scale-95 ${
                                    isCompleted ? 'silver-gradient scale-95 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.2)]' : 'hover:bg-black/5'
                                  }`}
                                >
                                  {isCompleted && (
                                    <span className="material-symbols-outlined text-white text-lg font-bold drop-shadow-md">check</span>
                                  )}
                                </div>
                              ) : (
                                <div className="mx-auto w-10 h-10 flex items-center justify-center text-[#718096]/20 font-mono text-xs select-none">
                                  -
                                </div>
                              )}
                            </td>
                          );
                        })}

                        <td className="text-right px-4">
                          <button
                            onClick={() => deleteHabit(habit.id)}
                            className="material-symbols-outlined text-[#718096] opacity-30 hover:opacity-100 cursor-pointer transition-opacity text-lg"
                          >
                            delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {habits.length === 0 && (
                      <tr className="opacity-40">
                        <td colSpan={9} className="text-center py-8 font-label-caps text-xs text-[#718096]">
                          NO ACTIVE HABITS. CREATE A PARAMETER BELOW.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Habit Creator Form Card */}
            <div className="bg-[#f2f5f9] p-8 rounded-3xl neumorphic-extruded">
              <h3 className="font-headline-md text-lg font-bold tracking-tighter text-[#475569] uppercase mb-6">
                Define New Parameter
              </h3>
              <form onSubmit={handleAddHabitSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-label-caps text-[9px] text-[#718096] uppercase tracking-widest mb-2">Habit Name</label>
                    <input
                      type="text"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                      placeholder="e.g. Wake up at 5:30"
                      className="w-full neumorphic-inset rounded-xl px-4 py-3 bg-[#f2f5f9] text-sm text-[#2d3748] placeholder-[#718096]/50 focus:outline-none border-0"
                    />
                  </div>
                  <div>
                    <label className="block font-label-caps text-[9px] text-[#718096] uppercase tracking-widest mb-2">Frequency Matrix</label>
                    <select
                      value={newHabitFreq}
                      onChange={(e) => setNewHabitFreq(e.target.value as any)}
                      className="w-full neumorphic-inset rounded-xl px-4 py-3 bg-[#f2f5f9] text-sm text-[#2d3748] focus:outline-none border-0"
                    >
                      <option value="daily">Daily Loop</option>
                      <option value="weekly">Weekly Cycle</option>
                      <option value="specific_days">Specific Vectors</option>
                    </select>
                  </div>
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
                                ? 'silver-gradient text-white shadow-md'
                                : 'neumorphic-extruded text-[#718096]'
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
                  className="px-6 py-3 font-label-caps font-bold text-xs uppercase bg-[#f2f5f9] text-[#475569] neumorphic-extruded active:neumorphic-inset rounded-xl flex items-center gap-2 hover:scale-[1.02] transition-transform"
                >
                  <span className="material-symbols-outlined text-sm">add</span> Add Parameter
                </button>
              </form>
            </div>

          </div>

          {/* Column 2: Analytics Sideboard (4 Cols) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            
            {/* Completion Index Card */}
            <div className="bg-[#f2f5f9] p-8 rounded-3xl neumorphic-extruded">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-label-caps text-[10px] text-[#718096] uppercase tracking-widest">Completion Index</h3>
                <span className="font-headline-md text-xl font-bold text-[#475569]">{todayCompletionPercentage}%</span>
              </div>
              <div className="mb-6">
                <h4 className="font-headline-md text-lg font-bold text-[#2d3748] leading-tight">Today's Matrix</h4>
                <p className="font-label-caps text-[9px] text-[#718096] uppercase mt-2">Completed: {todayCompletedCount} / {todayHabits.length} Active</p>
              </div>
              <div className="w-full h-6 neumorphic-inset rounded-full p-1 overflow-hidden">
                <div
                  className="h-full silver-gradient rounded-full shadow-[0_0_12px_rgba(148,163,184,0.6)] transition-all duration-1000"
                  style={{ width: `${todayCompletionPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Compliance Radial Donut Card */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="bg-[#f2f5f9] p-8 rounded-3xl neumorphic-extruded flex flex-col select-none"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#475569] text-sm">trending_up</span>
                  <h3 className="font-label-caps text-[10px] text-[#2d3748] uppercase font-bold">Compliance</h3>
                </div>
                <span className="font-label-caps text-[9px] text-[#718096]">PLATINUM INDEX</span>
              </div>
              
              <div className="flex justify-center mb-8">
                <div className="flex p-1 neumorphic-inset rounded-xl">
                  {(['day', 'week', 'month'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setComplianceMode(mode)}
                      className={`px-5 py-2 font-label-caps text-[9px] rounded-lg transition-all ${
                        complianceMode === mode
                          ? 'silver-gradient text-white shadow-sm'
                          : 'text-[#718096]'
                      }`}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex items-center justify-center py-6">
                {/* Outer ring */}
                <div className="w-48 h-48 rounded-full neumorphic-extruded flex items-center justify-center bg-[#f2f5f9]">
                  {/* Inner ring */}
                  <div className="w-36 h-36 rounded-full neumorphic-inset flex flex-col items-center justify-center relative bg-[#f2f5f9]">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle
                        className="text-[#94a3b8]/10"
                        cx="50%"
                        cy="50%"
                        fill="transparent"
                        r="62"
                        stroke="currentColor"
                        strokeWidth="8"
                      ></circle>
                      <circle
                        className="text-[#475569]/80 drop-shadow-[0_0_10px_rgba(148,163,184,0.5)]"
                        cx="50%"
                        cy="50%"
                        fill="transparent"
                        r="62"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                      ></circle>
                    </svg>
                    <span className="font-headline-lg text-2xl font-black text-[#2d3748]">{activeComplianceScore}%</span>
                    <span className="font-label-caps text-[8px] text-[#718096] uppercase mt-1">
                      {complianceMode === 'day' ? 'Day Score' : complianceMode === 'week' ? 'Week Score' : 'Month Score'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-center font-label-caps text-[9px] text-[#718096] mb-6 opacity-75">
                Swipe compliance vector or click toggle
              </p>

              <div className="grid grid-cols-2 gap-4 border-t border-white/40 pt-6">
                <div className="text-center">
                  <p className="font-label-caps text-[9px] text-[#718096] uppercase">Completed</p>
                  <p className="font-headline-md text-lg font-bold text-[#475569] mt-1">
                    {complianceMode === 'day' ? todayCompletedCount : complianceMode === 'week' ? weeklyCompletedCount : monthlyScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-label-caps text-[9px] text-red-600 uppercase">Missed</p>
                  <p className="font-headline-md text-lg font-bold text-[#991b1b]/80 mt-1">
                    {complianceMode === 'day' ? (todayHabits.length - todayCompletedCount) : complianceMode === 'week' ? weeklyMissedCount : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sleep Schedule Neumorphic Card */}
            <div className="bg-[#f2f5f9] p-8 rounded-3xl neumorphic-extruded">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[#718096] text-lg">bedtime</span>
                <h3 className="font-headline-md text-lg font-bold text-[#475569] uppercase">Sleep Coordinates</h3>
              </div>

              <div className="h-40 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sleepGraphData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sleepColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#718096" fontSize={10} fontFamily="monospace" tickLine={false} />
                    <YAxis stroke="#718096" fontSize={10} fontFamily="monospace" tickLine={false} domain={[0, 12]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#f2f5f9',
                        borderColor: '#c5cedd',
                        borderRadius: '12px',
                        boxShadow: '4px 4px 10px rgba(0,0,0,0.05)'
                      }}
                      labelStyle={{ fontFamily: 'monospace', color: '#718096', fontSize: '10px' }}
                      itemStyle={{ fontFamily: 'monospace', color: '#2d3748', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="hours" stroke="#475569" strokeWidth={2} fillOpacity={1} fill="url(#sleepColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <form onSubmit={handleSleepSubmit} className="space-y-4 p-4 rounded-2xl neumorphic-inset bg-[#f2f5f9]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label-caps text-[8px] text-[#718096] uppercase tracking-widest mb-1">Target Vector</label>
                    <select
                      value={selectedSleepDate}
                      onChange={(e) => setSelectedSleepDate(e.target.value)}
                      className="w-full bg-[#f2f5f9] text-xs font-mono text-[#2d3748] focus:outline-none border-0"
                    >
                      {currentWeekDates.map(day => (
                        <option key={day.dateString} value={day.dateString}>
                          {DAYS_OF_WEEK[day.dayOfWeek].name.substring(0, 3)} ({day.dayOfMonth})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-caps text-[8px] text-[#718096] uppercase tracking-widest mb-1">Hours Logged</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={sleepHoursInput}
                      onChange={(e) => setSleepHoursInput(e.target.value)}
                      placeholder="e.g. 7.5"
                      className="w-full bg-[#f2f5f9] text-xs font-mono text-[#2d3748] placeholder-[#718096]/40 focus:outline-none border-0"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 font-label-caps font-bold text-[9px] uppercase py-2 bg-[#f2f5f9] text-[#475569] neumorphic-extruded active:neumorphic-inset rounded-xl transition-all"
                >
                  <span className="material-symbols-outlined text-[10px]">offline_pin</span> Log Sleep Coordinates
                </button>
              </form>
            </div>

          </div>

        </div>

      </main>

      {/* BottomNavBar for Mobile (Platform Anchor) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#f2f5f9] py-4 px-6 flex justify-between items-center shadow-[0_-12px_24px_rgba(197,206,221,0.5)] z-50">
        <button
          onClick={() => setActiveView('matrix')}
          className={`flex flex-col items-center ${activeView === 'matrix' ? 'text-[#475569]' : 'text-[#718096]'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === 'matrix' ? "'FILL' 1" : "'FILL' 0" }}>grid_view</span>
          <span className="font-label-caps text-[9px] mt-1">MATRIX</span>
        </button>
        <button
          onClick={() => setActiveView('trends')}
          className={`flex flex-col items-center ${activeView === 'trends' ? 'text-[#475569]' : 'text-[#718096]'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === 'trends' ? "'FILL' 1" : "'FILL' 0" }}>trending_up</span>
          <span className="font-label-caps text-[9px] mt-1">TRENDS</span>
        </button>
        <div className="w-14 h-14 -mt-10 neumorphic-extruded silver-gradient rounded-full flex items-center justify-center text-white border-2 border-[#f2f5f9] shadow-md active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-2xl">add</span>
        </div>
        <button
          onClick={() => setActiveView('compliance')}
          className={`flex flex-col items-center ${activeView === 'compliance' ? 'text-[#475569]' : 'text-[#718096]'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === 'compliance' ? "'FILL' 1" : "'FILL' 0" }}>verified</span>
          <span className="font-label-caps text-[9px] mt-1">COMPLY</span>
        </button>
        <button
          onClick={() => setActiveView('settings')}
          className={`flex flex-col items-center ${activeView === 'settings' ? 'text-[#475569]' : 'text-[#718096]'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === 'settings' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
          <span className="font-label-caps text-[9px] mt-1">SETTINGS</span>
        </button>
      </nav>

    </div>
  );
}
