import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  setDoc,
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured, googleProvider } from "../firebaseConfig";
import { Event, Registration, RegistrationStatus, User } from '../types';
import { STORAGE_KEYS } from '../constants';

// --- Configuration ---

// MongoDB Atlas Data API Configuration (Proxied via Local Server or Vercel Function)
const MONGO_CONFIG = {
  // When using Vercel, this relative path maps to the serverless function under api/
  endpoint: '/api/action',
  apiKey: 'dummy',
  dataSource: 'Cluster0',
  database: 'event_horizon',
};

// Hierarchy: MongoDB > Firebase > Local Storage
// If we have a URI in env (loaded by server) or we are just told to use it.
// Since this is client code, we check if we are in "Mongo Mode". 
// We'll assume if the user asked for this, we want to try the proxy.
const USE_MONGO = true;
const USE_FIREBASE_STORAGE = isFirebaseConfigured && !USE_MONGO;
const USE_FIREBASE_AUTH = isFirebaseConfigured; // Can use Firebase Auth even with Mongo Storage

// --- Helper Functions for MongoDB Data API ---

async function mongoRequest(action: string, collection: string, body: any = {}) {
  // Call our proxy/serverless function
  // Structure: /api/action/<action_name>
  const response = await fetch(`${MONGO_CONFIG.endpoint}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: collection,
      ...body
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("MongoDB API Error:", response.status, response.statusText, errorText);
    throw new Error(`MongoDB API Error: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// --- Events ---

export const getEvents = async (): Promise<Event[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'events', { filter: {} });
      // Map MongoDB _id to application id
      return result.documents.map((doc: any) => ({ ...doc, id: doc.id || doc._id }));
    } catch (e) {
      console.error("Mongo fetch events failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const querySnapshot = await getDocs(collection(db, "events"));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (e) {
      console.error("Firebase getEvents failed:", e);
      return [];
    }
  }

  // Fallback / Local Storage
  const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
  return stored ? JSON.parse(stored) : [];
};

export const saveEvent = async (event: Omit<Event, 'id'>): Promise<Event | null> => {
  const newId = crypto.randomUUID();

  if (USE_MONGO) {
    try {
      const newEvent = { ...event, id: newId };
      await mongoRequest('insertOne', 'events', { document: newEvent });
      return newEvent;
    } catch (e: any) {
      console.error("Mongo save event failed", e);
      throw e;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const docRef = await addDoc(collection(db, "events"), event);
      return { ...event, id: docRef.id } as Event;
    } catch (e) {
      console.error("Firebase saveEvent failed:", e);
      return null;
    }
  }

  // Local Storage
  const newEvent = { ...event, id: newId };
  const events = await getEvents();
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([...events, newEvent]));
  return newEvent;
};
export const updateEvent = async (event: Event): Promise<boolean> => {
  if (USE_MONGO) {
    try {
      const { id, ...updateData } = event;
      const result = await mongoRequest('updateOne', 'events', {
        filter: { id: id },
        update: { $set: updateData }
      });
      return result.modifiedCount > 0 || result.matchedCount > 0 || result.upsertedCount > 0;
    } catch (e: any) {
      console.error("Mongo update event failed", e);
      throw e;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const eventRef = doc(db, "events", event.id);
      const { id, ...data } = event;
      await updateDoc(eventRef, data as any);
      return true;
    } catch (e) {
      console.error("Firebase updateEvent failed:", e);
      return false;
    }
  }

  // Local Storage
  const events = await getEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    return true;
  }
  return false;
};

export const deleteEvent = async (id: string): Promise<boolean> => {
  if (USE_MONGO) {
    try {
      console.log(`[Delete Event] Attempting to delete event: ${id}`);
      const result = await mongoRequest('deleteOne', 'events', { filter: { id: id } });
      console.log("[Delete Event] DeleteOne result:", result);

      // Also delete registrations for this event to keep data clean
      try {
        await mongoRequest('deleteMany', 'registrations', { filter: { eventId: id } });
      } catch (regError) {
        console.warn("[Delete Event] Failed to cleanup registrations:", regError);
        // We still consider the event deletion a success if the event itself was removed
      }

      return true; // We return true if the request completed without error
    } catch (e) {
      console.error("Mongo delete event failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await deleteDoc(doc(db, "events", id));
      // Note: In Firestore, you'd typically need a cloud function or batch to delete sub-collections/related docs
      return true;
    } catch (e) {
      console.error("Firebase deleteEvent failed:", e);
      return false;
    }
  }

  // Local Storage
  const events = await getEvents();
  const filteredEvents = events.filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filteredEvents));

  const regs = await getRegistrations();
  const filteredRegs = regs.filter(r => r.eventId !== id);
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(filteredRegs));

  return true;
};

// --- Registrations ---

export const getRegistrations = async (): Promise<Registration[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'registrations', { filter: {} });
      return result.documents.map((doc: any) => ({ ...doc, id: doc.id || doc._id }));
    } catch (e) {
      console.error("Mongo fetch registrations failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const querySnapshot = await getDocs(collection(db, "registrations"));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
    } catch (e) {
      console.error("Firebase getRegistrations failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
  return stored ? JSON.parse(stored) : [];
};

export const addRegistration = async (reg: Omit<Registration, 'id'>): Promise<Registration | null> => {
  const newId = crypto.randomUUID();

  if (USE_MONGO) {
    try {
      // Validation: Check Capacity
      // This is a rough check; ideally should be atomic transaction or use $inc with condition
      const eventResult = await mongoRequest('findOne', 'events', { filter: { id: reg.eventId } });
      const event = eventResult.document;

      if (!event) throw new Error("Event not found");

      const regsResult = await mongoRequest('find', 'registrations', {
        filter: { eventId: reg.eventId, status: { $ne: RegistrationStatus.REJECTED } }
      });
      const count = regsResult.documents.length;

      const isFull = count >= event.capacity;
      const status = isFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

      const newReg = { ...reg, id: newId, status: status };
      await mongoRequest('insertOne', 'registrations', { document: newReg });
      return newReg;
    } catch (e) {
      console.error("Mongo add registration failed", e);
      return null;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      // Simple Capacity Check for Firebase
      // Note: Ideally use transactions for concurrency safety
      const eventDoc = await getDoc(doc(db, "events", reg.eventId));
      if (!eventDoc.exists()) return null;

      const eventData = eventDoc.data() as Event;
      const q = query(
        collection(db, "registrations"),
        where("eventId", "==", reg.eventId),
        where("status", "!=", RegistrationStatus.REJECTED)
      );
      const snapshot = await getDocs(q);

      const isFull = snapshot.size >= eventData.capacity;
      const status = isFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

      const newRegData = { ...reg, status: status };
      const docRef = await addDoc(collection(db, "registrations"), newRegData);
      return { ...newRegData, id: docRef.id } as Registration;
    } catch (e) {
      console.error("Firebase addRegistration failed:", e);
      return null;
    }
  }

  // Local Storage Fallback
  const events = await getEvents();
  const event = events.find(e => e.id === reg.eventId);

  if (!event) {
    console.error("Event not found");
    return null;
  }

  const regs = await getRegistrations();
  const eventRegs = regs.filter(r => r.eventId === reg.eventId && r.status !== RegistrationStatus.REJECTED);

  const isFull = eventRegs.length >= event.capacity;
  const status = isFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

  const newReg = { ...reg, id: newId, status: status };
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify([...regs, newReg]));
  return newReg;
};

export const deleteRegistration = async (id: string): Promise<boolean> => {
  let eventIdToCleanup: string | null = null;

  if (USE_MONGO) {
    try {
      const regResult = await mongoRequest('findOne', 'registrations', { filter: { id: id } });
      if (regResult.document) {
        eventIdToCleanup = regResult.document.eventId;
      }

      const result = await mongoRequest('deleteOne', 'registrations', { filter: { id: id } });
      console.log("Delete result:", result);

      if (result.deletedCount > 0 && eventIdToCleanup) {
        // Promote next person from waitlist
        const waitlisted = await mongoRequest('find', 'registrations', {
          filter: { eventId: eventIdToCleanup, status: RegistrationStatus.WAITLISTED },
          sort: { registeredAt: 1 },
          limit: 1
        });

        if (waitlisted.documents && waitlisted.documents.length > 0) {
          const nextInLine = waitlisted.documents[0];
          await mongoRequest('updateOne', 'registrations', {
            filter: { id: nextInLine.id || nextInLine._id },
            update: { $set: { status: RegistrationStatus.PENDING } }
          });
        }
      }
      return result.deletedCount > 0;
    } catch (e) {
      console.error("Mongo delete registration failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const regSnap = await getDoc(doc(db, "registrations", id));
      if (regSnap.exists()) {
        eventIdToCleanup = (regSnap.data() as Registration).eventId;
      }

      await deleteDoc(doc(db, "registrations", id));

      if (eventIdToCleanup) {
        const q = query(
          collection(db, "registrations"),
          where("eventId", "==", eventIdToCleanup),
          where("status", "==", RegistrationStatus.WAITLISTED)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          // Find oldest one manually since Firestore query sort can be tricky with composite indexes
          const waitlistedDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Registration));
          waitlistedDocs.sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());

          const nextInLine = waitlistedDocs[0];
          await updateDoc(doc(db, "registrations", nextInLine.id), { status: RegistrationStatus.PENDING });
        }
      }
      return true;
    } catch (e) {
      console.error("Firebase deleteRegistration failed:", e);
      return false;
    }
  }

  const regs = await getRegistrations();
  const regToDelete = regs.find(r => r.id === id);
  if (regToDelete) eventIdToCleanup = regToDelete.eventId;

  const filtered = regs.filter(r => r.id !== id);

  if (eventIdToCleanup) {
    const waitlistedIndex = filtered.findIndex(r => r.eventId === eventIdToCleanup && r.status === RegistrationStatus.WAITLISTED);
    if (waitlistedIndex !== -1) {
      filtered[waitlistedIndex].status = RegistrationStatus.PENDING;
    }
  }

  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(filtered));
  return true;
};

export const updateRegistrationStatus = async (id: string, status: RegistrationStatus): Promise<void> => {
  if (USE_MONGO) {
    try {
      // Note: Data API updateOne filter matches our custom 'id' field, not necessarily _id
      await mongoRequest('updateOne', 'registrations', {
        filter: { id: id },
        update: { $set: { status: status } }
      });
      return;
    } catch (e) {
      console.error("Mongo update status failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const regRef = doc(db, "registrations", id);
      await updateDoc(regRef, { status });
      return;
    } catch (e) {
      console.error("Firebase updateRegistrationStatus failed:", e);
    }
  }

  const regs = await getRegistrations();
  const updated = regs.map(r => r.id === id ? { ...r, status } : r);
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(updated));
};

export const markAttendance = async (id: string): Promise<boolean> => {
  const timestamp = new Date().toISOString();

  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'registrations', { filter: { id: id } });
      const reg = result.document;

      if (reg && reg.status === RegistrationStatus.APPROVED) {
        await mongoRequest('updateOne', 'registrations', {
          filter: { id: id },
          update: { $set: { attended: true, attendanceTime: timestamp } }
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Mongo mark attendance failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const regRef = doc(db, "registrations", id);
      const regSnap = await getDoc(regRef);

      if (regSnap.exists()) {
        const reg = regSnap.data() as Registration;
        if (reg.status === RegistrationStatus.APPROVED) {
          await updateDoc(regRef, { attended: true, attendanceTime: timestamp });
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Firebase markAttendance failed:", e);
      return false;
    }
  }

  const regs = await getRegistrations();
  let found = false;
  const updated = regs.map(r => {
    if (r.id === id) {
      if (r.status === RegistrationStatus.APPROVED) {
        found = true;
        return { ...r, attended: true, attendanceTime: timestamp };
      }
    }
    return r;
  });

  if (found) {
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(updated));
  }
  return found;
};

// --- Auth & Users ---

// Retrieve user profile
const getUserProfile = async (uid: string): Promise<User | null> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'users', { filter: { id: uid } });
      return result.document || null;
    } catch (e) {
      console.error("Mongo get user failed", e);
      return null;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      return userDoc.exists() ? (userDoc.data() as User) : null;
    } catch (e) {
      console.error("Firebase getUserProfile failed:", e);
      return null;
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.USERS);
  const users: User[] = stored ? JSON.parse(stored) : [];
  return users.find(u => u.id === uid) || null;
};

// Save user profile
export const saveUserProfile = async (user: User): Promise<void> => {
  if (USE_MONGO) {
    try {
      // Check if exists first to avoid duplicates if using simplistic insert
      const existing = await getUserProfile(user.id);
      if (!existing) {
        await mongoRequest('insertOne', 'users', { document: user });
      } else {
        await mongoRequest('updateOne', 'users', {
          filter: { id: user.id },
          update: { $set: user }
        });
      }
      return;
    } catch (e) {
      console.error("Mongo save user failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await setDoc(doc(db, "users", user.id), user);
      return;
    } catch (e) {
      console.error("Firebase saveUserProfile failed:", e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.USERS);
  const users: User[] = stored ? JSON.parse(stored) : [];
  // Update if exists, else add
  const existingIndex = users.findIndex(u => u.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const registerUser = async (user: Omit<User, 'id'>, password: string): Promise<User | null> => {
  if (USE_FIREBASE_AUTH) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, password);
      const uid = userCredential.user.uid;

      const userData: User = {
        ...user,
        id: uid
      };

      await saveUserProfile(userData);
      return userData;
    } catch (error) {
      console.error("Firebase Registration error:", error);
      return null;
    }
  }

  // Common Logic for Mongo or Local (No Auth Provider)

  // Check if email already exists
  let existingUser = null;
  if (USE_MONGO) {
    const result = await mongoRequest('findOne', 'users', { filter: { email: user.email } });
    existingUser = result.document;
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    existingUser = users.find(u => u.email === user.email);
  }

  if (existingUser) return null;

  const newUser = { ...user, id: crypto.randomUUID(), password }; // Storing password for custom auth
  await saveUserProfile(newUser);

  // Auto-login for local/mongo mode persistence
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

  return newUser;
};

export const loginUser = async (email: string, password: string): Promise<User | null> => {
  if (USE_FIREBASE_AUTH) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return await getUserProfile(userCredential.user.uid);
    } catch (error) {
      console.error("Firebase Login error:", error);
      return null;
    }
  }

  // Common Logic for Mongo or Local
  let user: User | null = null;

  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'users', {
        filter: { email: email, password: password }
      });
      user = result.document || null;
    } catch (e) {
      console.error("Mongo Login Error", e);
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    user = users.find(u => u.email === email && u.password === password) || null;
  }

  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  return user;
};

export const loginWithGoogle = async (role: 'attendee' | 'organizer'): Promise<User | null> => {
  if (!USE_FIREBASE_AUTH) {
    alert("Firebase Auth is not configured.");
    return null;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    // Check if user profile already exists
    let userProfile = await getUserProfile(firebaseUser.uid);

    if (!userProfile) {
      // First time login - create profile
      userProfile = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'User',
        email: firebaseUser.email || '',
        role: role, // Role chosen by user in UI before clicking Google Sign In? Or we default?
        // We'll pass it in.
        password: '', // No password for OAuth
      };
      await saveUserProfile(userProfile);
    }

    return userProfile;
  } catch (error) {
    console.error("Google Sign In Error", error);
    return null;
  }
};

export const logoutUser = async (): Promise<void> => {
  if (USE_FIREBASE_AUTH) {
    await firebaseSignOut(auth);
  }

  // Clear local session regardless of mode
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (USE_FIREBASE_AUTH) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid);
        callback(userProfile);
      } else {
        callback(null);
      }
    });
  }

  // MongoDB or Local Storage Auth persistence
  const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      // Verify user still exists in "database" to be safe
      getUserProfile(user.id).then(verified => {
        if (verified) callback(verified);
        else {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
          callback(null);
        }
      });
    } catch (e) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      callback(null);
    }
  } else {
    callback(null);
  }

  return () => { };
};

export const resetUserPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  if (USE_FIREBASE_AUTH) {
    console.log(`[Reset Password] Using Firebase Auth for ${email}.`);
    try {
      await sendPasswordResetEmail(auth, email);
      console.log("[Reset Password] Firebase sendPasswordResetEmail completed successfully.");
      return {
        success: true,
        message: "Link sent! If you don't see it, check Spam or verify you didn't sign up with Google."
      };
    } catch (error: any) {
      console.error("[Reset Password] Firebase Error:", error);
      let msg = "Failed to send reset email.";
      if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
      if (error.code === 'auth/invalid-email') msg = "Invalid email address.";
      return { success: false, message: msg };
    }
  }

  // Local/Mock Implementation
  console.log(`[Reset Password] Attempting reset for: ${email}`);

  let exists = false;
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'users', { filter: { email } });
      console.log("[Reset Password] Mongo Find Result:", result);
      exists = !!result.document;
    } catch (e) {
      console.error("[Reset Password] Mongo Error:", e);
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    exists = users.some(u => u.email === email);
    console.log("[Reset Password] Local Storage Check:", exists);
  }

  if (exists) {
    const resetLink = `http://localhost:3000/reset-password-demo?email=${encodeURIComponent(email)}&token=${crypto.randomUUID()}`;
    console.log(`%c[MOCK EMAIL] Password Reset Link: ${resetLink}`, "color: #4f46e5; font-weight: bold; font-size: 14px;");
    return { success: true, message: "DEMO MODE: Reset link logged to browser console (F12)." };
  }

  console.warn(`[Reset Password] User with email ${email} not found.`);
  return { success: false, message: `User ${email} not found (Demo Mode).` };
};

// --- Notifications ---

export const getNotifications = async (userId: string): Promise<any[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'notifications', { filter: { userId: userId } });
      return result.documents.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Mongo fetch notifications failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Firebase getNotifications failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications');
  const notifications = stored ? JSON.parse(stored) : [];
  return notifications.filter((n: any) => n.userId === userId).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addNotification = async (notification: Omit<any, 'id'>): Promise<void> => {
  const newId = crypto.randomUUID();
  const newNotification = { ...notification, id: newId, createdAt: new Date().toISOString(), read: false };

  if (USE_MONGO) {
    try {
      await mongoRequest('insertOne', 'notifications', { document: newNotification });
      return;
    } catch (e) {
      console.error("Mongo add notification failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await addDoc(collection(db, "notifications"), newNotification);
      return;
    } catch (e) {
      console.error("Firebase addNotification failed:", e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications');
  const notifications = stored ? JSON.parse(stored) : [];
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications', JSON.stringify([...notifications, newNotification]));
};

export const markNotificationRead = async (id: string): Promise<void> => {
  if (USE_MONGO) {
    try {
      await mongoRequest('updateOne', 'notifications', {
        filter: { id: id },
        update: { $set: { read: true } }
      });
      return;
    } catch (e) {
      console.error("Mongo mark notification read failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      return;
    } catch (e) {
      console.error("Firebase markNotificationRead failed:", e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications');
  const notifications = stored ? JSON.parse(stored) : [];
  const updated = notifications.map((n: any) => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications', JSON.stringify(updated));
};

// --- Discussion Messages ---

export const getMessages = async (eventId: string): Promise<any[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'messages', { filter: { eventId: eventId } });
      return result.documents.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      console.error("Mongo fetch messages failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const q = query(
        collection(db, "messages"),
        where("eventId", "==", eventId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      console.error("Firebase getMessages failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem('eh_messages');
  const messages = stored ? JSON.parse(stored) : [];
  return messages.filter((m: any) => m.eventId === eventId).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const addMessage = async (message: Omit<any, 'id'>): Promise<void> => {
  const newId = crypto.randomUUID();
  const newMessage = { ...message, id: newId, createdAt: new Date().toISOString() };

  if (USE_MONGO) {
    try {
      await mongoRequest('insertOne', 'messages', { document: newMessage });
      return;
    } catch (e) {
      console.error("Mongo add message failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await addDoc(collection(db, "messages"), newMessage);
      return;
    } catch (e) {
      console.error("Firebase addMessage failed:", e);
    }
  }

  const stored = localStorage.getItem('eh_messages');
  const messages = stored ? JSON.parse(stored) : [];
  localStorage.setItem('eh_messages', JSON.stringify([...messages, newMessage]));
};