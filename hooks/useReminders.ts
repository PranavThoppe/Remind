import { useRemindersContext } from '../contexts/RemindersContext';

export function useReminders() {
  return useRemindersContext();
}
