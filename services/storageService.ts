import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
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
  getDoc 
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../firebaseConfig";
import { Event, Registration, RegistrationStatus, User } from '../types';
import { STORAGE_KEYS } from '../constants';

// --- Configuration ---

// MongoDB Atlas Data API Configuration
const MONGO_CONFIG = {
  apiKey: process.env.MONGODB_API_KEY,
  endpoint: process.env.MONGODB_ENDPOINT,
  dataSource: process.env.MONGODB_DATA_SOURCE || 'Cluster0',
  database: process.env.MONGODB_DB_NAME || 'event_horizon',
};

// Hierarchy: MongoDB > Firebase > Local Storage
const USE_MONGO = !!(MONGO_CONFIG.apiKey && MONGO_CONFIG.endpoint);
const USE_FIREBASE = isFirebaseConfigured && !USE_MONGO;

// --- Helper Functions for MongoDB Data API ---

async function mongoRequest(action: string, collection: string, body: any = {}) {
  if (!USE_MONGO) throw new Error("MongoDB not configured");
  
  const response = await fetch(`${MONGO_CONFIG.endpoint}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': MONGO_CONFIG.apiKey!,
    },
    body: JSON.stringify({
      dataSource: MONGO_CONFIG.dataSource,
      database: MONGO_CONFIG.database,
      collection: collection,
      ...body
    })
  });

  if (!response.ok) {
    throw new Error(`MongoDB API Error: ${response.statusText}`);
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

  if (USE_FIREBASE) {
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
    } catch (e) {
      console.error("Mongo save event failed", e);
      return null;
    }
  }

  if (USE_FIREBASE) {
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
      await mongoRequest('updateOne', 'events', { 
        filter: { id: event.id },
        update: { $set: event }
      });
      return true;
    } catch (e) {
      console.error("Mongo update event failed", e);
      return false;
    }
  }

  if (USE_FIREBASE) {
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

  if (USE_FIREBASE) {
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
      const newReg = { ...reg, id: newId };
      await mongoRequest('insertOne', 'registrations', { document: newReg });
      return newReg;
    } catch (e) {
      console.error("Mongo add registration failed", e);
      return null;
    }
  }

  if (USE_FIREBASE) {
    try {
      const docRef = await addDoc(collection(db, "registrations"), reg);
      return { ...reg, id: docRef.id } as Registration;
    } catch (e) {
      console.error("Firebase addRegistration failed:", e);
      return null;
    }
  }

  const newReg = { ...reg, id: newId };
  const regs = await getRegistrations();
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify([...regs, newReg]));
  return newReg;
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

  if (USE_FIREBASE) {
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
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'registrations', { filter: { id: id } });
      const reg = result.document;
      
      if (reg && reg.status === RegistrationStatus.APPROVED) {
        await mongoRequest('updateOne', 'registrations', {
          filter: { id: id },
          update: { $set: { attended: true } }
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Mongo mark attendance failed", e);
      return false;
    }
  }

  if (USE_FIREBASE) {
    try {
      const regRef = doc(db, "registrations", id);
      const regSnap = await getDoc(regRef);
      
      if (regSnap.exists()) {
        const reg = regSnap.data() as Registration;
        if (reg.status === RegistrationStatus.APPROVED) {
          await updateDoc(regRef, { attended: true });
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
        return { ...r, attended: true };
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

  if (USE_FIREBASE) {
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
const saveUserProfile = async (user: User): Promise<void> => {
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

  if (USE_FIREBASE) {
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
  if (USE_FIREBASE) {
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
  if (USE_FIREBASE) {
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
    } catch(e) {
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

export const logoutUser = async (): Promise<void> => {
  if (USE_FIREBASE) {
    await firebaseSignOut(auth);
  }
  
  // Clear local session regardless of mode
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (USE_FIREBASE) {
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
  
  return () => {};
};