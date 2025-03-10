import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Medication } from '../storage';
import { scheduleMedicationReminder, scheduleRefillReminder } from '../notifications';

const MEDICATIONS_KEY = '@medications';

interface MedicationState {
  medications: Medication[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchMedications: () => Promise<void>;
  addMedication: (medication: Medication) => Promise<void>;
  updateMedication: (medication: Medication) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  refillMedication: (id: string) => Promise<void>;
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  isLoading: false,
  error: null,
  
  fetchMedications: async () => {
    set({ isLoading: true, error: null });
    try {
      const storedData = await AsyncStorage.getItem(MEDICATIONS_KEY);
      const medications = storedData ? JSON.parse(storedData) : [];
      set({ medications, isLoading: false });
    } catch (error) {
      console.error('Error fetching medications:', error);
      set({ error: 'Failed to load medications', isLoading: false });
    }
  },
  
  addMedication: async (medication: Medication) => {
    set({ isLoading: true, error: null });
    try {
      const { medications } = get();
      
      // Add frequency to the medication object if it's not already there
      const medicationWithFrequency = {
        ...medication,
        frequency: medication.frequency || 
          (medication.times.length === 1 ? "Once daily" :
           medication.times.length === 2 ? "Twice daily" :
           medication.times.length === 3 ? "Three times daily" :
           medication.times.length === 4 ? "Four times daily" : "As needed")
      };
      
      const updatedMedications = [...medications, medicationWithFrequency];
      await AsyncStorage.setItem(MEDICATIONS_KEY, JSON.stringify(updatedMedications));
      
      // Schedule reminders if enabled
      if (medicationWithFrequency.reminderEnabled) {
        const notificationIds = await scheduleMedicationReminder(medicationWithFrequency);
        console.log(`Scheduled ${notificationIds.length} medication reminders`);
      }
      
      if (medicationWithFrequency.refillReminder) {
        const refillId = await scheduleRefillReminder(medicationWithFrequency);
        console.log(`Scheduled refill reminder: ${refillId}`);
      }
      
      set({ medications: updatedMedications, isLoading: false });
    } catch (error) {
      console.error('Error adding medication:', error);
      set({ error: 'Failed to add medication', isLoading: false });
      throw error;
    }
  },
  
  updateMedication: async (updatedMedication: Medication) => {
    set({ isLoading: true, error: null });
    try {
      const { medications } = get();
      const updatedMedications = medications.map(med => 
        med.id === updatedMedication.id ? updatedMedication : med
      );
      await AsyncStorage.setItem(MEDICATIONS_KEY, JSON.stringify(updatedMedications));
      
      // Update reminders if needed
      if (updatedMedication.reminderEnabled) {
        await scheduleMedicationReminder(updatedMedication);
      }
      if (updatedMedication.refillReminder) {
        await scheduleRefillReminder(updatedMedication);
      }
      
      set({ medications: updatedMedications, isLoading: false });
    } catch (error) {
      console.error('Error updating medication:', error);
      set({ error: 'Failed to update medication', isLoading: false });
      throw error;
    }
  },
  
  deleteMedication: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { medications } = get();
      const updatedMedications = medications.filter(med => med.id !== id);
      await AsyncStorage.setItem(MEDICATIONS_KEY, JSON.stringify(updatedMedications));
      set({ medications: updatedMedications, isLoading: false });
    } catch (error) {
      console.error('Error deleting medication:', error);
      set({ error: 'Failed to delete medication', isLoading: false });
      throw error;
    }
  },
  
  refillMedication: async (id: string) => {
    try {
      const { medications } = get();
      const medication = medications.find(med => med.id === id);
      
      if (!medication) {
        throw new Error('Medication not found');
      }
      
      const updatedMedication = {
        ...medication,
        currentSupply: medication.totalSupply,
        lastRefillDate: new Date().toISOString(),
      };
      
      await get().updateMedication(updatedMedication);
    } catch (error) {
      console.error('Error refilling medication:', error);
      throw error;
    }
  }
})); 