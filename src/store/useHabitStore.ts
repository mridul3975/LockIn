import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'specific_days';
  frequencyDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  order: number;
  createdAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
}

export interface SleepLog {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
}

interface HabitState {
  habits: Habit[];
  logs: HabitLog[];
  sleepLogs: SleepLog[];
  isSyncing: boolean;
  
  // Actions
  toggleHabit: (habitId: string, date: string) => void;
  addHabit: (name: string, frequency: 'daily' | 'weekly' | 'specific_days', frequencyDays?: number[]) => void;
  deleteHabit: (habitId: string) => void;
  reorderHabits: (orderedHabits: Habit[]) => void;
  logSleep: (date: string, hours: number) => void;
  
  // Hydration & Database Syncing
  syncWithDb: () => Promise<void>;
  setInitialData: (habits: Habit[], logs: HabitLog[], sleepLogs: SleepLog[]) => void;
  syncHabitToDb: (habit: Habit) => Promise<void>;
  syncLogToDb: (log: HabitLog) => Promise<void>;
  clearLocalCache: () => void;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      logs: [],
      sleepLogs: [],
      isSyncing: false,

      setInitialData: (habits, logs, sleepLogs) => {
        set({ habits, logs, sleepLogs });
      },

      clearLocalCache: () => {
        set({ habits: [], logs: [], sleepLogs: [] });
      },

      toggleHabit: (habitId, date) => {
        const currentLogs = get().logs;
        const existingLogIndex = currentLogs.findIndex(
          (log) => log.habitId === habitId && log.date === date
        );

        let updatedLogs = [...currentLogs];
        let targetLog: HabitLog;

        if (existingLogIndex >= 0) {
          const log = currentLogs[existingLogIndex];
          targetLog = {
            ...log,
            completed: !log.completed,
            completedAt: !log.completed ? new Date().toISOString() : undefined,
          };
          updatedLogs[existingLogIndex] = targetLog;
        } else {
          targetLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            habitId,
            date,
            completed: true,
            completedAt: new Date().toISOString(),
          };
          updatedLogs.push(targetLog);
        }

        set({ logs: updatedLogs });

        // Trigger optimistic background sync
        get().syncLogToDb(targetLog);
      },

      addHabit: (name, frequency, frequencyDays = [0, 1, 2, 3, 4, 5, 6]) => {
        const newHabit: Habit = {
          id: `h-${Date.now()}`,
          name,
          frequency,
          frequencyDays,
          order: get().habits.length,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          habits: [...state.habits, newHabit],
        }));

        // Sync new habit to db
        get().syncHabitToDb(newHabit);
      },

      deleteHabit: (habitId) => {
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== habitId),
          logs: state.logs.filter((l) => l.habitId !== habitId),
        }));

        // Delete from DB in background
        fetch(`/api/habits?id=${habitId}`, { method: 'DELETE' }).catch(console.error);
      },

      reorderHabits: (orderedHabits) => {
        const updated = orderedHabits.map((h, i) => ({ ...h, order: i }));
        set({ habits: updated });

        // Sync all to DB in background
        fetch('/api/habits/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ habits: updated }),
        }).catch(console.error);
      },

      logSleep: (date, hours) => {
        const currentSleepLogs = get().sleepLogs;
        const existingIndex = currentSleepLogs.findIndex((l) => l.date === date);

        let updated = [...currentSleepLogs];
        const record = {
          id: existingIndex >= 0 ? currentSleepLogs[existingIndex].id : `s-${Date.now()}`,
          date,
          hours,
        };

        if (existingIndex >= 0) {
          updated[existingIndex] = record;
        } else {
          updated.push(record);
        }

        set({ sleepLogs: updated });

        // Sync sleep to DB
        fetch('/api/sleep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }).catch(console.error);
      },

      // Helper sync calls
      syncHabitToDb: async (habit: Habit) => {
        try {
          await fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(habit),
          });
        } catch (e) {
          console.error('Failed to sync habit creation to DB:', e);
        }
      },

      syncLogToDb: async (log: HabitLog) => {
        try {
          await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(log),
          });
        } catch (e) {
          console.error('Failed to sync habit log toggle to DB:', e);
        }
      },

      syncWithDb: async () => {
        set({ isSyncing: true });
        try {
          const res = await fetch('/api/sync-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              habits: get().habits,
              logs: get().logs,
              sleepLogs: get().sleepLogs,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            set({
              habits: data.habits || get().habits,
              logs: data.logs || get().logs,
              sleepLogs: data.sleepLogs || get().sleepLogs,
            });
          }
        } catch (e) {
          console.error('Failed complete DB sync:', e);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'lockin-habits-storage',
      partialize: (state) => ({
        habits: state.habits,
        logs: state.logs,
        sleepLogs: state.sleepLogs,
      }),
    }
  )
);
