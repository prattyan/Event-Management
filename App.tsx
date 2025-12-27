import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import {
  Calendar, MapPin, Plus, QrCode, CheckCircle,
  XCircle, Sparkles, ScanLine, LogOut, ArrowRight, UserCircle, KeyRound, Mail, Loader2, Users, ChevronRight, Bell, Send, Image as ImageIcon, Upload, Edit, Filter, Download, Trash2
} from 'lucide-react';
import { format } from 'date-fns';

import { Event, Registration, RegistrationStatus, Tab, Toast, User, Role } from './types';
import {
  getEvents, saveEvent, updateEvent, getRegistrations, addRegistration,
  updateRegistrationStatus, markAttendance, deleteRegistration,
  loginUser, registerUser, subscribeToAuth, logoutUser,
  loginWithGoogle
} from './services/storageService';
import { generateEventDescription } from './services/geminiService';
import { sendStatusUpdateEmail, sendReminderEmail } from './services/notificationService';
import Scanner from './components/Scanner';

// --- Sub-Components ---

const ToastContainer = ({ toasts }: { toasts: Toast[] }) => (
  <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4 sm:px-0">
    {toasts.map(t => (
      <div
        key={t.id}
        className={`pointer-events-auto shadow-lg rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 transform transition-all duration-300 translate-y-0
          ${t.type === 'success' ? 'bg-green-500 text-white' :
            t.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}
      >
        {t.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
        {t.type === 'error' && <XCircle className="w-4 h-4 flex-shrink-0" />}
        <span className="break-words">{t.message}</span>
      </div>
    ))}
  </div>
);

const Badge = ({ status }: { status: RegistrationStatus }) => {
  const styles = {
    [RegistrationStatus.APPROVED]: 'bg-green-100 text-green-800 border-green-200',
    [RegistrationStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
    [RegistrationStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {status}
    </span>
  );
};

// --- Skeletons ---

const EventCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col">
    <div className="h-48 bg-slate-200 animate-pulse" />
    <div className="p-6 flex-1 flex flex-col space-y-4">
      <div className="flex gap-4">
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="h-6 w-3/4 bg-slate-200 rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="h-12 w-full bg-slate-100 rounded-xl mt-auto animate-pulse" />
    </div>
  </div>
);

const TicketSkeleton = () => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-6 animate-pulse">
    <div className="flex-1 w-full space-y-3">
      <div className="flex justify-between md:block">
        <div className="h-5 w-20 bg-slate-200 rounded" />
      </div>
      <div className="h-6 w-48 bg-slate-200 rounded" />
      <div className="flex gap-3">
        <div className="h-4 w-24 bg-slate-200 rounded" />
        <div className="h-4 w-32 bg-slate-200 rounded" />
      </div>
    </div>
    <div className="w-full md:w-32 h-12 bg-slate-200 rounded-xl" />
  </div>
);

const ListRowSkeleton = () => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-pulse">
    <div className="space-y-3 w-full sm:w-1/2">
      <div className="h-6 w-3/4 bg-slate-200 rounded" />
      <div className="h-4 w-1/2 bg-slate-200 rounded" />
    </div>
    <div className="h-10 w-full sm:w-24 bg-slate-200 rounded-lg" />
  </div>
);

// --- Main App Component ---

export default function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthMode, setIsAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'attendee' as Role });

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEventForReg, setSelectedEventForReg] = useState<Event | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Registration | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Organizer View State
  const [organizerSelectedEventId, setOrganizerSelectedEventId] = useState<string | null>(null);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RegistrationStatus>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');

  // Form States
  const [newEvent, setNewEvent] = useState({ title: '', date: '', location: '', description: '', capacity: '', imageUrl: '' });
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // --- Initialization ---

  // Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      // Only update if we are not already logged in with this user to avoid jitter
      // (though React handles this efficiently usually)
      setCurrentUser(user);
      if (user) {
        if (user.role === 'organizer') {
          setActiveTab('organizer');
        } else {
          setActiveTab('browse');
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Loading
  const loadData = async () => {
    setDataLoading(true);
    try {
      const [loadedEvents, loadedRegs] = await Promise.all([
        getEvents(),
        getRegistrations()
      ]);
      setEvents(loadedEvents);
      setRegistrations(loadedRegs);
    } catch (e) {
      addToast('Failed to load data', 'error');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // --- Auth Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const user = await loginUser(authForm.email, authForm.password);
    setAuthLoading(false);

    if (user) {
      setCurrentUser(user);
      if (user.role === 'organizer') setActiveTab('organizer');
      else setActiveTab('browse');
      addToast(`Welcome back, ${user.name}!`, 'success');
    } else {
      addToast('Invalid email or password', 'error');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    const newUser = await registerUser({
      name: authForm.name,
      email: authForm.email,
      role: authForm.role
    }, authForm.password);

    setAuthLoading(false);

    if (newUser) {
      setCurrentUser(newUser);
      if (newUser.role === 'organizer') setActiveTab('organizer');
      else setActiveTab('browse');
      addToast('Account created successfully!', 'success');
    } else {
      addToast('Registration failed. Email might be in use.', 'error');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null); // Ensure immediate local state clear
    setAuthForm({ name: '', email: '', password: '', role: 'attendee' });
    addToast('Logged out successfully', 'info');
  };

  // --- App Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Simple size check: 2MB limit for base64 performance
      if (file.size > 2 * 1024 * 1024) {
        addToast('Image size should be less than 2MB', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEvent(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);

      // Reset input value so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  const resetEventForm = () => {
    setNewEvent({ title: '', date: '', location: '', description: '', capacity: '', imageUrl: '' });
    setIsEditMode(false);
    setEditingEventId(null);
  };

  const handleEditClick = (event: Event) => {
    // Format date for datetime-local input (YYYY-MM-DDThh:mm)
    const d = new Date(event.date);
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());

    setNewEvent({
      title: event.title,
      date: dateStr,
      location: event.location,
      description: event.description,
      capacity: event.capacity.toString(),
      imageUrl: event.imageUrl || ''
    });
    setEditingEventId(event.id);
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !currentUser || !newEvent.capacity) return;

    const evtDataCommon = {
      title: newEvent.title,
      date: newEvent.date,
      location: newEvent.location,
      description: newEvent.description,
      capacity: parseInt(newEvent.capacity) || 0,
      imageUrl: newEvent.imageUrl || `https://picsum.photos/800/400?random=${Math.floor(Math.random() * 100)}`,
      organizerId: currentUser.id
    };

    let success = false;

    if (isEditMode && editingEventId) {
      success = await updateEvent({ id: editingEventId, ...evtDataCommon });
      if (success) addToast('Event updated successfully', 'success');
    } else {
      const created = await saveEvent(evtDataCommon);
      success = !!created;
      if (success) addToast('Event created successfully', 'success');
    }

    if (success) {
      await loadData();
      setIsCreateModalOpen(false);
      resetEventForm();
    } else {
      addToast(isEditMode ? 'Failed to update event' : 'Failed to create event', 'error');
    }
  };

  const handleGenerateDescription = async () => {
    if (!newEvent.title || !newEvent.date) {
      addToast('Please enter a title and date first', 'error');
      return;
    }
    setIsGeneratingAI(true);
    const desc = await generateEventDescription(newEvent.title, newEvent.date, newEvent.location);
    setNewEvent(prev => ({ ...prev, description: desc }));
    setIsGeneratingAI(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForReg || !currentUser) return;

    // Use current user's email
    const email = currentUser.email;

    // Check existing
    const exists = registrations.find(r =>
      r.eventId === selectedEventForReg.id && r.participantEmail === email
    );

    if (exists) {
      addToast('You are already registered for this event', 'error');
      return;
    }

    const regData = {
      eventId: selectedEventForReg.id,
      participantName: currentUser.name,
      participantEmail: email,
      status: RegistrationStatus.PENDING,
      attended: false,
      registeredAt: new Date().toISOString()
    };

    const created = await addRegistration(regData);

    if (created) {
      await loadData();
      setSelectedEventForReg(null);
      addToast('Registration submitted! Waiting for approval.', 'success');
    } else {
      addToast('Registration failed', 'error');
    }
  };

  const handleStatusUpdate = async (regId: string, status: RegistrationStatus) => {
    // 1. Update Database
    await updateRegistrationStatus(regId, status);

    // 2. Send Notification
    // We need to look up the registration and event details. 
    // We use the local state before refreshing, assuming it matches the ID.
    const reg = registrations.find(r => r.id === regId);
    const event = events.find(e => e.id === reg?.eventId);

    if (reg && event) {
      addToast(`Updating status and notifying user...`, 'info');
      await sendStatusUpdateEmail(reg.participantEmail, reg.participantName, event.title, status);
    }

    // 3. Refresh Data
    await loadData();
    addToast(`Participant ${status.toLowerCase()} and notified`, 'success');
  };

  const handleSendReminders = async (event: Event) => {
    if (!confirm(`Send email reminders to all approved attendees for "${event.title}"?`)) return;

    setIsSendingReminders(true);

    const approvedRegs = registrations.filter(
      r => r.eventId === event.id && r.status === RegistrationStatus.APPROVED
    );

    if (approvedRegs.length === 0) {
      addToast('No approved attendees to notify.', 'info');
      setIsSendingReminders(false);
      return;
    }

    let count = 0;
    // Send in parallel (or sequential if avoiding rate limits, but parallel is fine for simulation)
    await Promise.all(approvedRegs.map(async (reg) => {
      await sendReminderEmail(
        reg.participantEmail,
        reg.participantName,
        event.title,
        event.date,
        event.location
      );
      count++;
    }));

    setIsSendingReminders(false);
    addToast(`Sent reminders to ${count} attendees.`, 'success');
  };

  const handleManualAttendance = async (regId: string) => {
    if (!confirm('Mark this participant as present?')) return;

    const success = await markAttendance(regId);

    if (success) {
      addToast('Attendance marked manually', 'success');
      await loadData();
    } else {
      addToast('Failed to mark attendance. Ensure participant is approved.', 'error');
    }
  };

  const handleScan = async (data: string) => {
    try {
      const payload = JSON.parse(data);
      if (!payload.id) throw new Error('Invalid QR Code');

      const success = await markAttendance(payload.id);

      if (success) {
        addToast('Attendance Marked Successfully!', 'success');
        await loadData(); // refresh UI
      } else {
        // We need to find the reg to give specific error
        // Note: registrations state might be slightly stale if not reloaded, but good enough for error msg
        const reg = registrations.find(r => r.id === payload.id);
        if (reg && reg.status !== RegistrationStatus.APPROVED) {
          addToast('Participant is not approved yet!', 'error');
        } else if (reg && reg.attended) {
          addToast('Already marked as attended.', 'info');
        } else {
          addToast('Invalid Ticket or Participant not found', 'error');
        }
      }
    } catch (e) {
      addToast('Invalid QR Code Format', 'error');
    }
  };

  const downloadTicket = () => {
    const svg = document.getElementById('ticket-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    // QR code is size 200, lets make the downloaded image a bit larger with white padding
    const size = 200;
    const padding = 40; // Total padding (20 on each side)
    canvas.width = size + padding;
    canvas.height = size + padding;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding / 2, padding / 2);

        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `EventHorizon-Ticket-${selectedTicket?.id.slice(0, 8)}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        addToast("Ticket downloaded!", "success");
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // --- Views ---

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <ToastContainer toasts={toasts} />
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-4xl w-full flex flex-col md:flex-row border border-slate-200">
          <div className="bg-indigo-600 p-8 md:w-1/2 flex flex-col justify-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80')] bg-cover opacity-20"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold">EventHorizon</h1>
              </div>
              <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
                The all-in-one platform for seamless event management. Create events, register attendees, and check them in with ease.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-indigo-300" />
                  <span>AI-Powered Event Creation</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-indigo-300" />
                  <span>QR Code Ticketing & Check-in</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-indigo-300" />
                  <span>Instant Approval Workflow</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:w-1/2 flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {isAuthMode === 'signin' ? 'Welcome back' : 'Create an account'}
              </h2>
              <p className="text-slate-500 mb-8">
                {isAuthMode === 'signin' ? 'Please enter your details to sign in.' : 'Get started with EventHorizon today.'}
              </p>

              <form onSubmit={isAuthMode === 'signin' ? handleLogin : handleSignup} className="space-y-4">
                {isAuthMode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <UserCircle className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={authForm.name}
                        onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      value={authForm.email}
                      onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      value={authForm.password}
                      onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                    />
                  </div>
                </div>

                {isAuthMode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">I am a...</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAuthForm({ ...authForm, role: 'attendee' })}
                        className={`py-2 px-4 rounded-lg text-sm font-medium border ${authForm.role === 'attendee'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        Participant
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthForm({ ...authForm, role: 'organizer' })}
                        className={`py-2 px-4 rounded-lg text-sm font-medium border ${authForm.role === 'organizer'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        Organizer
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {authLoading ? 'Please wait...' : (isAuthMode === 'signin' ? 'Sign In' : 'Create Account')}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setAuthLoading(true);
                  try {
                    // Default role for Google Login if new user? 
                    // We can default to attendee, or rely on them being prompted later? 
                    // For now, let's assume 'attendee' if not specified, 
                    // but ideally the user should pick role first if it's signup.
                    // However, for simplicity here, we pass the role currently selected in form if in signup mode, 
                    // or 'attendee' if in signin mode (though signin doesn't matter if user exists).
                    const role = isAuthMode === 'signup' ? authForm.role : 'attendee';
                    const user = await loginWithGoogle(role);
                    if (user) {
                      setCurrentUser(user);
                      addToast('Welcome back!', 'success');
                    } else {
                      addToast('Google Sign In failed', 'error');
                    }
                  } catch (e) {
                    console.error(e);
                    addToast('Something went wrong', 'error');
                  } finally {
                    setAuthLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>

              <div className="mt-6 text-center text-sm text-slate-600">
                {isAuthMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setIsAuthMode(isAuthMode === 'signin' ? 'signup' : 'signin')}
                  className="font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  {isAuthMode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated Views ---

  const renderHeader = () => (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg flex-shrink-0">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="hidden sm:block text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            EventHorizon
          </span>
        </div>

        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
          {currentUser.role === 'attendee' && (
            <>
              <button
                onClick={() => setActiveTab('browse')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${activeTab === 'browse' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Browse
              </button>
              <button
                onClick={() => setActiveTab('my-tickets')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${activeTab === 'my-tickets' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Tickets
              </button>
            </>
          )}

          {currentUser.role === 'organizer' && (
            <>
              <button
                onClick={() => setActiveTab('organizer')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${activeTab === 'organizer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('browse')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${activeTab === 'browse' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Events
              </button>
            </>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-medium text-slate-900">{currentUser.name}</span>
            <span className="text-xs text-slate-500 capitalize">{currentUser.role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );

  const renderEvents = () => {
    const visibleEvents = currentUser.role === 'organizer'
      ? events.filter(e => e.organizerId === currentUser.id)
      : events;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {currentUser.role === 'organizer' && activeTab === 'browse' ? 'My Hosted Events' : 'Upcoming Events'}
            </h2>
            <p className="text-slate-500 mt-1">Discover and join amazing experiences.</p>
          </div>
          {currentUser.role === 'organizer' && (
            <button
              onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-200"
            >
              <Plus className="w-4 h-4" /> Create Event
            </button>
          )}
        </div>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <EventCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleEvents.map(event => (
              <div key={event.id} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full">
                <div className="relative h-48 overflow-hidden">
                  <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-slate-700 shadow-sm">
                    {event.location}
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1 text-indigo-600 font-medium">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(event.date), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="w-4 h-4" />
                      {event.capacity} seats
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h3>
                  <p className="text-slate-500 text-sm line-clamp-3 mb-6 flex-1 whitespace-pre-line">{event.description}</p>

                  {currentUser.role === 'attendee' && (
                    (() => {
                      const isRegistered = registrations.some(r => r.eventId === event.id && r.participantEmail === currentUser.email);
                      return (
                        <button
                          onClick={() => !isRegistered && setSelectedEventForReg(event)}
                          disabled={isRegistered}
                          className={`w-full mt-auto font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border ${isRegistered
                            ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                            : 'bg-slate-50 hover:bg-indigo-50 text-slate-900 hover:text-indigo-700 border-slate-200 hover:border-indigo-200'
                            }`}
                        >
                          {isRegistered ? (
                            <>
                              <CheckCircle className="w-4 h-4" /> Already Registered
                            </>
                          ) : 'Register Now'}
                        </button>
                      );
                    })()
                  )}
                </div>
              </div>
            ))}
            {visibleEvents.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                No events found.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMyTickets = () => {
    // Filter registrations for this logged in user
    const myRegs = registrations.filter(r => r.participantEmail === currentUser.email);

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">My Tickets</h2>
        {dataLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <TicketSkeleton key={i} />)}
          </div>
        ) : (
          <div className="space-y-4">
            {myRegs.map(reg => {
              const event = events.find(e => e.id === reg.eventId);
              if (!event) return null;

              return (
                <div key={reg.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
                  <div className="flex-1 w-full md:w-auto">
                    <div className="flex justify-between md:block mb-2 md:mb-0">
                      <Badge status={reg.status} />
                      <span className="md:hidden text-xs text-slate-400">ID: {reg.id.slice(0, 8)}...</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">{event.title}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-slate-500 text-sm">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(event.date), 'MMM d, yyyy')}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
                    </div>
                    <div className="hidden md:block mt-2 text-xs text-slate-400">ID: {reg.id.slice(0, 8)}...</div>
                  </div>

                  {reg.status !== RegistrationStatus.APPROVED && (
                    <div className="flex gap-2 w-full md:w-auto">
                      <div className="flex-1 px-5 py-3 text-slate-400 text-sm font-medium text-center bg-slate-50 rounded-xl">
                        {reg.status === RegistrationStatus.PENDING ? 'Waiting for approval' : 'Registration Rejected'}
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to cancel your request?')) {
                            await deleteRegistration(reg.id);
                            addToast('Registration cancelled', 'info');
                            loadData();
                          }
                        }}
                        className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                        title="Cancel Request"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {reg.status === RegistrationStatus.APPROVED && (
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={() => setSelectedTicket(reg)}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                      >
                        <QrCode className="w-4 h-4" /> View Ticket
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to cancel your ticket?')) {
                            await deleteRegistration(reg.id);
                            addToast('Ticket cancelled', 'info');
                            loadData();
                          }
                        }}
                        className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                        title="Cancel Ticket"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {myRegs.length === 0 && (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                No tickets yet. Go register for some events!
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOrganizer = () => {
    // Only show events created by this organizer
    const myEvents = events.filter(e => e.organizerId === currentUser.id);

    // If no event selected, show list
    if (!organizerSelectedEventId) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Organizer Dashboard</h2>
              <p className="text-slate-500 text-sm">Manage your events and attendees</p>
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              <button
                onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 font-medium"
              >
                <Plus className="w-4 h-4" /> New Event
              </button>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200"
              >
                <ScanLine className="w-4 h-4" /> Scan
              </button>
            </div>
          </div>

          {dataLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => <ListRowSkeleton key={i} />)}
            </div>
          ) : (
            <>
              {/* Mobile View: Cards */}
              <div className="block md:hidden space-y-4">
                {myEvents.map(event => {
                  const eventRegs = registrations.filter(r => r.eventId === event.id);
                  const pendingCount = eventRegs.filter(r => r.status === RegistrationStatus.PENDING).length;
                  return (
                    <div key={event.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm" onClick={() => { setOrganizerSelectedEventId(event.id); setStatusFilter('ALL'); setAttendanceFilter('ALL'); }}>
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-slate-900 line-clamp-1">{event.title}</h3>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(event.date), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                          {eventRegs.length} / {event.capacity} registered
                        </span>
                        {pendingCount > 0 && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium">
                            {pendingCount} pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {myEvents.length === 0 && (
                  <div className="text-center text-slate-400 py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    No events created yet.
                  </div>
                )}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-slate-700">Event Name</th>
                      <th className="px-6 py-4 font-semibold text-slate-700">Date</th>
                      <th className="px-6 py-4 font-semibold text-slate-700">Registrations</th>
                      <th className="px-6 py-4 font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myEvents.map(event => {
                      const eventRegs = registrations.filter(r => r.eventId === event.id);
                      const pendingCount = eventRegs.filter(r => r.status === RegistrationStatus.PENDING).length;

                      return (
                        <tr key={event.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{event.title}</td>
                          <td className="px-6 py-4 text-slate-500">{format(new Date(event.date), 'MMM d, yyyy')}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-700">{eventRegs.length} / {event.capacity}</span>
                              {pendingCount > 0 && (
                                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                                  {pendingCount} pending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => { setOrganizerSelectedEventId(event.id); setStatusFilter('ALL'); setAttendanceFilter('ALL'); }}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {myEvents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          You haven't created any events yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      );
    }

    // Details for specific event
    const event = events.find(e => e.id === organizerSelectedEventId);
    let eventRegs = registrations.filter(r => r.eventId === organizerSelectedEventId);

    // Filter Logic
    if (statusFilter !== 'ALL') {
      eventRegs = eventRegs.filter(r => r.status === statusFilter);
    }
    if (attendanceFilter !== 'ALL') {
      eventRegs = eventRegs.filter(r => attendanceFilter === 'PRESENT' ? r.attended : !r.attended);
    }

    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => setOrganizerSelectedEventId(null)}
          className="mb-4 text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1"
        >
          ← Back to Events
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{event?.title}</h2>
            <p className="text-slate-500">Manage participants and approvals</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => event && handleEditClick(event)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 font-medium"
            >
              <Edit className="w-4 h-4" /> Edit Event
            </button>
            <button
              onClick={() => event && handleSendReminders(event)}
              disabled={isSendingReminders}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 font-medium disabled:opacity-50"
            >
              {isSendingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Send Reminders
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200"
            >
              <ScanLine className="w-4 h-4" /> Scan Ticket
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mr-2">
            <Filter className="w-4 h-4" /> Filters:
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium uppercase">Status</label>
            <select
              className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Statuses</option>
              <option value={RegistrationStatus.PENDING}>Pending</option>
              <option value={RegistrationStatus.APPROVED}>Approved</option>
              <option value={RegistrationStatus.REJECTED}>Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium uppercase">Attendance</label>
            <select
              className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none"
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value as any)}
            >
              <option value="ALL">All Attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent / Not Scanned</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-slate-500">
            Showing {eventRegs.length} result{eventRegs.length !== 1 ? 's' : ''}
          </div>
        </div>

        {dataLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <ListRowSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {/* Mobile View: Participant Cards */}
            <div className="block md:hidden space-y-4">
              {eventRegs.map(reg => (
                <div key={reg.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="overflow-hidden">
                      <div className="font-medium text-slate-900 truncate">{reg.participantName}</div>
                      <div className="text-xs text-slate-500 truncate">{reg.participantEmail}</div>
                    </div>
                    <Badge status={reg.status} />
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <div className="text-sm">
                      {reg.attended ? (
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle className="w-4 h-4" /> Present</span>
                          {reg.attendanceTime && (
                            <span className="text-xs text-slate-500">
                              {format(new Date(reg.attendanceTime), 'h:mm a')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not Scanned</span>
                      )}
                    </div>

                    {reg.status === RegistrationStatus.PENDING && (
                      <div className="flex gap-2">
                        <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)} className="p-1.5 bg-green-50 text-green-600 rounded-lg border border-green-200" title="Approve"><CheckCircle className="w-5 h-5" /></button>
                        <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)} className="p-1.5 bg-red-50 text-red-600 rounded-lg border border-red-200" title="Reject"><XCircle className="w-5 h-5" /></button>
                      </div>
                    )}

                    {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                      <button
                        onClick={() => handleManualAttendance(reg.id)}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                      >
                        Mark Present
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {eventRegs.length === 0 && (
                <div className="text-center text-slate-400 py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  No registrations found matching criteria.
                </div>
              )}
            </div>

            {/* Desktop View: Participant Table */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-700">Participant</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Email</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Attendance</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Time</th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eventRegs.map(reg => (
                    <tr key={reg.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{reg.participantName}</td>
                      <td className="px-6 py-4 text-slate-500">{reg.participantEmail}</td>
                      <td className="px-6 py-4"><Badge status={reg.status} /></td>
                      <td className="px-6 py-4">
                        {reg.attended ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle className="w-4 h-4" /> Present
                          </span>
                        ) : (
                          <span className="text-slate-400">Not yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {reg.attendanceTime ? format(new Date(reg.attendanceTime), 'h:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {reg.status === RegistrationStatus.PENDING && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-md"
                              title="Approve"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                          <button
                            onClick={() => handleManualAttendance(reg.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium hover:underline"
                          >
                            Mark Present
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {eventRegs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No registrations found matching criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20">
      {renderHeader()}
      <ToastContainer toasts={toasts} />

      <main className="pt-6">
        {activeTab === 'browse' && renderEvents()}
        {activeTab === 'my-tickets' && renderMyTickets()}
        {activeTab === 'organizer' && renderOrganizer()}
      </main>

      {/* --- MODALS --- */}

      {/* CREATE / EDIT EVENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Event' : 'Create New Event'}</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Image</label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-full h-32 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden group">
                      {newEvent.imageUrl ? (
                        <>
                          <img src={newEvent.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs flex items-center gap-1"><Upload className="w-3 h-3" /> Change Image</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewEvent(prev => ({ ...prev, imageUrl: '' }));
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-white text-slate-600 rounded-full shadow-md hover:bg-red-50 hover:text-red-600 transition-colors z-20"
                            title="Remove Image"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-xs text-slate-500">Click to upload cover image</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={newEvent.title}
                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="e.g. Summer Tech Gala"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newEvent.date}
                      onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newEvent.location}
                      onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                      placeholder="City or Venue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newEvent.capacity}
                    onChange={e => setNewEvent({ ...newEvent, capacity: e.target.value })}
                    placeholder="Max attendees"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingAI}
                      className="text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-2 py-1 rounded-md flex items-center gap-1 hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isGeneratingAI ? 'Generating...' : 'AI Assist'}
                    </button>
                  </div>
                  <textarea
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                    value={newEvent.description}
                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Describe your event..."
                  ></textarea>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    {isEditMode ? 'Update Event' : 'Publish Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MODAL */}
      {selectedEventForReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 p-6 text-white relative">
              <button onClick={() => setSelectedEventForReg(null)} className="absolute top-4 right-4 text-white/70 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold">{selectedEventForReg.title}</h3>
              <p className="text-indigo-200 text-sm mt-1">{format(new Date(selectedEventForReg.date), 'MMMM d, yyyy')}</p>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-6">
                You are registering as <span className="font-semibold text-slate-900">{currentUser.name}</span> ({currentUser.email}).
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedEventForReg(null)}
                  className="flex-1 bg-white border border-slate-300 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegister}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TICKET QR MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all scale-100">
            <div className="p-6 text-center border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Digital Ticket</h3>
              <p className="text-sm text-slate-500">Scan this at the entrance</p>
            </div>
            <div className="p-8 flex flex-col items-center justify-center bg-white">
              <div className="p-4 bg-white border-2 border-dashed border-indigo-200 rounded-xl mb-4">
                <QRCode
                  id="ticket-qr-code"
                  value={JSON.stringify({ id: selectedTicket.id, eventId: selectedTicket.eventId })}
                  size={200}
                  level="M"
                />
              </div>
              <button
                onClick={downloadTicket}
                className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Ticket
              </button>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-sm font-medium text-slate-900">{selectedTicket.participantName}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">
                {selectedTicket.attended ? <span className="text-green-600">Attended</span> : 'Valid Entry'}
              </p>
              <button onClick={() => setSelectedTicket(null)} className="mt-4 text-indigo-600 text-sm font-medium hover:underline">
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCANNER MODAL */}
      {isScannerOpen && (
        <Scanner
          onScan={handleScan}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

    </div>
  );
}