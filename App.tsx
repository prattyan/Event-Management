import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import {
  Users, Sparkles, MapPin, ExternalLink, QrCode, ChevronRight, Edit, Calendar, Clock, Plus, ScanLine, Filter, Download, Mail, Send, CheckCircle, XCircle, UserPlus, Info, Trash2, Camera, RefreshCw, Smartphone, Shield, LogOut, Settings as Setting2, Layout, Bell, UserCircle, Search, MoreHorizontal, Check, AlertCircle, CheckSquare, MessageSquare, KeyRound, Share2, Facebook, Twitter, Linkedin, Copy, Star, CalendarPlus, Loader2, Image as ImageIcon, X, ChevronLeft, Link, Save, Upload
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import { format } from 'date-fns';

import { Event as AppEvent, Registration, RegistrationStatus, Tab, Toast, User, Role, CustomQuestion, Review, ParticipationMode, Team } from './types';
import {
  getEvents, saveEvent, updateEvent, getRegistrations, addRegistration,
  updateRegistrationStatus, markAttendance, deleteRegistration, deleteEvent,
  loginUser, registerUser, subscribeToAuth, logoutUser,
  loginWithGoogle, saveUserProfile, resetUserPassword,
  createTeam, getTeamByInviteCode, joinTeam, getTeamsByEventId, getTeamById,
  getNotifications, addNotification, markNotificationRead,
  getMessages, addMessage, getReviews, addReview, deleteAccount, getEventById, getEventImage, getInitialData,
  initRecaptcha, signInWithPhone, verifyPhoneOtp, checkPhoneNumberExists
} from './services/storageService';
import { generateEventDescription, getEventRecommendations } from './services/geminiService';
import { sendStatusUpdateEmail, sendReminderEmail } from './services/notificationService';
import Scanner from './components/Scanner';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LiquidChrome from './components/LiquidChrome';
import { socketService } from './services/socketService';

// --- Sub-Components ---

const ToastContainer = ({ toasts }: { toasts: Toast[] }) => (
  <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 sm:px-0">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={`pointer-events-auto border-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[24px] px-7 py-5 text-sm font-black flex items-center gap-4 relative overflow-hidden
            ${t.type === 'success' ? 'bg-[#020617] border-green-500/30 text-green-400' :
              t.type === 'error' ? 'bg-[#020617] border-red-500/30 text-red-400' :
                t.type === 'warning' ? 'bg-[#020617] border-amber-500/30 text-amber-400' :
                  'bg-[#020617] border-orange-500/30 text-orange-400'
            } `}
        >
          <div className={`absolute -inset-1 opacity-20 blur-xl -z-10 ${t.type === 'success' ? 'bg-green-500' :
            t.type === 'error' ? 'bg-red-500' :
              t.type === 'warning' ? 'bg-amber-500' :
                'bg-orange-500'
            }`} />

          <div className={`p-2 rounded-xl flex-shrink-0 ${t.type === 'success' ? 'bg-green-500/20' :
            t.type === 'error' ? 'bg-red-500/20' :
              t.type === 'warning' ? 'bg-amber-500/20' :
                'bg-orange-500/20'
            }`}>
            {t.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {t.type === 'error' && <XCircle className="w-5 h-5" />}
            {t.type === 'warning' && <AlertCircle className="w-5 h-5" />}
            {(t.type === 'info' || !t.type) && <Info className="w-5 h-5" />}
          </div>
          <span className="flex-1 leading-snug tracking-tight">{t.message}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const Badge = ({ status }: { status: RegistrationStatus }) => {
  const styles = {
    [RegistrationStatus.PENDING]: 'bg-amber-900/40 text-amber-500 border-amber-800',
    [RegistrationStatus.APPROVED]: 'bg-green-900/40 text-green-500 border-green-800',
    [RegistrationStatus.REJECTED]: 'bg-red-900/40 text-red-500 border-red-800',
    [RegistrationStatus.WAITLISTED]: 'bg-orange-900/40 text-orange-400 border-orange-800',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
};

// --- Skeletons ---

const EventCardSkeleton = () => (
  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden h-full flex flex-col">
    <div className="h-48 bg-slate-800 animate-pulse" />
    <div className="p-6 flex-1 flex flex-col space-y-4">
      <div className="flex gap-4">
        <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-16 bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="h-6 w-3/4 bg-slate-800 rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="h-12 w-full bg-slate-800 rounded-xl mt-auto animate-pulse" />
    </div>
  </div>
);

const TicketSkeleton = () => (
  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-6 animate-pulse">
    <div className="flex-1 w-full space-y-3">
      <div className="flex justify-between md:block">
        <div className="h-5 w-20 bg-slate-800 rounded" />
      </div>
      <div className="h-6 w-48 bg-slate-800 rounded" />
      <div className="flex gap-3">
        <div className="h-4 w-24 bg-slate-800 rounded" />
        <div className="h-4 w-32 bg-slate-800 rounded" />
      </div>
    </div>
    <div className="w-full md:w-32 h-12 bg-slate-800 rounded-xl" />
  </div>
);

const ListRowSkeleton = () => (
  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-pulse">
    <div className="space-y-3 w-full sm:w-1/2">
      <div className="h-6 w-3/4 bg-slate-800 rounded" />
      <div className="h-4 w-1/2 bg-slate-800 rounded" />
    </div>
    <div className="h-10 w-full sm:w-24 bg-slate-800 rounded-lg" />
  </div>
);

// --- Helpers ---

const LazyEventImage = ({ eventId, initialSrc, alt, className }: { eventId: string, initialSrc?: string, alt: string, className?: string }) => {
  const [src, setSrc] = useState(initialSrc);
  const [loading, setLoading] = useState(!initialSrc);

  useEffect(() => {
    // If we already have a src (e.g. valid URL or cached), don't fetch
    if (initialSrc && initialSrc.length > 50) { // arbitrary length check for base64/url
      setSrc(initialSrc);
      setLoading(false);
      return;
    }

    let mounted = true;
    if (eventId) {
      getEventImage(eventId).then(url => {
        if (mounted) {
          if (url) setSrc(url);
          setLoading(false);
        }
      }).catch(() => {
        if (mounted) setLoading(false);
      });
    }
    return () => { mounted = false; };
  }, [eventId, initialSrc]);

  if (loading || !src) {
    return (
      <div className={`bg-slate-800 flex items-center justify-center ${className}`}>
        {loading ? <Loader2 className="w-6 h-6 text-slate-600 animate-spin" /> : <ImageIcon className="w-8 h-8 text-slate-700" />}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
};

const getCroppedImg = (imageSrc: string, pixelCrop: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      resolve(canvas.toDataURL('image/jpeg'));
    };
    image.onerror = (e) => reject(e);
  });
};



// --- Main App Component ---

export default function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthMode, setIsAuthMode] = useState<'signin' | 'signup' | 'forgot-password'>('signin');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'attendee' as Role });
  const [resetEmail, setResetEmail] = useState('');

  // Phone Auth State
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<'login' | 'profile' | 'deletion'>('login');

  const renderLocation = (location: string, type: 'online' | 'offline', className?: string) => {
    const isLink = type === 'online' && (location.startsWith('http') || location.includes('.') || location.toLowerCase().includes('zoom') || location.toLowerCase().includes('google.com'));

    if (isLink) {
      const isUrl = location.startsWith('http') || location.includes('.');
      if (isUrl) {
        const url = location.startsWith('http') ? location : `https://${location}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-orange-400 hover:text-orange-300 hover:underline transition-colors flex items-center gap-1 inline-flex ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {location}
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      }
    }
    return <span className={className}>{location}</span>;
  };

  const isPastEvent = (e: AppEvent) => {
    const now = new Date();
    const end = e.endDate ? new Date(e.endDate) : new Date(new Date(e.date).getTime() + 3600000);
    return end < now;
  };

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEventForReg, setSelectedEventForReg] = useState<AppEvent | null>(null);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<AppEvent | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Registration | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'info' | 'discussion'>('info');

  // Organizer View State
  const [organizerSelectedEventId, setOrganizerSelectedEventId] = useState<string | null>(null);
  const [organizerView, setOrganizerView] = useState<'overview' | 'events'>('overview');
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RegistrationStatus>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);

  // Form States
  const [newEvent, setNewEvent] = useState<{
    title: string; date: string; endDate: string; location: string; locationType: 'online' | 'offline'; description: string; capacity: string; imageUrl: string; customQuestions: CustomQuestion[]; collaboratorEmails: string[];
    participationMode: ParticipationMode; maxTeamSize: string;
  }>({
    title: '', date: '', endDate: '', location: '', locationType: 'offline', description: '', capacity: '', imageUrl: '', customQuestions: [], collaboratorEmails: [],
    participationMode: 'individual', maxTeamSize: '5'
  });
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, string>>({});
  const [selectedRegistrationDetails, setSelectedRegistrationDetails] = useState<Registration | null>(null);
  const [teamRegistrationData, setTeamRegistrationData] = useState<{
    mode: 'individual' | 'team';
    subMode: 'create' | 'join';
    teamName: string;
    inviteCode: string;
  }>({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' });

  // Cropper State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [collaboratorEmailInput, setCollaboratorEmailInput] = useState('');
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Socket.io Listener
  useEffect(() => {
    socketService.connect();

    const handleDataUpdate = (data: any) => {
      console.log('⚡ Real-time update:', data);

      if (data.collection === 'events') {
        loadData(true);
        if (data.action === 'insert') {
          addToast(`New event: ${data.document.title}`, 'info');
        }
      } else if (data.collection === 'registrations') {
        // Special logic for "X spots left"
        if (data.action === 'insert' && data.eventId) {
          const event = events.find(e => e.id === data.eventId);
          if (event && event.capacity) {
            const currentRegs = registrations.filter(r => r.eventId === data.eventId && r.status !== RegistrationStatus.REJECTED).length + 1;
            const remaining = Number(event.capacity) - currentRegs;
            if (remaining > 0 && remaining <= 5) {
              addToast(`🔥 Hurry! Only ${remaining} spots left for "${event.title}"`, 'info');
            }
          }
        }
        loadData(true);
      }
    };

    const handleNotification = (data: any) => {
      if (currentUser && data.userId === currentUser.id) {
        addToast(data.message, data.type || 'info');
        loadData(true);
      }
    };

    socketService.on('data_updated', handleDataUpdate);
    socketService.on('notification_received', handleNotification);

    return () => {
      socketService.off('data_updated', handleDataUpdate);
      socketService.off('notification_received', handleNotification);
    };
  }, [currentUser, events, registrations]); // Added events and registrations as dependencies

  // Profile Edit State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<{ name: string; email: string; avatarUrl?: string; phoneNumber?: string; isPhoneVerified?: boolean }>({ name: '', email: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [cropPurpose, setCropPurpose] = useState<'event' | 'profile'>('event'); // Track what we are cropping

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);

    try {
      if (profileForm.phoneNumber && profileForm.phoneNumber !== currentUser.phoneNumber && !profileForm.isPhoneVerified) {
        addToast('Please verify your new phone number before saving', 'error');
        setIsSavingProfile(false);
        return;
      }

      const updatedUser = {
        ...currentUser,
        name: profileForm.name,
        phoneNumber: profileForm.phoneNumber,
        avatarUrl: profileForm.avatarUrl
      };
      await saveUserProfile(updatedUser);
      setCurrentUser(updatedUser);
      addToast('Profile updated', 'success');
      loadData();
    } catch (error) {
      console.error(error);
      addToast('Failed to update profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSendDeleteOtp = async () => {
    if (!currentUser?.phoneNumber) return;
    setAuthLoading(true);
    try {
      const appVerifier = initRecaptcha('persistent-profile-recaptcha');
      const confirmation = await signInWithPhone(currentUser.phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setOtpPurpose('deletion');
      setShowOtpInput(true);
      addToast('OTP Sent for account deletion', 'info');
    } catch (e: any) {
      console.error(e);
      addToast(`Failed to send OTP: ${e.message}`, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!currentUser || !otp) return;
    setAuthLoading(true);
    try {
      await confirmationResult.confirm(otp);
      const success = await deleteAccount(currentUser.id, currentUser.role === 'organizer');
      if (success) {
        addToast('Account deleted permanently', 'success');
        setCurrentUser(null);
        setIsProfileModalOpen(false);
      } else {
        addToast('Failed to delete some account data', 'error');
      }
    } catch (e) {
      addToast('Invalid OTP', 'error');
    } finally {
      setAuthLoading(false);
      setShowOtpInput(false);
      setOtp('');
    }
  };

  // Data Loading
  const loadData = async (isSilent = false) => {
    if (!isSilent) setDataLoading(true);
    try {
      const initialData = await getInitialData(currentUser ? currentUser.id : undefined);
      const evts = initialData.events || [];
      const regs = initialData.registrations || [];
      const notifs = initialData.notifications || [];

      setEvents(evts);
      setRegistrations(regs);
      setNotifications(notifs);

      if (currentUser) {
        // Fetch teams for events user is registered for AND events they organize (if organizer)
        const userEventIds = regs.filter(r => r.participantEmail === currentUser.email).map(r => r.eventId);
        const organizedEventIds = currentUser.role === 'organizer' ? evts.filter(e => e.organizerId === currentUser.id).map(e => e.id) : [];
        const allEventIdsToFetchTeams = Array.from(new Set([...userEventIds, ...organizedEventIds]));

        if (allEventIdsToFetchTeams.length > 0) {
          const allTeams = await Promise.all(allEventIdsToFetchTeams.map(id => getTeamsByEventId(id)));
          setTeams(allTeams.flat());
        }
      }
    } catch (e) {
      if (!isSilent) addToast('Failed to load data', 'error');
    } finally {
      if (!isSilent) setDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 120000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleCancelRegistration = async (registrationId: string) => {
    if (!window.confirm('Are you sure you want to cancel your registration for this event?')) return;

    try {
      const success = await deleteRegistration(registrationId);
      if (success) {
        addToast('Registration cancelled successfully', 'success');
        loadData(true);
      } else {
        addToast('Failed to cancel registration', 'error');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      addToast('An error occurred during cancellation', 'error');
    }
  };

  useEffect(() => {
    const fetchMessages = async (isSilent = false) => {
      if (selectedEventForDetails) {
        if (!isSilent) setIsMessagesLoading(true);
        const msgs = await getMessages(selectedEventForDetails.id);
        setMessages(msgs);
        if (!isSilent) setIsMessagesLoading(false);
      } else {
        setMessages([]);
      }
    };

    fetchMessages();
    const interval = setInterval(() => fetchMessages(true), 5000);
    return () => clearInterval(interval);
  }, [selectedEventForDetails]);

  // Hydrate Event Details (Fetch full data if missing logic from list view optimization)
  useEffect(() => {
    const hydrateEvent = async () => {
      if (selectedEventForDetails) {
        // If description is empty or image is empty (and we expect them usually), fetch full
        // Note: Some events might legitimately have no image, but our list view forces it to empty string.
        // We can check a flag or just always fetch if we are in Mongo mode.
        // For simplicity, let's always fetch fresh details to ensure up-to-date data too.
        try {
          // Optimization: Fetch details WITHOUT massive image first to unlock UI speed.
          // The LazyEventImage component will fetch the image in parallel.
          const fullEvent = await getEventById(selectedEventForDetails.id, { excludeImage: true });

          if (fullEvent) {
            // Merge the fetched details (text) with the existing state (which might have empty image)
            // We preserved the 'imageUrl' from list view (empty) or if we had it cached.
            // But getEventById(excludeImage: true) returns null/undefined for imageUrl.

            // If we really want to update the state, we should check if description is missing.
            if (fullEvent.description.length > selectedEventForDetails.description.length) {
              // Keep existing image URL if we have one (though usually empty from list)
              // The LazyEventImage will handle the fetch.
              setSelectedEventForDetails(prev => prev ? { ...fullEvent, imageUrl: prev.imageUrl } : fullEvent);
            }
          }
        } catch (e) {
          console.error("Failed to hydrate event", e);
        }
      }

    };
    hydrateEvent();
  }, [selectedEventForDetails?.id]); // Only run if ID changes

  // Event Reminders Polling
  useEffect(() => {
    const checkReminders = async () => {
      if (!currentUser || registrations.length === 0 || events.length === 0) return;

      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const myApprovedRegs = registrations.filter(r =>
        r.participantId === currentUser.id &&
        r.status === RegistrationStatus.APPROVED
      );

      for (const reg of myApprovedRegs) {
        const event = events.find(e => e.id === reg.eventId);
        if (!event) continue;

        const eventDate = new Date(event.date);

        // Reminder Logic: Starts within 1 hour, hasn't started yet
        if (eventDate > now && eventDate <= oneHourLater) {
          const reminderKey = `reminder_1h_${event.id}_${currentUser.id}`;
          const alreadySent = localStorage.getItem(reminderKey);

          if (!alreadySent) {
            await addNotification({
              userId: currentUser.id,
              title: 'Upcoming Event',
              message: `"${event.title}" is starting in less than an hour!`,
              type: 'info',
              link: 'my-tickets'
            });

            localStorage.setItem(reminderKey, 'true');
            // Refresh notifs visually
            loadData(true);
            addToast(`Reminder: "${event.title}" starts soon!`, 'info');
          }
        }
      }
    };

    const timer = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Initial check

    return () => clearInterval(timer);
  }, [currentUser, registrations, events]);

  // Recommendations Logic
  const [recommendedEvents, setRecommendedEvents] = useState<AppEvent[]>([]);
  const [areRecommendationsLoading, setAreRecommendationsLoading] = useState(false);
  const [isAiUnavailable, setIsAiUnavailable] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentUser || currentUser.role !== 'attendee' || events.length === 0 || registrations.length === 0 || isAiUnavailable) return;

      // Avoid refetching if we already have them to save tokens, unless forced (not implemented here)
      if (recommendedEvents.length > 0) return;

      setAreRecommendationsLoading(true);
      try {
        const myRegs = registrations.filter(r => r.participantEmail === currentUser.email);
        if (myRegs.length === 0) {
          setAreRecommendationsLoading(false);
          return;
        }

        // Prepare Past Events Data
        const pastEvents = myRegs.map(r => {
          const e = events.find(ev => ev.id === r.eventId);
          return e ? { title: e.title, description: e.description, type: e.locationType || 'offline' } : null;
        }).filter(Boolean) as { title: string; description: string; type: string }[];

        // Prepare Upcoming Events Data
        const upcoming = events.filter(e =>
          !myRegs.some(r => r.eventId === e.id) &&
          new Date(e.date) > new Date()
        ).map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date,
          type: e.locationType || 'offline'
        }));

        if (upcoming.length < 1) {
          setAreRecommendationsLoading(false);
          return;
        }

        const recIds = await getEventRecommendations(pastEvents, upcoming);
        const recs = events.filter(e => recIds.includes(e.id));
        setRecommendedEvents(recs);
      } catch (e: any) {
        console.error("Gemini Recommendation Error:", e);
        // Disable AI if API key is invalid or quota exceeded
        if (JSON.stringify(e).includes('400') || JSON.stringify(e).includes('API key')) {
          setIsAiUnavailable(true);
          // Optional: silently fail or toast once
        }
      } finally {
        setAreRecommendationsLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentUser, events, registrations, isAiUnavailable, recommendedEvents.length]);



  // Review State & Logic
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      if (selectedEventForDetails && detailsTab === 'reviews') {
        setIsReviewsLoading(true);
        const data = await getReviews(selectedEventForDetails.id);
        setReviews(data);
        setIsReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [selectedEventForDetails, detailsTab]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetails || !currentUser) return;

    if (reviewComment.trim().length < 5) {
      addToast('Review must be at least 5 characters', 'error');
      return;
    }

    const reviewData = {
      eventId: selectedEventForDetails.id,
      userId: currentUser.id,
      userName: currentUser.name,
      rating: rating,
      comment: reviewComment.trim()
    };

    await addReview(reviewData);
    setReviewComment('');
    setRating(5);
    addToast('Review submitted successfully!', 'success');

    // Refresh reviews
    const data = await getReviews(selectedEventForDetails.id);
    setReviews(data);
  };

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
      addToast(`Welcome back, ${user.name} !`, 'success');
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, purpose: 'event' | 'profile' = 'event') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image size should be less than 5MB', 'error');
        return;
      }

      setCropPurpose(purpose);

      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageSrc(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      if (cropPurpose === 'event') {
        setNewEvent(prev => ({ ...prev, imageUrl: croppedImage }));
      } else {
        setProfileForm(prev => ({ ...prev, avatarUrl: croppedImage }));
        // If we want immediate feedback on the user object (optional, but form state is enough for preview)
      }
      setIsCropperOpen(false);
      setTempImageSrc(null);
    } catch (e) {
      console.error(e);
      addToast('Failed to crop image', 'error');
    }
  };

  const resetEventForm = () => {
    setNewEvent({
      title: '', date: '', endDate: '', location: '', locationType: 'offline', description: '', capacity: '', imageUrl: '', customQuestions: [], collaboratorEmails: [],
      participationMode: 'individual', maxTeamSize: '5'
    });
    setIsEditMode(false);
    setEditingEventId(null);
  };

  const handleEditClick = async (event: AppEvent) => {
    // Fetch full event details to ensure description/imageUrl are present
    addToast('Loading event details...', 'info');
    const fullEvent = await getEventById(event.id);
    if (!fullEvent) {
      addToast('Failed to load full event data', 'error');
      return;
    }

    // Format date for datetime-local input (YYYY-MM-DDThh:mm)
    const d = new Date(fullEvent.date);
    const ed = fullEvent.endDate ? new Date(fullEvent.endDate) : new Date(new Date(fullEvent.date).getTime() + 3600000); // Default +1hr if missing
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    const endDateStr = ed.getFullYear() + '-' + pad(ed.getMonth() + 1) + '-' + pad(ed.getDate()) + 'T' + pad(ed.getHours()) + ':' + pad(ed.getMinutes());

    setNewEvent({
      title: fullEvent.title,
      date: dateStr,
      endDate: endDateStr,
      location: fullEvent.location,
      locationType: fullEvent.locationType || 'offline',
      description: fullEvent.description,
      capacity: fullEvent.capacity.toString(),
      imageUrl: fullEvent.imageUrl || '',
      customQuestions: fullEvent.customQuestions || [],
      collaboratorEmails: fullEvent.collaboratorEmails || [],
      participationMode: fullEvent.participationMode || 'individual',
      maxTeamSize: (fullEvent.maxTeamSize || 5).toString()
    });
    setEditingEventId(fullEvent.id);
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !currentUser || !newEvent.capacity) return;

    try {
      const evtDataCommon = {
        title: newEvent.title,
        date: newEvent.date,
        endDate: newEvent.endDate,
        location: newEvent.location,
        locationType: newEvent.locationType,
        description: newEvent.description,
        capacity: parseInt(newEvent.capacity) || 0,
        imageUrl: newEvent.imageUrl || `https://picsum.photos/800/400?random=${Math.floor(Math.random() * 100)}`,
        customQuestions: newEvent.customQuestions || [],
        collaboratorEmails: newEvent.collaboratorEmails || [],
        organizerId: currentUser.id,
        isRegistrationOpen: true,
        participationMode: newEvent.participationMode,
        maxTeamSize: parseInt(newEvent.maxTeamSize) || 0
      };

      if (new Date(evtDataCommon.endDate) <= new Date(evtDataCommon.date)) {
        addToast('End date must be after start date', 'error');
        return;
      }

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
      }
    } catch (err: any) {
      console.error('Event save failed:', err);
      addToast(err.message || (isEditMode ? 'Failed to update event' : 'Failed to create event'), 'error');
    }
  };

  const handleGenerateDescription = async () => {
    if (!newEvent.title || !newEvent.date) {
      addToast('Please enter a title and date first', 'error');
      return;
    }
    setIsGeneratingAI(true);
    const result = await generateEventDescription(newEvent.title, newEvent.date, newEvent.location);
    if (result && !result.startsWith('Error:')) {
      setNewEvent(prev => ({ ...prev, description: result }));
      addToast('Description generated!', 'success');
    } else {
      addToast(`AI Error: ${result?.replace('Error:', '').trim() || 'Service unavailable'}`, 'error');
    }
    setIsGeneratingAI(false);
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      addToast('Please enter your email', 'error');
      return;
    }

    setAuthLoading(true);
    const result = await resetUserPassword(resetEmail);
    setAuthLoading(false);

    if (result.success) {
      addToast(result.message, 'success');
      // If it's a success, go locally back to signin.
      if (!result.message.includes('DEMO MODE')) {
        setIsAuthMode('signin');
        setResetEmail('');
      }
    } else {
      addToast(result.message, 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForReg || !currentUser || isRegistering) return;

    setIsRegistering(true);

    try {
      // Re-fetch event to check if status changed (e.g. organizer closed it while modal was open)
      const allEvents = await getEvents();
      const latestEvent = allEvents.find(e => e.id === selectedEventForReg.id);

      if (!latestEvent || latestEvent.isRegistrationOpen === false) {
        addToast('Registration is no longer open for this event', 'error');
        setSelectedEventForReg(null);
        setIsRegistering(false);
        return;
      }

      const now = new Date();
      if (now >= new Date(latestEvent.date)) {
        addToast('This event has already started or ended', 'error');
        setSelectedEventForReg(null);
        setIsRegistering(false);
        return;
      }

      // Use current user's email
      const email = currentUser.email;

      // Check existing
      const exists = registrations.find(r =>
        r.eventId === selectedEventForReg.id && r.participantEmail === email
      );

      if (exists) {
        addToast('You are already registered for this event', 'error');
        setIsRegistering(false);
        return;
      }

      // Check for required custom questions
      if (selectedEventForReg.customQuestions) {
        const missingRequired = selectedEventForReg.customQuestions.find(
          q => q.required && (!registrationAnswers[q.id] || registrationAnswers[q.id].trim() === '')
        );

        if (missingRequired) {
          addToast(`Please answer the required question: "${missingRequired.question}"`, 'error');
          setIsRegistering(false);
          return;
        }
      }

      const currentRegCount = registrations.filter(r =>
        r.eventId === selectedEventForReg.id &&
        (r.status === RegistrationStatus.APPROVED || r.status === RegistrationStatus.PENDING)
      ).length;

      const isCapacityFull = currentRegCount >= (selectedEventForReg.capacity as number);
      const initialStatus = isCapacityFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

      let finalRegData: any = {
        eventId: selectedEventForReg.id,
        participantId: currentUser.id,
        participantName: currentUser.name,
        participantEmail: email,
        status: initialStatus,
        attended: false,
        registeredAt: new Date().toISOString(),
        answers: registrationAnswers
      };

      if (teamRegistrationData.mode === 'team') {
        if (teamRegistrationData.subMode === 'create') {
          if (!teamRegistrationData.teamName.trim()) {
            addToast('Please enter a team name', 'error');
            setIsRegistering(false);
            return;
          }
          const team = await createTeam({
            name: teamRegistrationData.teamName,
            eventId: selectedEventForReg.id,
            leaderId: currentUser.id,
            members: [{ userId: currentUser.id, userName: currentUser.name, email: currentUser.email }],
            createdAt: new Date().toISOString(),
            inviteCode: '' // filled by service
          });
          if (team) {
            finalRegData.teamId = team.id;
            finalRegData.teamName = team.name;
            finalRegData.isTeamLeader = true;
            finalRegData.participationType = 'team';
            addToast(`Team "${team.name}" created! Invite Code: ${team.inviteCode}`, 'success');
          } else {
            throw new Error("Failed to create team");
          }
        } else {
          if (!teamRegistrationData.inviteCode.trim()) {
            addToast('Please enter an invite code', 'error');
            setIsRegistering(false);
            return;
          }
          const team = await getTeamByInviteCode(teamRegistrationData.inviteCode);
          if (!team) {
            addToast("Invalid invite code", "error");
            setIsRegistering(false);
            return;
          }
          if (team.eventId !== selectedEventForReg.id) {
            addToast("This invite code is for a different event", "error");
            setIsRegistering(false);
            return;
          }
          if (team.members.length >= (selectedEventForReg.maxTeamSize || 99)) {
            addToast("Team is already full", "error");
            setIsRegistering(false);
            return;
          }
          await joinTeam(team.id, { userId: currentUser.id, userName: currentUser.name, email: currentUser.email });
          finalRegData.teamId = team.id;
          finalRegData.teamName = team.name;
          finalRegData.isTeamLeader = false;
          finalRegData.participationType = 'team';
        }
      } else {
        finalRegData.participationType = 'individual';
      }

      const created = await addRegistration(finalRegData);

      if (created) {
        await loadData();
        setSelectedEventForReg(null);
        setRegistrationAnswers({});
        setTeamRegistrationData({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' });
        if (created.status === RegistrationStatus.WAITLISTED) {
          addToast('Event is full. You have been added to the waitlist.', 'info');
        } else {
          addToast(teamRegistrationData.mode === 'team' ? 'Team registration submitted!' : 'Registration submitted! Waiting for approval.', 'success');
        }
      } else {
        addToast('Registration failed or event is closed', 'error');
      }
    } catch (error) {
      console.error(error);
      addToast('An error occurred', 'error');
    } finally {
      setIsRegistering(false);
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

      // Add In-App Notification
      await addNotification({
        userId: reg.participantId,
        title: status === RegistrationStatus.APPROVED ? 'Registration Approved!' : 'Registration Update',
        message: status === RegistrationStatus.APPROVED
          ? `You're in! Your registration for "${event.title}" was approved.`
          : `Your registration status for "${event.title}" has been updated to ${status}.`,
        type: status === RegistrationStatus.APPROVED ? 'success' : 'info',
        link: 'my-tickets'
      });
    }

    // 3. Refresh Data
    await loadData();
    addToast(`Participant ${status.toLowerCase()} and notified`, 'success');
  };

  const handleSendReminders = async (event: AppEvent) => {
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

  const handleBroadcastAnnouncement = async () => {
    if (!organizerSelectedEventId || !announcementText.trim()) {
      addToast('Please enter a message to broadcast.', 'error');
      return;
    }
    const event = events.find(e => e.id === organizerSelectedEventId);
    if (!event) return;

    setIsBroadcasting(true);
    try {
      const approvedParticipants = registrations.filter(r =>
        r.eventId === event.id &&
        r.status === RegistrationStatus.APPROVED
      );

      if (approvedParticipants.length === 0) {
        addToast('No approved participants to notify.', 'info');
        return;
      }

      await Promise.all(approvedParticipants.map(participant =>
        addNotification({
          userId: participant.participantId,
          title: `Announcement: ${event.title}`,
          message: announcementText.trim(),
          type: 'info',
          link: 'my-tickets'
        })
      ));

      addToast(`Announcement broadcasted to ${approvedParticipants.length} participants!`, 'success');
      setAnnouncementText('');
      setIsAnnouncementModalOpen(false);
    } catch (e) {
      console.error(e);
      addToast('Failed to broadcast announcement.', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleExportCSV = (event: AppEvent) => {
    const eventRegs = registrations.filter(r => r.eventId === event.id);
    if (eventRegs.length === 0) {
      addToast('No participants to export.', 'info');
      return;
    }

    // Header
    const headers = ['Participant Name', 'Email', 'Status', 'Attendance', 'Attendance Time', 'Registered At'];

    // Add custom questions to headers
    const customQuestions = event.customQuestions || [];
    customQuestions.forEach(q => headers.push(q.question));

    const csvRows = [headers.join(',')];

    eventRegs.forEach(reg => {
      const row = [
        `"${reg.participantName.replace(/"/g, '""')}"`,
        `"${reg.participantEmail.replace(/"/g, '""')}"`,
        `"${reg.status}"`,
        `"${reg.attended ? 'Present' : 'Absent'}"`,
        `"${reg.attendanceTime ? format(new Date(reg.attendanceTime), 'yyyy-MM-dd HH:mm:ss') : '-'}"`,
        `"${format(new Date(reg.registeredAt), 'yyyy-MM-dd HH:mm:ss')}"`
      ];

      // Add answers for custom questions
      customQuestions.forEach(q => {
        const answer = reg.answers ? reg.answers[q.id] || '' : '';
        row.push(`"${String(answer).replace(/"/g, '""')}"`);
      });

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}_participants.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('CSV exported successfully', 'success');
  };

  const [newMessageText, setNewMessageText] = useState('');
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetails || !currentUser || !newMessageText.trim()) return;

    const messageData = {
      eventId: selectedEventForDetails.id,
      userId: currentUser.id,
      userName: currentUser.name,
      content: newMessageText.trim()
    };

    await addMessage(messageData);
    setNewMessageText('');
    const msgs = await getMessages(selectedEventForDetails.id);
    setMessages(msgs);

    // Send notifications to OTHER participants
    const otherParticipants = registrations.filter(r =>
      r.eventId === selectedEventForDetails.id &&
      r.participantId !== currentUser.id &&
      r.status === RegistrationStatus.APPROVED
    );

    // Avoid blocking UI for notifications
    Promise.all(otherParticipants.map(participant =>
      addNotification({
        userId: participant.participantId,
        title: `New message in "${selectedEventForDetails.title}"`,
        message: `${currentUser.name} says: ${newMessageText.trim().substring(0, 50)}${newMessageText.trim().length > 50 ? '...' : ''}`,
        type: 'info',
        link: 'browse' // Or specific link to discussion if supported
      })
    ));
  };

  const handleManualAttendance = async (regId: string) => {
    // Security Check: Verify Organizer Ownership or Collaborative Rights
    const reg = registrations.find(r => r.id === regId);
    if (reg) {
      const event = events.find(e => e.id === reg.eventId);
      if (event) {
        const isOrganizer = currentUser?.role === 'organizer' && event.organizerId === currentUser?.id;
        const isCollaborator = event.collaboratorEmails?.includes(currentUser?.email || '');

        if (!isOrganizer && !isCollaborator) {
          addToast('Permission Denied: Only the event organizer or co-organizers can mark attendance.', 'error');
          return;
        }
      }
    }

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

      // Security Check: Verify Organizer Ownership or Collaborative Rights
      const reg = registrations.find(r => r.id === payload.id);
      if (!reg) {
        addToast('Ticket not recognized.', 'error');
        return;
      }

      const event = events.find(e => e.id === reg.eventId);
      if (!event) {
        addToast('Event associated with this ticket not found.', 'error');
        return;
      }

      const isOrganizer = currentUser?.role === 'organizer' && event.organizerId === currentUser?.id;
      const isCollaborator = event.collaboratorEmails?.includes(currentUser?.email || '');

      if (!isOrganizer && !isCollaborator) {
        addToast('Permission Denied: Only the event organizer or co-organizers can scan this ticket.', 'error');
        return;
      }

      const success = await markAttendance(payload.id);

      if (success) {
        addToast('Attendance Marked Successfully!', 'success');
        await loadData(); // refresh UI
      } else {
        if (reg.status !== RegistrationStatus.APPROVED) {
          addToast('Participant is not approved yet!', 'error');
        } else if (reg.attended) {
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

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneNumber) {
      addToast('Please enter a valid phone number', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      const appVerifier = initRecaptcha('persistent-recaptcha-container');
      const confirmationResult = await signInWithPhone(phoneNumber, appVerifier);
      setConfirmationResult(confirmationResult);
      setOtpPurpose('login');
      setShowOtpInput(true);
      addToast('OTP Sent!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Failed to send OTP. Try again.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp) {
      addToast('Please enter the OTP', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      const user = await verifyPhoneOtp(confirmationResult, otp);
      if (user) {
        setCurrentUser(user);
        addToast('Logged in successfully!', 'success');
        setAuthForm({ name: '', email: '', password: '', role: 'attendee' });
        setPhoneNumber('');
        setOtp('');
        setShowOtpInput(false);
        setLoginMethod('email');
      } else {
        addToast('Verification failed', 'error');
      }
    } catch (error) {
      console.error(error);
      addToast('Invalid OTP', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Views ---

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const renderAuthModal = () => {
    if (!isAuthModalOpen && currentUser) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm overflow-y-auto">
        <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden max-w-4xl w-full flex flex-col md:flex-row border border-slate-800 relative">
          {!currentUser && (
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white"
            >
              <XCircle className="w-6 h-6" />
            </button>
          )}
          <div className="bg-orange-600 p-8 md:w-1/2 flex flex-col justify-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80')] bg-cover opacity-20"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold">EventHorizon</h1>
              </div>
              <p className="text-orange-100 text-lg mb-8 leading-relaxed">
                The all-in-one platform for seamless event management. Create events, register attendees, and check them in with ease.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-orange-300" />
                  <span>AI-Powered Event Creation</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-orange-300" />
                  <span>QR Code Ticketing & Check-in</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-orange-300" />
                  <span>Instant Approval Workflow</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:w-1/2 flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">
              <h2 className="text-2xl font-bold text-white mb-2">
                {isAuthMode === 'signin' ? 'Welcome back' : isAuthMode === 'forgot-password' ? 'Reset Password' : 'Create an account'}
              </h2>
              <p className="text-slate-400 mb-8 italic">
                {isAuthMode === 'signin' ? 'Please enter your details to sign in.' : isAuthMode === 'forgot-password' ? 'Enter your email to receive a reset link.' : 'Get started with EventHorizon today.'}
              </p>

              {(isAuthMode === 'signin' || isAuthMode === 'signup') && (
                <div className="mb-8 flex p-1.5 liquid-glass rounded-2xl border border-white/5 w-fit mx-auto lg:mx-0">
                  <button
                    onClick={() => setLoginMethod('email')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${loginMethod === 'email' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    E-Mail
                  </button>
                  <button
                    onClick={() => setLoginMethod('phone')}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${loginMethod === 'phone' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Phone
                  </button>
                </div>
              )}

              {isAuthMode === 'forgot-password' ? (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-1">Email for Reset</label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        id="reset-email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center"
                  >
                    {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                  </button>

                  <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">⚠️</div>
                    <p>Note: If you signed up with Google, you don't have a password to reset. Please sign in with Google instead.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAuthMode('signin')}
                    className="w-full text-slate-400 text-sm hover:underline mt-2"
                  >
                    Back to Sign In
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  {isAuthMode === 'signup' && (
                    <div>
                      <label htmlFor="signup-name" className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                      <div className="relative">
                        <UserCircle className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          id="signup-name"
                          type="text"
                          required
                          placeholder="John Doe"
                          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                          value={authForm.name}
                          onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {isAuthMode === 'signin' && (
                    <div className="flex bg-slate-900 rounded-lg p-1 mb-6">
                      <button
                        type="button"
                        onClick={() => { setLoginMethod('email'); setShowOtpInput(false); }}
                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${loginMethod === 'email' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}
                      >
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoginMethod('phone')}
                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${loginMethod === 'phone' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}
                      >
                        Phone
                      </button>
                    </div>
                  )}

                  {(loginMethod === 'email' || isAuthMode === 'signup') ? (
                    <>
                      <div>
                        <label htmlFor="auth-email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                        <div className="relative">
                          <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
                          <input
                            id="auth-email"
                            type="email"
                            required
                            placeholder="you@example.com"
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            value={authForm.email}
                            onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="auth-password" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                        <div className="relative">
                          <KeyRound className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
                          <input
                            id="auth-password"
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            value={authForm.password}
                            onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {!showOtpInput ? (
                        <div>
                          <label htmlFor="auth-phone" className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">📞</span>
                            <input
                              id="auth-phone"
                              type="tel"
                              required
                              placeholder="+1 555 123 4567"
                              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                              value={phoneNumber}
                              onChange={e => setPhoneNumber(e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label htmlFor="auth-otp" className="block text-sm font-medium text-slate-300 mb-1">Enter OTP</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">🔒</span>
                            <input
                              id="auth-otp"
                              type="text"
                              required
                              placeholder="123456"
                              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none tracking-widest text-center"
                              value={otp}
                              onChange={e => setOtp(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {isAuthMode === 'signup' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">I am a...</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setAuthForm({ ...authForm, role: 'attendee' })}
                          className={`py-2 px-4 rounded-lg text-sm font-medium border ${authForm.role === 'attendee'
                            ? 'bg-orange-900/40 border-orange-500 text-orange-400'
                            : 'bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                        >
                          Participant
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthForm({ ...authForm, role: 'organizer' })}
                          className={`py-2 px-4 rounded-lg text-sm font-medium border ${authForm.role === 'organizer'
                            ? 'bg-orange-900/40 border-orange-500 text-orange-400'
                            : 'bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                        >
                          Organizer
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={(e) => {
                      if (isAuthMode === 'signup') {
                        handleSignup(e);
                      } else if (loginMethod === 'phone') {
                        showOtpInput ? handleVerifyOtp(e) : handleSendOtp(e);
                      } else {
                        handleLogin(e);
                      }
                    }}
                    className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {authLoading ? 'Please wait...' : (
                      isAuthMode === 'signup'
                        ? 'Create Account'
                        : (loginMethod === 'phone'
                          ? (showOtpInput ? 'Verify OTP' : 'Send OTP')
                          : 'Sign In')
                    )}
                  </button>

                  {isAuthMode === 'signin' && loginMethod === 'email' && (
                    <div className="flex justify-end mt-1">
                      <button
                        type="button"
                        onClick={() => { setIsAuthMode('forgot-password'); setResetEmail(''); }}
                        className="text-orange-400 text-xs hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isAuthMode !== 'forgot-password' && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-slate-900 text-slate-500">Or continue with</span>
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
                    className="w-full flex items-center justify-center gap-2 bg-slate-950 border border-slate-700 text-slate-300 py-2 rounded-lg font-medium hover:bg-slate-900 transition-colors"
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

                  <div className="mt-6 text-center text-sm text-slate-400">
                    {isAuthMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                    <button
                      onClick={() => setIsAuthMode(isAuthMode === 'signin' ? 'signup' : 'signin')}
                      className="font-semibold text-orange-400 hover:text-orange-300"
                    >
                      {isAuthMode === 'signin' ? 'Sign up' : 'Sign in'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div >
    );
  };

  // --- Authenticated Views ---

  const renderHeader = () => (
    <header className="sticky top-0 z-40 liquid-glass border-b border-orange-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center group cursor-pointer" onClick={() => setActiveTab('browse')}>
          <div className="flex flex-col">
            <span className="text-2xl font-black font-outfit tracking-tighter text-refraction">
              EventHorizon
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-orange-400 -mt-1 pl-0.5">Premium Events</span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 relative">
          {[
            { id: 'browse', label: 'Explore' },
            { id: 'organizer', label: 'Dashboard', show: currentUser?.role === 'organizer' },
            { id: 'my-tickets', label: 'My Tickets', show: currentUser?.role === 'attendee' }
          ].filter(item => item.show !== false).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`relative px-6 py-2 rounded-xl text-sm font-black font-outfit transition-all duration-300 whitespace-nowrap z-10 ${activeTab === item.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <span className="relative z-10">{item.label}</span>
              {activeTab === item.id && (
                <motion.div
                  layoutId="header-pill"
                  className="absolute inset-0 bg-orange-600 rounded-xl shadow-lg shadow-orange-600/30"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-3 rounded-xl bg-white/5 text-slate-400 hover:text-orange-400 transition-all border border-white/5"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
          </button>

          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-[88px] left-4 right-4 liquid-glass rounded-3xl border border-white/10 p-4 z-50 lg:hidden flex flex-col gap-2 shadow-2xl"
              >
                {[
                  { id: 'browse', label: 'Explore', icon: Sparkles },
                  { id: 'organizer', label: 'Dashboard', show: currentUser?.role === 'organizer', icon: Layout },
                  { id: 'my-tickets', label: 'My Tickets', show: currentUser?.role === 'attendee', icon: QrCode }
                ].filter(item => item.show !== false).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as Tab);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold font-outfit transition-all ${activeTab === item.id ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-orange-500'}`} />
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`p-3 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'bg-white/5 text-slate-400 hover:text-orange-400 hover:bg-white/10'}`}
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
              )}
            </button>

            {isNotificationsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsNotificationsOpen(false)}></div>
                <div className="absolute right-0 mt-4 w-80 xs:w-96 liquid-glass rounded-3xl shadow-2xl border border-white/10 py-0 z-20 animate-in fade-in zoom-in-95 origin-top-right overflow-hidden flex flex-col max-h-[500px]">
                  <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <h3 className="text-lg font-bold text-white font-outfit">Notifications</h3>
                    <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/20">{notifications.length} New</span>
                  </div>
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 10).map(notif => (
                        <div
                          key={notif.id}
                          onClick={async () => {
                            if (!notif.read) {
                              await markNotificationRead(notif.id);
                              loadData();
                            }
                            if (notif.link) {
                              setActiveTab(notif.link as Tab);
                              setIsNotificationsOpen(false);
                            }
                          }}
                          className={`px-6 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all relative group ${!notif.read ? 'bg-orange-500/5' : ''}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${notif.type === 'success' ? 'bg-emerald-400 shadow-emerald-500/50' : notif.type === 'warning' ? 'bg-amber-400 shadow-amber-500/50' : 'bg-orange-400 shadow-orange-500/50'} ${notif.read ? 'opacity-20' : ''}`}></div>
                            <div className="flex-1">
                              <p className={`text-sm ${notif.read ? 'text-slate-400' : 'text-white font-bold font-outfit'}`}>{notif.title}</p>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{format(new Date(notif.createdAt), 'MMM d, h:mm a')}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all mt-1" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                          <Bell className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">No notifications yet</p>
                        <p className="text-slate-500 text-xs mt-1">We'll alert you when something happens</p>
                      </div>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                      <button
                        onClick={() => setIsNotificationsOpen(false)}
                        className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400 hover:text-orange-300 w-full text-center py-2 rounded-xl"
                      >
                        Dismiss All
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {currentUser ? (
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-black font-outfit text-white tracking-tight leading-none">{currentUser.name}</span>
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1 opacity-80">{currentUser.role}</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="w-11 h-11 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-2xl flex items-center justify-center border border-white/10 hover:border-orange-500/50 transition-all group overflow-hidden"
                >
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-7 h-7 text-slate-300 group-hover:text-white group-hover:scale-110 transition-all" />
                  )}
                </button>

                {isProfileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setIsProfileMenuOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-4 w-64 liquid-glass rounded-3xl shadow-2xl border border-white/10 py-3 z-20 animate-in fade-in zoom-in-95 origin-top-right">
                      <div className="px-6 py-4 border-b border-white/5 md:hidden mb-2">
                        <p className="text-sm font-bold text-white font-outfit">{currentUser.name}</p>
                        <p className="text-xs text-slate-400 truncate opacity-60 tracking-tight">{currentUser.email}</p>
                      </div>
                      <div className="px-3 space-y-1">
                        <button
                          onClick={() => {
                            setProfileForm({
                              name: currentUser.name,
                              email: currentUser.email,
                              phoneNumber: currentUser.phoneNumber || '',
                              isPhoneVerified: !!currentUser.phoneNumber,
                              avatarUrl: currentUser.avatarUrl
                            });
                            setOtp('');
                            setOtpPurpose('profile');
                            setShowOtpInput(false);
                            setConfirmationResult(null);
                            setIsProfileModalOpen(true);
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm font-bold font-outfit text-slate-300 hover:bg-orange-600 hover:text-white rounded-xl transition-all flex items-center gap-3 group"
                        >
                          <UserCircle className="w-5 h-5 text-orange-400 group-hover:text-white" /> Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            handleLogout();
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm font-bold font-outfit text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center gap-3 group"
                        >
                          <LogOut className="w-5 h-5 group-hover:text-white" /> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-5 sm:px-8 py-3 bg-orange-600 text-white rounded-2xl text-xs sm:text-sm font-black font-outfit hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/30 active:scale-95 uppercase tracking-wider"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );

  const renderEvents = () => {
    const visibleEvents = currentUser?.role === 'organizer'
      ? events.filter(e => e.organizerId === currentUser.id)
      : events;

    const now = new Date();
    const upcomingEvents = visibleEvents.filter(e => !isPastEvent(e)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pastEvents = visibleEvents.filter(e => isPastEvent(e)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const renderEventCard = (event: AppEvent, index: number) => {
      const isPast = isPastEvent(event);
      return (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className={`group glass-card rounded-[32px] overflow-hidden transition-all duration-500 flex flex-col h-full bg-[#0f172a]/40 border-orange-500/5 hover:border-orange-500/20 ${isPast ? 'opacity-50 grayscale' : ''}`}
        >
          <div className="relative h-56 overflow-hidden">
            <LazyEventImage eventId={event.id} initialSrc={event.imageUrl} alt={event.title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className={`absolute top-4 right-4 backdrop-blur-md px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl z-10 ${event.locationType === 'online' ? 'bg-orange-600/90 text-white border border-orange-400/30' : 'bg-slate-900/90 text-white border border-white/10'}`}>
              {event.locationType === 'online' ? 'Online' : 'Offline'}
            </div>

            <div className="absolute bottom-4 left-4 z-10 flex gap-2">
              <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[10px] font-bold text-white border border-white/10 group-hover:bg-orange-600/50 transition-colors">
                {event.capacity} Capacity
              </span>
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-6 bg-orange-500/5 w-fit px-4 py-1.5 rounded-full border border-orange-500/10">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              {format(new Date(event.date), 'MMMM d, yyyy')}
            </div>

            <h3
              onClick={() => setSelectedEventForDetails(event)}
              className="text-2xl font-black text-white mb-3 font-outfit decoration-orange-500/50 decoration-2 underline-offset-8 cursor-pointer group-hover:text-orange-300 group-hover:translate-x-1 transition-all"
            >
              {event.title}
            </h3>

            <div className="flex items-center gap-2 text-slate-400 text-xs mb-5 font-medium opacity-80">
              <MapPin className="w-4 h-4 text-orange-400" />
              {renderLocation(event.location, event.locationType, "truncate max-w-[200px]")}
            </div>

            <p className="text-slate-400 text-sm line-clamp-2 mb-8 flex-1 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">{event.description}</p>

            {(!currentUser || currentUser.role === 'attendee') && (
              (() => {
                const isRegistered = currentUser ? registrations.some(r => r.eventId === event.id && r.participantEmail === currentUser.email) : false;
                const currentRegistrations = registrations.filter(r => r.eventId === event.id && r.status !== RegistrationStatus.REJECTED).length;
                const isFull = currentRegistrations >= event.capacity;
                const startDate = new Date(event.date);
                const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000);

                const isLive = now >= startDate && now <= endDate;
                const isPastBadge = now > endDate;
                const isClosed = event.isRegistrationOpen === false || now >= startDate;

                return (
                  <div className="flex flex-col gap-4 mt-auto">
                    <div className="flex items-center justify-between">
                      {isLive && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 animate-pulse bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                          Live Now
                        </div>
                      )}
                      {isFull && !isRegistered && !isPastBadge && (
                        <div className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          Event Full
                        </div>
                      )}
                      {isPastBadge && (
                        <div className="text-[10px] font-black text-slate-500 bg-slate-500/10 border border-slate-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          Inactive
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isRegistered ? (
                        <button
                          onClick={() => {
                            const reg = registrations.find(r => r.eventId === event.id && r.participantEmail === currentUser?.email);
                            if (reg) setSelectedRegistrationDetails(reg);
                          }}
                          className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold font-outfit py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <CheckCircle className="w-5 h-5 text-orange-400 group-hover/btn:scale-110 transition-transform" />
                          View Registration
                        </button>
                      ) : (
                        currentUser ? (
                          <button
                            disabled={isFull || isClosed}
                            onClick={() => setSelectedEventForReg(event)}
                            className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold font-outfit py-3 rounded-2xl transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                          >
                            {isFull ? 'Waitlisted' : (isClosed ? 'Registration Closed' : 'Secure Your Spot')}
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="flex-1 bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 text-white font-bold font-outfit py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                          >
                            Sign In to Register
                            <ChevronRight className="w-4 h-4 text-orange-400 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        )
                      )}

                      <button
                        onClick={() => setSelectedEventForDetails(event)}
                        className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
                        title="View Details"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })()
            )}

            {currentUser?.role === 'organizer' && (
              <div className="mt-auto pt-6 border-t border-white/5 flex gap-2">
                <button
                  onClick={() => {
                    setOrganizerSelectedEventId(event.id);
                    setOrganizerView('events');
                    setActiveTab('organizer');
                  }}
                  className="flex-1 bg-orange-600/10 text-orange-400 font-bold font-outfit py-3 rounded-2xl border border-orange-500/20 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                >
                  Manage
                </button>
                <button
                  onClick={() => setSelectedEventForDetails(event)}
                  className="px-4 bg-white/5 text-slate-400 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
                >
                  <Edit className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      );
    };

    return (
      <div className="animate-in fade-in duration-700">
        {/* Modern Premium Hero Section */}
        {activeTab === 'browse' && !currentUser && (
          <div className="relative overflow-hidden mb-8 sm:mb-16 pt-16 pb-20 md:pt-12 md:pb-24 transition-all">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none -z-10 animate-pulse"></div>
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-amber-600/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

            <div className="max-w-4xl mx-auto text-center px-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-8 animate-float">
                <Sparkles className="w-4 h-4" />
                Experience the Extraordinary
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black font-outfit text-white mb-8 tracking-tighter leading-[1.1] md:leading-[0.9]">
                Where Every Moment <br className="hidden sm:block" />
                <span className="text-gradient">Becomes a Legacy</span>
              </h1>
              <p className="text-base sm:text-xl text-slate-400 mb-10 md:mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                Connect with the world's most exclusive tech, design, and cultural events. Your next core memory is just a click away.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-3xl text-sm md:text-lg font-black font-outfit hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-orange-600/40 uppercase tracking-widest"
                >
                  Start Your Journey
                </button>
                <div className="flex items-center gap-2 text-slate-500 font-bold text-xs sm:text-sm">
                  <Users className="w-5 h-5" />
                  Join 10,000+ members
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Satellite Feed</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black font-outfit text-white tracking-tight">
                {currentUser?.role === 'organizer' ? 'Hosted Nexus' : 'Upcoming Experiences'}
              </h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-2 sm:pb-0">
              <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/5 whitespace-nowrap">
                <button className="px-4 py-2 sm:px-6 bg-orange-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all">All</button>
                <button className="px-4 py-2 sm:px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all hover:text-white">Tech</button>
                <button className="px-4 py-2 sm:px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all hover:text-white">Design</button>
              </div>
            </div>
          </div>

          {!dataLoading && upcomingEvents.length === 0 ? (
            <div className="text-center py-32 glass-card rounded-[40px] border-dashed border-2 border-white/5">
              <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-12 h-12 text-orange-500 opacity-50" />
              </div>
              <h3 className="text-2xl font-black font-outfit text-white mb-2">No upcoming events yet</h3>
              <p className="text-slate-400 max-w-xs mx-auto mb-8">Stay tuned! We're preparing incredible experiences for you.</p>
              {currentUser?.role === 'organizer' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-orange-600 text-white px-10 py-5 rounded-[24px] font-black font-outfit hover:bg-orange-500 transition-all uppercase tracking-widest shadow-2xl shadow-orange-600/40 hyper-glow active:scale-95 translate-y-0 hover:-translate-y-1"
                >
                  Create Your First Event
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {dataLoading ? (
                Array(6).fill(0).map((_, i) => <EventCardSkeleton key={i} />)
              ) : (
                upcomingEvents.map((event, idx) => renderEventCard(event, idx))
              )}
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className="mt-32">
              <div className="flex items-center gap-6 mb-12">
                <h3 className="text-3xl font-black font-outfit text-white tracking-tight whitespace-nowrap">Past Memories</h3>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {pastEvents.map((event, idx) => renderEventCard(event, idx + upcomingEvents.length))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMyTickets = () => {
    if (!currentUser) return null;

    // Filter registrations for this logged in user
    const myRegs = registrations.filter(r => r.participantEmail === currentUser.email);

    // Split into Active and Past
    const activeRegs = myRegs.filter(reg => {
      const event = events.find(e => e.id === reg.eventId);
      return event && !isPastEvent(event) && (reg.status === RegistrationStatus.APPROVED || reg.status === RegistrationStatus.PENDING || reg.status === RegistrationStatus.WAITLISTED);
    });

    const pastRegs = myRegs.filter(reg => {
      const event = events.find(e => e.id === reg.eventId);
      return event && isPastEvent(event);
    });

    const activeTicketsCount = activeRegs.filter(r => r.status === RegistrationStatus.APPROVED || r.status === RegistrationStatus.PENDING).length;

    const renderTicketCard = (reg: Registration) => {
      const event = events.find(e => e.id === reg.eventId);
      if (!event) return null;
      const isPast = isPastEvent(event);

      return (
        <div key={reg.id} className={`group glass-card rounded-[32px] p-6 lg:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden transition-all duration-500 hover:border-orange-500/30 ${isPast ? 'opacity-60 grayscale' : ''}`}>
          <div className="absolute top-0 right-0 w-32 h-64 bg-orange-600/5 -rotate-45 translate-x-16 -translate-y-16 pointer-events-none"></div>

          <div className="w-full md:w-32 h-32 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5 shadow-2xl">
            <LazyEventImage eventId={event.id} initialSrc={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          </div>

          <div className="flex-1 w-full text-center md:text-left">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">ID: {reg.id.slice(0, 8)}</span>
            <h3 className="text-2xl font-black text-white mt-1 mb-3 font-outfit line-clamp-1 group-hover:text-orange-400 transition-colors uppercase tracking-tight">{event.title}</h3>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-3 mt-4 text-slate-400 text-sm font-medium">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-orange-400" /> {format(new Date(event.date), 'MMMM d, yyyy')}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-400" /> {renderLocation(event.location, event.locationType, "truncate max-w-[150px]")}</div>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4 min-w-[200px] w-full md:w-auto">
            <Badge status={reg.status} />
            {!isPast && (reg.status === RegistrationStatus.APPROVED || reg.status === RegistrationStatus.PENDING) && (
              <button
                onClick={() => setSelectedTicket(reg)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white border border-transparent px-8 py-3.5 rounded-2xl text-xs font-black font-outfit transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-3"
              >
                <QrCode className="w-4 h-4" /> View Digital Ticket
              </button>
            )}
            <button
              onClick={() => setSelectedEventForDetails(event)}
              className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.3em] transition-colors"
            >
              Event Details
            </button>
            {!isPast && (
              <button
                onClick={() => handleCancelRegistration(reg.id)}
                className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-[0.3em] transition-colors flex items-center gap-2 group/cancel mt-2"
              >
                <Trash2 className="w-3 h-3 group-hover/cancel:scale-110 transition-transform" />
                Cancel Registration
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-16 animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Personal Node</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-outfit text-white tracking-tight">Your Passport</h2>
            <p className="text-slate-400 text-sm font-medium opacity-80 mt-1">Manage your upcoming experiences and digital tickets.</p>
          </div>
          <div className="bg-orange-600/10 border border-orange-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 w-fit">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
            <span className="text-xs font-black text-orange-400 uppercase tracking-widest">{activeTicketsCount} Active {activeTicketsCount !== 1 ? 'Permits' : 'Permit'}</span>
          </div>
        </div>

        {dataLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => <TicketSkeleton key={i} />)}
          </div>
        ) : myRegs.length === 0 ? (
          <div className="text-center py-24 glass-card rounded-[40px] border-dashed border-2 border-white/5">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <QrCode className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-2xl font-black font-outfit text-white mb-2">No tickets yet</h3>
            <p className="text-slate-400 mb-8 max-w-xs mx-auto">Your journey begins when you register for your first event.</p>
            <button
              onClick={() => setActiveTab('browse')}
              className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black font-outfit hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20"
            >
              Explore Events
            </button>
          </div>
        ) : (
          <div className="space-y-16">
            {activeRegs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Upcoming Expeditions</h3>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
                {activeRegs.map(renderTicketCard)}
              </div>
            )}

            {pastRegs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Journey Log</h3>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
                {pastRegs.map(renderTicketCard)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOrganizer = () => {
    // Only show events created by this organizer OR where they are a collaborator
    const myEvents = events.filter(e => e.organizerId === currentUser.id || (e.collaboratorEmails && e.collaboratorEmails.includes(currentUser.email)));

    // If no event selected, show Dashboard or List
    if (!organizerSelectedEventId) {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-in fade-in duration-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-black font-outfit text-white tracking-tight">Command Center</h2>
              <p className="text-slate-400 font-medium opacity-80 mt-1">Orchestrate your experiences and manage your community.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 text-white border border-white/10 px-6 py-3.5 rounded-2xl hover:bg-white/10 font-bold font-outfit transition-all uppercase tracking-wider text-xs"
              >
                <Plus className="w-4 h-4 text-orange-400" /> New Venture
              </button>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-orange-600 text-white px-8 py-3.5 rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all active:scale-95 font-black font-outfit uppercase tracking-wider text-xs"
              >
                <ScanLine className="w-4 h-4" /> Scan Entrance
              </button>
            </div>
          </div>

          <div className="inline-flex p-1.5 bg-white/5 rounded-2xl border border-white/5 mb-10">
            <button
              onClick={() => setOrganizerView('overview')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${organizerView === 'overview' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Intelligence
            </button>
            <button
              onClick={() => setOrganizerView('events')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${organizerView === 'events' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Expeditions
            </button>
          </div>

          {organizerView === 'overview' ? (
            <AnalyticsDashboard
              events={myEvents}
              registrations={registrations.filter(r => myEvents.some(e => e.id === r.eventId))}
            />
          ) : (
            dataLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => <EventCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {myEvents.map(event => {
                  const eventRegs = registrations.filter(r => r.eventId === event.id);
                  const pendingCount = eventRegs.filter(r => r.status === RegistrationStatus.PENDING).length;
                  return (
                    <div
                      key={event.id}
                      onClick={() => { setOrganizerSelectedEventId(event.id); setStatusFilter('ALL'); setAttendanceFilter('ALL'); }}
                      className="group glass-card rounded-3xl p-6 cursor-pointer border border-white/5 hover:border-orange-500/30 transition-all duration-500 flex flex-col h-full"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform duration-500">
                          <Calendar className="w-6 h-6 text-orange-400" />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">Status</span>
                          {isPastEvent(event) ? (
                            <span className="text-xs font-bold text-slate-400 mt-1">Inactive</span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-400 mt-1">Active</span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-black font-outfit text-white mb-2 tracking-tight group-hover:text-orange-400 transition-colors line-clamp-1">{event.title}</h3>
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium opacity-80 mb-6">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-orange-400" /> {format(new Date(event.date), 'MMM d, h:mm a')}</div>
                      </div>

                      <div className="mt-auto space-y-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enlisted</span>
                            <span className="text-sm font-black font-outfit text-white">{eventRegs.length} / {event.capacity}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-600 transition-all duration-1000"
                              style={{ width: `${Math.min(100, (eventRegs.length / event.capacity) * 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          {pendingCount > 0 ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-black text-amber-500 uppercase tracking-widest">
                              <AlertCircle className="w-3 h-3" /> {pendingCount} Pending Approval
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                              <CheckSquare className="w-3 h-3" /> Fully Vetted
                            </div>
                          )}
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {myEvents.length === 0 && (
                  <div className="text-center py-24 glass-card rounded-[40px] border-dashed border-2 border-white/5 col-span-full">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-black font-outfit text-white mb-2">No expeditions yet</h3>
                    <p className="text-slate-400 mb-8 max-w-xs mx-auto">Launch your first event and begin your legacy.</p>
                    <button
                      onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
                      className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black font-outfit hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20"
                    >
                      Create Your First Event
                    </button>
                  </div>
                )}
              </div>
            )
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
          onClick={() => { setOrganizerSelectedEventId(null); setSelectedRegistrationIds([]); }}
          className="mb-4 text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          ← Back to Events
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{event?.title}</h2>
            <p className="text-slate-400">Manage participants and approvals</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => event && handleEditClick(event)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Edit className="w-4 h-4" /> Edit Event
            </button>
            <button
              onClick={() => event && handleSendReminders(event)}
              disabled={isSendingReminders}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium disabled:opacity-50 transition-colors"
            >
              {isSendingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Send Reminders
            </button>
            <button
              onClick={async () => {
                if (event && confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone and all registrations will be lost.`)) {
                  const success = await deleteEvent(event.id);
                  if (success) {
                    addToast('Event deleted successfully', 'success');
                    setOrganizerSelectedEventId(null);
                    loadData();
                  } else {
                    addToast('Failed to delete event', 'error');
                  }
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-900/40 text-red-400 border border-red-800 px-4 py-2 rounded-lg hover:bg-red-900/60 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Event
            </button>
            <button
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Send className="w-4 h-4" /> Broadcast
            </button>
            <button
              onClick={() => event && handleExportCSV(event)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
            >
              <ScanLine className="w-4 h-4" /> Scan Ticket
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mr-2">
            <Filter className="w-4 h-4" /> Filters:
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium uppercase">Status</label>
            <select
              className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none appearance-none pr-8 cursor-pointer hover:border-slate-600"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
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
              className="bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none"
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value as any)}
            >
              <option value="ALL">All Attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent / Not Scanned</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-slate-400">
            Showing {eventRegs.length} result{eventRegs.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedRegistrationIds.length > 0 && (
          <div className="bg-orange-600/10 border border-orange-500/30 p-3 rounded-xl mb-6 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <span className="text-orange-400 font-bold text-sm px-2 py-1 bg-orange-900/40 rounded-lg">{selectedRegistrationIds.length}</span>
              <span className="text-orange-200 text-sm font-medium">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (confirm(`Approve ${selectedRegistrationIds.length} registrations?`)) {
                    await Promise.all(selectedRegistrationIds.map(id => updateRegistrationStatus(id, RegistrationStatus.APPROVED)));
                    addToast(`Approved ${selectedRegistrationIds.length} participants`, 'success');
                    setSelectedRegistrationIds([]);
                    loadData();
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Reject ${selectedRegistrationIds.length} registrations?`)) {
                    await Promise.all(selectedRegistrationIds.map(id => updateRegistrationStatus(id, RegistrationStatus.REJECTED)));
                    addToast(`Rejected ${selectedRegistrationIds.length} participants`, 'info');
                    setSelectedRegistrationIds([]);
                    loadData();
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Mark ${selectedRegistrationIds.length} participants as present?`)) {
                    await Promise.all(selectedRegistrationIds.map(id => markAttendance(id)));
                    addToast(`Marked ${selectedRegistrationIds.length} participants as present`, 'success');
                    setSelectedRegistrationIds([]);
                    loadData();
                  }
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Present
              </button>
              <button
                onClick={() => setSelectedRegistrationIds([])}
                className="text-slate-400 hover:text-white text-xs font-medium ml-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {dataLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <ListRowSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {/* Mobile View: Participant Cards */}
            <div className="block md:hidden space-y-4">
              {eventRegs.map(reg => (
                <div key={reg.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="overflow-hidden">
                      <div className="font-medium text-slate-200 truncate">{reg.participantName}</div>
                      <div className="text-xs text-slate-400 truncate">{reg.participantEmail}</div>
                    </div>
                    <Badge status={reg.status} />
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                    <div className="text-sm">
                      {reg.attended ? (
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle className="w-4 h-4" /> Present</span>
                          {reg.attendanceTime && (
                            <span className="text-xs text-slate-400">
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
                        <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)} className="p-1.5 bg-green-900/30 text-green-400 rounded-lg border border-green-800" title="Approve"><CheckCircle className="w-5 h-5" /></button>
                        <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)} className="p-1.5 bg-red-900/30 text-red-400 rounded-lg border border-red-800" title="Reject"><XCircle className="w-5 h-5" /></button>
                      </div>
                    )}

                    {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                      <button
                        onClick={() => handleManualAttendance(reg.id)}
                        className="px-3 py-1.5 bg-orange-900/40 text-orange-400 text-xs font-medium rounded-lg border border-orange-800 hover:bg-orange-900/60 transition-colors"
                      >
                        Mark Present
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {eventRegs.length === 0 && (
                <div className="text-center text-slate-400 py-8 bg-slate-900 rounded-xl border border-dashed border-slate-700">
                  No registrations found matching criteria.
                </div>
              )}
            </div>

            {/* Desktop View: Participant Table */}
            <div className="hidden md:block bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={eventRegs.length > 0 && selectedRegistrationIds.length === eventRegs.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRegistrationIds(eventRegs.map(r => r.id));
                          } else {
                            setSelectedRegistrationIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900"
                      />
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Participant</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Email</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Status</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Attendance</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Time</th>
                    <th className="px-6 py-4 font-semibold text-slate-300 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {eventRegs.map(reg => (
                    <tr key={reg.id} className={`hover:bg-slate-800/50 transition-colors ${selectedRegistrationIds.includes(reg.id) ? 'bg-orange-900/10' : ''}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRegistrationIds.includes(reg.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRegistrationIds(prev => [...prev, reg.id]);
                            } else {
                              setSelectedRegistrationIds(prev => prev.filter(id => id !== reg.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200">{reg.participantName}</div>
                        {reg.participationType === 'team' && (
                          <div className="text-[10px] text-orange-400 mt-0.5 flex items-center gap-1.5 font-semibold">
                            <span>{reg.teamName}</span>
                            <span className="text-slate-600 font-normal">|</span>
                            <span className="font-mono bg-orange-500/10 px-1 rounded border border-orange-500/20">
                              {teams.find(t => t.id === reg.teamId)?.inviteCode || 'N/A'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{reg.participantEmail}</td>
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
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {reg.attendanceTime ? format(new Date(reg.attendanceTime), 'h:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {reg.status === RegistrationStatus.PENDING && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)}
                              className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-md"
                              title="Approve"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)}
                              className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-md"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                          <button
                            onClick={() => handleManualAttendance(reg.id)}
                            className="text-orange-400 hover:text-orange-300 text-sm font-medium hover:underline mr-2"
                          >
                            Mark Present
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedRegistrationDetails(reg)}
                          className="text-slate-400 hover:text-slate-200 text-sm font-medium hover:underline ml-2"
                        >
                          View
                        </button>
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
        {activeTab === 'my-tickets' && (currentUser ? renderMyTickets() : <div className="text-center py-20 text-slate-400">Please sign in to view your tickets.</div>)}
        {activeTab === 'organizer' && (currentUser?.role === 'organizer' ? renderOrganizer() : <div className="text-center py-20 text-slate-400">Organizer dashboard requires organizer privileges.</div>)}
      </main>

      {renderAuthModal()}
      <LiquidChrome />

      {/* --- MODALS --- */}

      {/* CREATE / EDIT EVENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-lg sm:rounded-3xl shadow-2xl border-none sm:border sm:border-slate-800 flex flex-col max-h-full sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 flex-shrink-0">
              <h3 className="text-xl font-bold text-white font-outfit">{isEditMode ? 'Edit Event' : 'Create New Event'}</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form onSubmit={handleSaveEvent} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 font-outfit">Event Image</label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full sm:w-48 h-40 sm:h-32 bg-slate-950 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden group hover:border-orange-500/50 transition-colors">
                      {newEvent.imageUrl ? (
                        <>
                          <img src={newEvent.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs flex items-center gap-1"><Upload className="w-4 h-4" /> Change</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewEvent(prev => ({ ...prev, imageUrl: '' }));
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-slate-800/80 backdrop-blur-sm text-slate-300 rounded-full shadow-md hover:bg-slate-700 hover:text-red-400 transition-colors z-20"
                            title="Remove Image"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                          <p className="text-[10px] text-slate-500">Pick a cover image</p>
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
                  <label className="block text-sm font-medium text-slate-300 mb-1">Event Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={newEvent.title}
                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="e.g. Summer Tech Gala"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Start Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none dark-calendar"
                      value={newEvent.date}
                      onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">End Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none dark-calendar"
                      value={newEvent.endDate}
                      onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Event Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, locationType: 'offline' })}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${newEvent.locationType === 'offline'
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                      >
                        Offline Event
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, locationType: 'online' })}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${newEvent.locationType === 'online'
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                      >
                        Online Event
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">{newEvent.locationType === 'online' ? 'Meeting Link / Platform' : 'Location / Venue'}</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={newEvent.location}
                      onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                      placeholder={newEvent.locationType === 'online' ? 'Zoom, Google Meet, etc.' : 'City or Venue'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Capacity</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={newEvent.capacity}
                    onChange={e => setNewEvent({ ...newEvent, capacity: e.target.value })}
                    placeholder="Max attendees"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Participation Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['individual', 'team', 'both'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, participationMode: mode as ParticipationMode })}
                        className={`py-2 px-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${newEvent.participationMode === mode
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'
                          }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {(newEvent.participationMode === 'team' || newEvent.participationMode === 'both') && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Max Team Size</label>
                    <input
                      required
                      type="number"
                      min="2"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={newEvent.maxTeamSize}
                      onChange={e => setNewEvent({ ...newEvent, maxTeamSize: e.target.value })}
                      placeholder="e.g. 5"
                    />
                  </div>
                )}

                {/* Custom Questions Section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-300">Custom Registration Questions</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newQ: CustomQuestion = {
                          id: crypto.randomUUID(),
                          question: '',
                          type: 'text',
                          required: false
                        };
                        setNewEvent(prev => ({ ...prev, customQuestions: [...prev.customQuestions, newQ] }));
                      }}
                      className="text-xs bg-orange-900/40 text-orange-400 px-2 py-1 rounded-md hover:bg-orange-900/60 font-medium"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newEvent.customQuestions.map((q, idx) => (
                      <div key={q.id} className="p-3 bg-slate-950 rounded-lg border border-slate-700">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            className="flex-1 px-3 py-1.5 text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 focus:ring-1 focus:ring-orange-500 outline-none"
                            placeholder="Question text (e.g. Dietary restrictions?)"
                            value={q.question}
                            onChange={e => {
                              const updated = [...newEvent.customQuestions];
                              updated[idx].question = e.target.value;
                              setNewEvent({ ...newEvent, customQuestions: updated });
                            }}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = newEvent.customQuestions.filter(x => x.id !== q.id);
                              setNewEvent({ ...newEvent, customQuestions: updated });
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <span>Type:</span>
                            <select
                              className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 outline-none"
                              value={q.type}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].type = e.target.value as any;
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                            >
                              <option value="text">Text</option>
                              <option value="boolean">Yes/No</option>
                              <option value="select">Select (Dropdown)</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].required = e.target.checked;
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                              className="rounded text-orange-600 focus:ring-orange-500"
                            />
                            Required
                          </label>
                        </div>
                        {q.type === 'select' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-900 text-slate-100 focus:ring-1 focus:ring-orange-500 outline-none"
                              placeholder="Options separated by comma (e.g. Red, Blue, Green)"
                              value={q.options?.join(', ') || ''}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].options = e.target.value.split(',').map(s => s.trim());
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {newEvent.customQuestions.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2 italic">No custom questions added yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Co-Organizers</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Enter organizer email"
                      value={collaboratorEmailInput}
                      onChange={e => setCollaboratorEmailInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (collaboratorEmailInput && !newEvent.collaboratorEmails?.includes(collaboratorEmailInput)) {
                          setNewEvent(prev => ({
                            ...prev,
                            collaboratorEmails: [...(prev.collaboratorEmails || []), collaboratorEmailInput]
                          }));
                          setCollaboratorEmailInput('');
                        }
                      }}
                      disabled={!collaboratorEmailInput}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  {newEvent.collaboratorEmails && newEvent.collaboratorEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newEvent.collaboratorEmails.map(email => (
                        <div key={email} className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full text-sm">
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEvent(prev => ({
                                ...prev,
                                collaboratorEmails: prev.collaboratorEmails.filter(e => e !== email)
                              }));
                            }}
                            className="text-slate-500 hover:text-red-400"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!newEvent.collaboratorEmails || newEvent.collaboratorEmails.length === 0) && (
                    <p className="text-xs text-slate-500 italic">No co-organizers added.</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-300">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingAI}
                      className="text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white px-2 py-1 rounded-md flex items-center gap-1 hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isGeneratingAI ? 'Generating...' : 'AI Assist'}
                    </button>
                  </div>
                  <textarea
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none h-32 resize-none"
                    value={newEvent.description}
                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Describe your event..."
                  ></textarea>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-900/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="bg-orange-600 p-6 text-white relative flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 backdrop-blur-md">
                  <CheckSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black font-outfit tracking-tight">Permission Protocol</h3>
                  <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest truncate max-w-[200px]">{selectedEventForReg.title}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedEventForReg(null); setRegistrationAnswers({}); setTeamRegistrationData({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' }); }}
                className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
              {/* Participation Mode Choice */}
              {selectedEventForReg.participationMode !== 'individual' && selectedEventForReg.maxTeamSize && (
                <div className="mb-6 space-y-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2 font-outfit uppercase tracking-wider text-[11px]">Join As</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['individual', 'team'].map((m) => {
                      if (selectedEventForReg.participationMode === 'team' && m === 'individual') return null;
                      if (selectedEventForReg.participationMode === 'individual' && m === 'team') return null;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTeamRegistrationData(prev => ({ ...prev, mode: m as any }))}
                          className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${teamRegistrationData.mode === m
                            ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20 active:scale-95'
                            : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600 active:scale-95'
                            }`}
                        >
                          {m === 'individual' ? <UserCircle className="w-4 h-4 mx-auto mb-1" /> : <Users className="w-4 h-4 mx-auto mb-1" />}
                          {m === 'individual' ? 'Individually' : 'As a Team'}
                        </button>
                      );
                    })}
                  </div>

                  {teamRegistrationData.mode === 'team' && (
                    <div className="animate-in slide-in-from-top-2 duration-300 space-y-4 pt-2">
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setTeamRegistrationData(prev => ({ ...prev, subMode: 'create' }))}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${teamRegistrationData.subMode === 'create' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Create Team
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeamRegistrationData(prev => ({ ...prev, subMode: 'join' }))}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${teamRegistrationData.subMode === 'join' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Join Team
                        </button>
                      </div>

                      {teamRegistrationData.subMode === 'create' ? (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Team Name</label>
                          <input
                            required
                            type="text"
                            placeholder="My Awesome Team"
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            value={teamRegistrationData.teamName}
                            onChange={e => setTeamRegistrationData(prev => ({ ...prev, teamName: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Invite Code</label>
                          <input
                            required
                            type="text"
                            placeholder="ABC123"
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none uppercase transition-all"
                            value={teamRegistrationData.inviteCode}
                            onChange={e => setTeamRegistrationData(prev => ({ ...prev, inviteCode: e.target.value.toUpperCase() }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="text-slate-400 mb-6 font-outfit">
                You are registering as <span className="font-semibold text-white">{currentUser.name}</span> ({currentUser.email}).
              </p>

              {/* Custom Questions Display */}
              {selectedEventForReg.customQuestions && selectedEventForReg.customQuestions.length > 0 && (
                <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedEventForReg.customQuestions.map(q => (
                    <div key={q.id}>
                      <label className="block text-sm font-medium text-slate-300 mb-1 font-outfit">
                        {q.question} {q.required && <span className="text-red-400">*</span>}
                      </label>

                      {q.type === 'text' && (
                        <input
                          type="text"
                          required={q.required}
                          value={registrationAnswers[q.id] || ''}
                          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        />
                      )}

                      {q.type === 'boolean' && (
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                            <input
                              type="radio"
                              name={q.id}
                              value="yes"
                              required={q.required}
                              checked={registrationAnswers[q.id] === 'Yes'}
                              onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: 'Yes' }))}
                              className="w-4 h-4 text-orange-500 focus:ring-orange-500 bg-slate-950 border-slate-700"
                            />
                            Yes
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                            <input
                              type="radio"
                              name={q.id}
                              value="no"
                              required={q.required}
                              checked={registrationAnswers[q.id] === 'No'}
                              onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: 'No' }))}
                              className="w-4 h-4 text-orange-600 focus:ring-orange-500 bg-slate-950 border-slate-700"
                            />
                            No
                          </label>
                        </div>
                      )}

                      {q.type === 'select' && (
                        <select
                          required={q.required}
                          value={registrationAnswers[q.id] || ''}
                          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        >
                          <option value="" disabled>Select an option</option>
                          {q.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => { setSelectedEventForReg(null); setRegistrationAnswers({}); }}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-3 rounded-xl hover:bg-slate-700 transition-all font-outfit"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 font-outfit shadow-lg shadow-orange-600/20 active:scale-95"
                >
                  {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )
      }

      {/* ANNOUNCEMENT MODAL */}
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
                      <Send className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black font-outfit text-white tracking-tight">Broadcast Intel</h3>
                      <p className="text-slate-400 text-sm font-medium">Deploy mission-critical updates instantly.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAnnouncementModalOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Announcement Stream</label>
                    <textarea
                      required
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/30 outline-none h-48 resize-none transition-all font-medium"
                      placeholder="Type your official announcement here..."
                      value={announcementText}
                      onChange={e => setAnnouncementText(e.target.value)}
                    ></textarea>
                    <p className="text-[10px] text-slate-500 mt-3 font-medium flex items-center gap-2">
                      <Info className="w-3 h-3" />
                      Broadcast will reach all approved participants via their in-app Intelligence Feed.
                    </p>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={() => setIsAnnouncementModalOpen(false)}
                      className="flex-1 px-8 py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/5 font-outfit uppercase tracking-wider text-xs"
                    >
                      Abort
                    </button>
                    <button
                      onClick={handleBroadcastAnnouncement}
                      disabled={isBroadcasting || !announcementText.trim()}
                      className="flex-[2] flex items-center justify-center gap-3 bg-orange-600 text-white px-8 py-4 rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 font-black font-outfit uppercase tracking-wider text-xs"
                    >
                      {isBroadcasting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      Transmit Message
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* PROFILE EDIT MODAL */}
      {
        isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center p-6 border-b border-slate-800 flex-shrink-0">
                <h3 className="text-xl font-bold text-white font-outfit">Edit Profile</h3>
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group cursor-pointer mb-2">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-700 group-hover:border-orange-500 transition-colors bg-slate-800 flex items-center justify-center">
                      {profileForm.avatarUrl || currentUser?.avatarUrl ? (
                        <img src={profileForm.avatarUrl || currentUser?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-16 h-16 text-slate-600" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleImageUpload(e, 'profile')}
                    />
                  </div>
                  <p className="text-xs text-slate-500">Tap to change profile picture</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    disabled={true}
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed outline-none"
                    value={profileForm.email}
                    title="Contact support to change email"
                  />
                  <p className="text-xs text-slate-400 mt-1">Email cannot be changed directly.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      disabled={!!currentUser?.phoneNumber}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      value={profileForm.phoneNumber || ''}
                      onChange={e => setProfileForm({ ...profileForm, phoneNumber: e.target.value, isPhoneVerified: false })}
                      placeholder="+1234567890"
                    />
                    {!currentUser?.phoneNumber && !profileForm.isPhoneVerified && profileForm.phoneNumber && (
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={async () => {
                          if (authLoading) return;
                          if (!profileForm.phoneNumber) return;
                          if (profileForm.phoneNumber === currentUser.phoneNumber) {
                            setProfileForm({ ...profileForm, isPhoneVerified: true });
                            return;
                          }

                          const exists = await checkPhoneNumberExists(profileForm.phoneNumber);
                          if (exists) {
                            addToast('Phone number already in use by another account', 'error');
                            return;
                          }

                          if (!profileForm.phoneNumber.startsWith('+')) {
                            addToast('Please include country code (e.g., +1 for US)', 'error');
                            return;
                          }

                          setAuthLoading(true);
                          try {
                            const appVerifier = initRecaptcha('persistent-profile-recaptcha');
                            const confirmation = await signInWithPhone(profileForm.phoneNumber, appVerifier);
                            setConfirmationResult(confirmation);
                            setOtpPurpose('profile');
                            setShowOtpInput(true);
                            addToast('OTP Sent', 'success');
                          } catch (e: any) {
                            console.error(e);
                            addToast(`Failed to send OTP: ${e.message}`, 'error');
                          } finally {
                            setAuthLoading(false);
                          }
                        }}
                        className="px-3 py-2 bg-orange-600 rounded-lg text-white text-xs font-semibold hover:bg-orange-700"
                      >
                        Verify
                      </button>
                    )}
                    {profileForm.isPhoneVerified && <CheckCircle className="w-6 h-6 text-green-500 mt-2" />}
                  </div>
                  {currentUser?.phoneNumber ? (
                    <p className="text-xs text-slate-400 mt-1">Verified phone number cannot be changed.</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">Include country code (e.g. +1...)</p>
                  )}
                  {showOtpInput && (otpPurpose === 'deletion' || !profileForm.isPhoneVerified) && (
                    <div className="mt-2 flex gap-2 animate-in fade-in">
                      <input
                        type="text"
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none tracking-widest text-center"
                        placeholder="OTP"
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (otpPurpose === 'deletion') {
                            await handleConfirmDeletion();
                          } else {
                            try {
                              await confirmationResult.confirm(otp);
                              setProfileForm(prev => ({ ...prev, isPhoneVerified: true }));
                              setShowOtpInput(false);
                              setOtp('');
                              addToast('Phone number verified!', 'success');
                            } catch (e) {
                              addToast('Invalid OTP', 'error');
                            }
                          }
                        }}
                        className="px-4 py-2 bg-green-600 rounded-lg text-white text-xs font-semibold hover:bg-green-700 font-outfit"
                      >
                        Confirm
                      </button>
                    </div>
                  )}

                  {!showOtpInput && (
                    <div className="mt-8 pt-6 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-red-500 font-outfit">Danger Zone</h4>
                          <p className="text-xs text-slate-500 mt-1">Permanently delete your account and all data</p>
                        </div>
                        <button
                          type="button"
                          disabled={authLoading}
                          onClick={() => {
                            if (!currentUser?.phoneNumber) {
                              addToast('Please add and verify a phone number first to enable account deletion.', 'warning');
                              return;
                            }
                            if (confirm('Are you sure? This will permanently delete your account, events, and registrations. You will be logged out immediately.')) {
                              handleSendDeleteOtp();
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${!currentUser?.phoneNumber
                            ? 'bg-slate-800/50 border-slate-700 text-slate-600 cursor-not-allowed'
                            : 'bg-red-900/20 border-red-800/50 text-red-400 hover:bg-red-900/40'
                            }`}
                        >
                          Delete Account
                        </button>
                      </div>
                      {!currentUser?.phoneNumber && (
                        <p className="text-[10px] text-amber-500/70 mt-2 bg-amber-500/5 p-2 rounded border border-amber-500/10 font-outfit">
                          ⚠️ Phone verification is required for secure account deletion.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-2 rounded-xl hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded-xl shadow-lg shadow-orange-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>


            </div>
          </div>
        )
      }

      {/* REGISTRATION DETAILS MODAL */}
      {
        selectedRegistrationDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900">
                <div>
                  <h3 className="text-xl font-bold text-white">Registration Details</h3>
                  <p className="text-sm text-slate-400">View your entry information</p>
                </div>
                <button
                  onClick={() => setSelectedRegistrationDetails(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  {(() => {
                    const event = events.find(e => e.id === selectedRegistrationDetails.eventId);
                    if (!event) return null;
                    return (
                      <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <h4 className="font-bold text-white mb-2">{event.title}</h4>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-orange-400" />
                            {format(new Date(event.date), 'MMMM d, yyyy h:mm a')}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-orange-400" />
                            {renderLocation(event.location, event.locationType)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-400">
                        <UserCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">{selectedRegistrationDetails.participantName}</p>
                        <p className="text-xs text-slate-500">{selectedRegistrationDetails.participantEmail}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Status</p>
                        <div className="mt-1"><Badge status={selectedRegistrationDetails.status} /></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Attended</p>
                        <p className={`mt-1 font-medium ${selectedRegistrationDetails.attended ? 'text-green-400' : 'text-slate-400'}`}>
                          {selectedRegistrationDetails.attended ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">ID</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">#{selectedRegistrationDetails.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    {selectedRegistrationDetails.participationType === 'team' && (
                      <div className="bg-orange-900/20 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Team</p>
                          <p className="text-slate-200 font-bold text-lg">{selectedRegistrationDetails.teamName}</p>
                          <p className="text-[10px] text-orange-300/70 mt-0.5">{selectedRegistrationDetails.isTeamLeader ? 'Team Leader' : 'Team Member'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Team Code</p>
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <p className="text-slate-100 font-mono font-bold bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-500/30 select-all">
                                {teams.find(t => t.id === selectedRegistrationDetails.teamId)?.inviteCode || 'N/A'}
                              </p>
                              {(() => {
                                const code = teams.find(t => t.id === selectedRegistrationDetails.teamId)?.inviteCode;
                                if (code) {
                                  return (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(code);
                                        addToast('Team code copied!', 'success');
                                      }}
                                      className="absolute -right-2 -top-2 p-1.5 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-all scale-0 group-hover:scale-100 active:scale-95"
                                      title="Copy Code"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRegistrationDetails.participationType === 'team' && (
                      <div className="pt-4 border-t border-slate-800">
                        <p className="text-sm font-bold text-white mb-3">Team Members</p>
                        <div className="space-y-2">
                          {registrations
                            .filter(r => r.teamId === selectedRegistrationDetails.teamId && r.status !== RegistrationStatus.REJECTED)
                            .map(member => (
                              <div key={member.id} className="flex items-center justify-between bg-slate-800/30 p-2.5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                    {member.participantName.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm text-slate-200 font-medium">{member.participantName}</span>
                                    {member.participantEmail === currentUser?.email && <span className="text-[10px] text-orange-400 font-bold">You</span>}
                                  </div>
                                </div>
                                {member.isTeamLeader && (
                                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-1 rounded-md">
                                    Leader
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {selectedRegistrationDetails.answers && Object.keys(selectedRegistrationDetails.answers).length > 0 ? (
                      <div className="pt-4 border-t border-slate-800">
                        <p className="text-sm font-bold text-white mb-3">Custom Responses</p>
                        <div className="space-y-3">
                          {(() => {
                            // Helper to find question text
                            const event = events.find(e => e.id === selectedRegistrationDetails.eventId);
                            if (!event || !event.customQuestions) return <p className="text-slate-400 italic">Questions not found</p>;

                            return event.customQuestions.map(q => {
                              const answer = selectedRegistrationDetails.answers?.[q.id];
                              if (!answer) return null;
                              return (
                                <div key={q.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                  <p className="text-xs text-slate-400 mb-1">{q.question}</p>
                                  <p className="text-sm font-medium text-slate-200">{answer}</p>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic pt-2">No custom answers provided.</p>
                    )}

                    <div className="pt-6 mt-4 border-t border-slate-800 space-y-3">
                      <button
                        onClick={() => {
                          setSelectedTicket(selectedRegistrationDetails);
                          setSelectedRegistrationDetails(null);
                        }}
                        className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black font-outfit py-4 rounded-2xl transition-all group/tkt"
                      >
                        <QrCode className="w-5 h-5 text-orange-400 group-hover/tkt:scale-110 transition-transform" />
                        View Digital Ticket
                      </button>

                      <button
                        onClick={() => {
                          const id = selectedRegistrationDetails.id;
                          setSelectedRegistrationDetails(null);
                          handleCancelRegistration(id);
                        }}
                        className="w-full flex items-center justify-center gap-3 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-500 font-bold font-outfit py-3 rounded-2xl transition-all group/cancel"
                      >
                        <LogOut className="w-4 h-4 group-hover/cancel:-translate-x-1 transition-transform" />
                        Cancel Registration
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-900 border-t border-slate-800 rounded-b-2xl">
                <button
                  onClick={() => setSelectedRegistrationDetails(null)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-2 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* TICKET QR MODAL */}
      {
        selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-sm sm:rounded-3xl shadow-2xl overflow-hidden transform transition-all flex flex-col animate-in zoom-in-95 duration-300">
              <div className="p-6 text-center border-b border-slate-800 bg-slate-900 flex-shrink-0">
                <h3 className="text-lg font-bold text-white font-outfit">Digital Ticket</h3>
                <p className="text-sm text-slate-400">Scan this at the entrance</p>
              </div>
              <div className="p-8 flex-1 flex flex-col items-center justify-center bg-slate-900">
                <div className="p-4 bg-white border-2 border-dashed border-orange-200 rounded-2xl mb-6 shadow-2xl">
                  <QRCode
                    id="ticket-qr-code"
                    value={JSON.stringify({ id: selectedTicket.id, eventId: selectedTicket.eventId })}
                    size={220}
                    level="M"
                  />
                </div>
                <button
                  onClick={downloadTicket}
                  className="flex items-center gap-2 text-sm text-orange-400 font-bold hover:text-orange-300 hover:bg-orange-900/30 px-6 py-3 rounded-xl transition-all border border-orange-500/20 bg-orange-500/5"
                >
                  <Download className="w-4 h-4" />
                  Download Ticket
                </button>
              </div>
              <div className="p-6 bg-slate-950 border-t border-slate-800 text-center flex-shrink-0">
                <p className="text-base font-bold text-white font-outfit">{selectedTicket.participantName}</p>
                <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
                  {selectedTicket.attended ? <span className="text-green-500">Already Attended</span> : 'Valid Entry Ticket'}
                </p>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="mt-6 w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all font-outfit"
                >
                  Close Ticket
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* SCANNER MODAL */}
      {
        isScannerOpen && (
          <Scanner
            onScan={handleScan}
            onClose={() => setIsScannerOpen(false)}
          />
        )
      }

      {/* CROPPER MODAL */}
      {
        isCropperOpen && tempImageSrc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full h-full sm:h-[80vh] sm:max-w-2xl flex flex-col sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 flex-shrink-0">
                <h3 className="text-xl font-bold text-white font-outfit">{cropPurpose === 'profile' ? 'Crop Profile Picture' : 'Crop Event Image'}</h3>
                <button
                  onClick={() => { setIsCropperOpen(false); setTempImageSrc(null); }}
                  className="text-slate-400 hover:text-slate-200 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative flex-1 bg-slate-950 overflow-hidden">
                <Cropper
                  image={tempImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={cropPurpose === 'profile' ? 1 : 16 / 9}
                  cropShape={cropPurpose === 'profile' ? 'round' : 'rect'}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 flex-shrink-0">
                <div className="flex-1 w-full max-w-xs">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Zoom</label>
                    <span className="text-xs font-bold text-orange-400">{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 transition-all hover:bg-slate-750"
                  />
                </div>
                <div className="flex gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => { setIsCropperOpen(false); setTempImageSrc(null); }}
                    className="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-750 rounded-xl transition-all border border-slate-750"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCropConfirm}
                    className="flex-[2] sm:flex-none px-8 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-2 transition-all"
                  >
                    <Check className="w-5 h-5" /> Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* EVENT DETAILS MODAL */}
      {selectedEventForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-3xl shadow-2xl border-none sm:border sm:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="relative h-56 sm:h-64 flex-shrink-0">
              <LazyEventImage eventId={selectedEventForDetails.id} initialSrc={selectedEventForDetails.imageUrl} alt={selectedEventForDetails.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-black/20"></div>
              <button
                onClick={() => setSelectedEventForDetails(null)}
                className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all border border-white/10 z-10"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <div className="absolute bottom-4 sm:bottom-6 left-6 sm:left-8 right-6 sm:right-8">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest w-fit mb-2 sm:mb-3 ${selectedEventForDetails.locationType === 'online' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
                  {selectedEventForDetails.locationType} Event
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white font-outfit line-clamp-2">{selectedEventForDetails.title}</h2>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-slate-800/50 p-1 mx-6 sm:mx-8 rounded-xl border border-slate-800/50 mt-4">
              <button
                onClick={() => setDetailsTab('info')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'info' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Information
              </button>
              <button
                onClick={() => setDetailsTab('discussion')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'discussion' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Discussion
              </button>
              <button
                onClick={() => setDetailsTab('reviews')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'reviews' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Reviews
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
              {detailsTab === 'info' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Calendar className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Date & Time</p>
                          <p className="text-sm sm:text-base font-medium">{format(new Date(selectedEventForDetails.date), 'EEEE, MMMM d, yyyy')}</p>
                          <p className="text-xs sm:text-sm text-slate-400">{format(new Date(selectedEventForDetails.date), 'p')}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <MapPin className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Location</p>
                          <div className="text-sm sm:text-base font-medium italic">
                            {renderLocation(selectedEventForDetails.location, selectedEventForDetails.locationType)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Users className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Capacity</p>
                          <p className="text-sm sm:text-base font-medium">{selectedEventForDetails.capacity} Available Spots</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Registration</p>
                          <p className="text-sm sm:text-base font-medium">{selectedEventForDetails.isRegistrationOpen ? 'Open' : 'Closed'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-6">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">About this experience</p>
                    <div className="bg-slate-800/30 rounded-2xl p-4 sm:p-6 border border-slate-800">
                      <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line italic border-l-4 border-orange-500/30 pl-4">
                        {selectedEventForDetails.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-6 mt-6">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Share Event</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/?event=${selectedEventForDetails.id}`;
                          navigator.clipboard.writeText(url);
                          addToast('Link copied to clipboard!', 'success');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                      >
                        <Copy className="w-4 h-4" /> Copy Link
                      </button>
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${selectedEventForDetails.title} on EventHorizon!`)}&url=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] rounded-lg text-sm font-medium transition-colors border border-[#1DA1F2]/20"
                      >
                        <Twitter className="w-4 h-4" /> Twitter
                      </a>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] rounded-lg text-sm font-medium transition-colors border border-[#1877F2]/20"
                      >
                        <Facebook className="w-4 h-4" /> Facebook
                      </a>
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] rounded-lg text-sm font-medium transition-colors border border-[#0A66C2]/20"
                      >
                        <Linkedin className="w-4 h-4" /> LinkedIn
                      </a>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-6 mt-6">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Add to Calendar</p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEventForDetails.title)}&dates=${format(new Date(selectedEventForDetails.date), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}/${format(new Date(selectedEventForDetails.endDate), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}&details=${encodeURIComponent(selectedEventForDetails.description)}&location=${encodeURIComponent(selectedEventForDetails.location)}&sf=true&output=xml`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 rounded-lg text-sm font-medium transition-colors border border-orange-600/20"
                      >
                        <CalendarPlus className="w-4 h-4" /> Google Calendar
                      </a>
                      <button
                        onClick={() => {
                          const event = selectedEventForDetails;
                          const icsContent = [
                            'BEGIN:VCALENDAR',
                            'VERSION:2.0',
                            'BEGIN:VEVENT',
                            `SUMMARY:${event.title}`,
                            `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
                            `DTSTART:${format(new Date(event.date), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}`,
                            `DTEND:${format(new Date(event.endDate), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}`,
                            `LOCATION:${event.location}`,
                            'END:VEVENT',
                            'END:VCALENDAR'
                          ].join('\n');

                          const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                          const link = document.createElement('a');
                          link.href = window.URL.createObjectURL(blob);
                          link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                      >
                        <Download className="w-4 h-4" /> Download .ICS
                      </button>
                    </div>
                  </div>
                </>
              )}

              {detailsTab === 'discussion' && (
                <div className="h-full flex flex-col min-h-[400px]">
                  <div className="flex-1 space-y-4 mb-4 overflow-y-auto pr-2 custom-scrollbar">
                    {isMessagesLoading ? (
                      <div className="py-20 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-700 mx-auto" />
                        <p className="text-slate-500 text-sm mt-3 font-medium">Loading conversations...</p>
                      </div>
                    ) : messages.length > 0 ? (
                      messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-baseline gap-2 mb-1 px-1">
                            <span className="text-xs font-bold text-slate-300">{msg.userName}</span>
                            <span className="text-[10px] text-slate-500">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                          </div>
                          <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm ${msg.userId === currentUser.id
                            ? 'bg-orange-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                            }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center">
                        <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="text-slate-400 text-sm font-medium">No messages yet.</p>
                        <p className="text-slate-500 text-xs mt-1">Be the first to start the discussion!</p>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="mt-auto pt-4 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all shadow-inner"
                      placeholder="Ask a question or say hi..."
                      value={newMessageText}
                      onChange={e => setNewMessageText(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!newMessageText.trim()}
                      className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center group"
                    >
                      <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </form>
                </div>
              )}

              {detailsTab === 'reviews' && (
                <div className="h-full flex flex-col min-h-[400px]">
                  {isReviewsLoading ? (
                    <div className="py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-700 mx-auto" />
                      <p className="text-slate-500 text-sm mt-3 font-medium">Loading reviews...</p>
                    </div>
                  ) : (
                    <>
                      {/* Average Rating Section */}
                      {reviews.length > 0 && (
                        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 mb-6 flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-bold text-white flex items-center gap-2">
                              {(reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)}
                              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              Average Rating based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 text-xs text-slate-500">
                            {[5, 4, 3, 2, 1].map(r => {
                              const count = reviews.filter(rev => rev.rating === r).length;
                              const percentage = (count / reviews.length) * 100;
                              return (
                                <div key={r} className="flex items-center gap-2">
                                  <span className="w-3">{r}</span>
                                  <Star className="w-3 h-3 text-slate-600" />
                                  <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500" style={{ width: `${percentage}%` }} />
                                  </div>
                                  <span className="w-6 text-right">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex-1 space-y-6 mb-6 overflow-y-auto pr-2 custom-scrollbar">
                        {reviews.length > 0 ? (
                          reviews.map(review => (
                            <div key={review.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                                    {review.userName.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-200">{review.userName}</p>
                                    <p className="text-[10px] text-slate-500">{format(new Date(review.createdAt), 'MMM d, yyyy')}</p>
                                  </div>
                                </div>
                                <div className="flex text-amber-400">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-current' : 'text-slate-700'}`} />
                                  ))}
                                </div>
                              </div>
                              <p className="text-sm text-slate-300 italic">"{review.comment}"</p>
                            </div>
                          ))
                        ) : (
                          <div className="py-16 text-center">
                            <Star className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                            <p className="text-slate-400 text-sm font-medium">No reviews yet.</p>
                            <p className="text-slate-500 text-xs mt-1">Attendees can leave reviews after the event.</p>
                          </div>
                        )}
                      </div>

                      {/* Review Form - Only for Attendees who have attended */}
                      {currentUser.role === 'attendee' &&
                        registrations.some(r =>
                          r.eventId === selectedEventForDetails.id &&
                          r.participantEmail === currentUser.email &&
                          r.status === 'approved' &&
                          (r.attended || new Date(selectedEventForDetails.date) < new Date())
                        ) &&
                        !reviews.some(r => r.userId === currentUser.id) && (
                          <form onSubmit={handleSubmitReview} className="mt-auto pt-6 border-t border-slate-800">
                            <h4 className="text-sm font-bold text-white mb-3">Leave a Review</h4>
                            <div className="flex gap-2 mb-3">
                              {[1, 2, 3, 4, 5].map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setRating(s)}
                                  className="focus:outline-none transition-transform hover:scale-110"
                                >
                                  <Star className={`w-6 h-6 ${s <= rating ? 'text-amber-400 fill-current' : 'text-slate-700'}`} />
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                required
                                minLength={5}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all"
                                placeholder="Share your experience..."
                                value={reviewComment}
                                onChange={e => setReviewComment(e.target.value)}
                              />
                              <button
                                type="submit"
                                className="bg-orange-600 text-white px-4 py-2 rounded-xl hover:bg-orange-700 transition-all font-medium text-sm shadow-lg shadow-orange-600/20 active:scale-95"
                              >
                                Post
                              </button>
                            </div>
                          </form>
                        )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-4 flex-shrink-0">
              <button
                onClick={() => setSelectedEventForDetails(null)}
                className="order-2 sm:order-1 flex-1 px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all border border-slate-700 font-outfit"
              >
                Close
              </button>
              {(!currentUser || currentUser.role === 'attendee') && (
                (() => {
                  if (!currentUser) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedEventForDetails(null);
                          setIsAuthModalOpen(true);
                        }}
                        className="order-1 sm:order-2 flex-[2] px-6 py-3 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/20 active:scale-95 font-outfit"
                      >
                        Sign In to Register
                      </button>
                    );
                  }
                  const isRegistered = registrations.some(r => r.eventId === selectedEventForDetails.id && r.participantEmail === currentUser.email);
                  const currentRegsCount = registrations.filter(r => r.eventId === selectedEventForDetails.id && r.status !== RegistrationStatus.REJECTED).length;
                  const isFull = currentRegsCount >= (selectedEventForDetails.capacity as number);
                  const now = new Date();
                  const startDate = new Date(selectedEventForDetails.date);
                  const endDate = selectedEventForDetails.endDate ? new Date(selectedEventForDetails.endDate) : new Date(startDate.getTime() + 3600000);

                  const isLive = now >= startDate && now <= endDate;
                  const isPast = now > endDate;
                  const isClosed = selectedEventForDetails.isRegistrationOpen === false || now >= startDate;

                  return (
                    <button
                      onClick={() => {
                        if (isRegistered) {
                          const myReg = registrations.find(r => r.eventId === selectedEventForDetails.id && r.participantEmail === currentUser.email);
                          if (myReg) setSelectedRegistrationDetails(myReg);
                        } else if (!isClosed) {
                          setSelectedEventForReg(selectedEventForDetails);
                          setSelectedEventForDetails(null);
                        }
                      }}
                      disabled={!isRegistered && isClosed}
                      className={`order-1 sm:order-2 flex-[2] px-6 py-3 rounded-xl font-bold transition-all shadow-lg font-outfit ${isRegistered
                        ? 'bg-orange-900/40 text-orange-400 border border-orange-500 hover:bg-orange-900/60 active:scale-95'
                        : isClosed
                          ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                          : isFull
                            ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40 hover:bg-amber-600/30 active:scale-95'
                            : 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/20 active:scale-95'
                        }`}
                    >
                      {isRegistered ? (
                        <>
                          <CheckCircle className="w-4 h-4 inline mr-2" /> View Registration
                        </>
                      ) : isClosed ? (
                        <>
                          <XCircle className="w-4 h-4 inline mr-2" /> {isPast ? 'Event Ended' : 'Registration Closed'}
                        </>
                      ) : isFull ? (
                        <>
                          <Clock className="w-4 h-4 inline mr-2" /> Join Waitlist
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="w-4 h-4 inline mr-2" /> Register Now
                        </>
                      )}
                    </button>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
