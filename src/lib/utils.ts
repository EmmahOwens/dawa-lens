import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely converts various date-like types (Date, string, number, Firestore Timestamp) to a Date object.
 */
export function toDate(date: any): Date {
  if (!date) return new Date();
  
  // Firestore Timestamp check (has .toDate() method)
  if (typeof date.toDate === 'function') {
    return date.toDate();
  }
  
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date() : d;
}
