import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DoseHistory } from '../storage';

const DOSE_HISTORY_KEY = '@dose_history';

interface DoseHistoryState {
  doseHistory: DoseHistory[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchDoseHistory: () => Promise<void>;
  getTodaysDoses: () => DoseHistory[];
  recordDose: (medicationId: string, taken: boolean, timestamp: string, scheduledTime?: string) => Promise<void>;
}

export const useDoseHistoryStore = create<DoseHistoryState>((set, get) => ({
  doseHistory: [],
  isLoading: false,
  error: null,
  
  fetchDoseHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const storedData = await AsyncStorage.getItem(DOSE_HISTORY_KEY);
      const doseHistory = storedData ? JSON.parse(storedData) : [];
      set({ doseHistory, isLoading: false });
    } catch (error) {
      console.error('Error fetching dose history:', error);
      set({ error: 'Failed to load dose history', isLoading: false });
    }
  },
  
  getTodaysDoses: () => {
    const { doseHistory } = get();
    const today = new Date().toDateString();
    return doseHistory.filter(dose => 
      new Date(dose.timestamp).toDateString() === today
    );
  },
  
  recordDose: async (medicationId: string, taken: boolean, timestamp: string, scheduledTime?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { doseHistory } = get();
      const newDose: DoseHistory = { 
        medicationId, 
        taken, 
        timestamp,
        scheduledTime 
      };
      const updatedHistory = [...doseHistory, newDose];
      
      await AsyncStorage.setItem(DOSE_HISTORY_KEY, JSON.stringify(updatedHistory));
      set({ doseHistory: updatedHistory, isLoading: false });
    } catch (error) {
      console.error('Error recording dose:', error);
      set({ error: 'Failed to record dose', isLoading: false });
      throw error;
    }
  }
})); 