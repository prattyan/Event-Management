export type Role = 'organizer' | 'attendee';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Simple mock password
  role: Role;
}

export interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'boolean';
  required: boolean;
  options?: string[]; // For 'select' type, comma separated in UI?
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string; // Start Date/Time
  endDate: string; // End Date/Time
  location: string;
  locationType?: 'online' | 'offline';
  capacity: number;
  imageUrl: string;
  organizerId: string;
  isRegistrationOpen?: boolean;
  customQuestions?: CustomQuestion[];
}

export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
}

export interface Registration {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  status: RegistrationStatus;
  attended: boolean;
  attendanceTime?: string;
  registeredAt: string;
  answers?: Record<string, string>; // questionId -> answer
}

export type Tab = 'browse' | 'my-tickets' | 'organizer';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface Message {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}