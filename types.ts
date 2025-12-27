export type Role = 'organizer' | 'attendee';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Simple mock password
  role: Role;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  imageUrl: string;
  organizerId: string;
}

export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface Registration {
  id: string;
  eventId: string;
  participantName: string;
  participantEmail: string;
  status: RegistrationStatus;
  attended: boolean;
  attendanceTime?: string;
  registeredAt: string;
}

export type Tab = 'browse' | 'my-tickets' | 'organizer';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}