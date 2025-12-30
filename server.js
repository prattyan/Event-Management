import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

app.use(compression()); // Enable GZIP compression
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

io.on('connection', (socket) => {
    console.log('📱 User connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('📱 User disconnected:', socket.id);
    });
});

// Request Logger for debugging latency
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.log(`⚠️ Slow Request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
    });
    next();
});

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("❌ MONGODB_URI is missing from environment variables!");
    process.exit(1);
}

const client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxConnecting: 10,
    waitQueueTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
});

// Proper cleanup on shutdown
process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await client.close();
    process.exit(0);
});

let db;

async function ensureIndexes() {
    if (!db) return;
    try {
        console.log("⚡ Ensuring Indexes...");
        // Events
        await db.collection('events').createIndex({ id: 1 }, { unique: true });
        await db.collection('events').createIndex({ organizerId: 1 });
        await db.collection('events').createIndex({ date: 1 });

        // Registrations
        await db.collection('registrations').createIndex({ id: 1 }, { unique: true });
        await db.collection('registrations').createIndex({ eventId: 1 });
        await db.collection('registrations').createIndex({ participantEmail: 1 });
        await db.collection('registrations').createIndex({ participantId: 1 });

        // Users
        await db.collection('users').createIndex({ id: 1 }, { unique: true });
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ role: 1 });

        // Teams
        await db.collection('teams').createIndex({ id: 1 }, { unique: true });
        await db.collection('teams').createIndex({ eventId: 1 });
        await db.collection('teams').createIndex({ inviteCode: 1 }, { unique: true });

        // Notifications
        await db.collection('notifications').createIndex({ userId: 1 });
        await db.collection('notifications').createIndex({ createdAt: -1 });

        console.log("✅ Indexes: Verified/Created");
    } catch (e) {
        console.error("❌ Indexes: Creation failed", e.message);
    }
}

async function connectDB() {
    try {
        console.log("----------------------------------------");
        console.log("Initializing Event Server...");

        // Check Gemini
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey && geminiKey.length > 20) {
            console.log("✅ Gemini API Key: Found (Configured)");
        } else {
            console.log("❌ Gemini API Key: MISSING or INVALID (Check .env)");
        }

        // Connect Mongo
        await client.connect();
        console.log("✅ MongoDB: Connected Successfully");

        db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');
        await ensureIndexes();
        console.log("----------------------------------------");
    } catch (e) {
        console.log("❌ MongoDB: Connection Failed");
        console.error(e);
        console.log("----------------------------------------");
    }
}

connectDB();

// Generic Data API Proxy
app.post('/api/action/:action', async (req, res) => {
    const { action } = req.params;
    const { collection, filter, document, update } = req.body;

    if (!db) return res.status(500).json({ error: "Database not connected" });

    let col;
    if (collection) {
        col = db.collection(collection);
    }

    // Simple In-Memory Cache for GET-like POST requests (find/findOne)
    // Cache key based on collection + action + filters
    const cacheKey = `${collection}:${action}:${JSON.stringify(req.body)}`;
    const CACHE_TTL = 30000; // 30 seconds

    if (!global.apiCache) global.apiCache = new Map();

    if (action === 'find' || action === 'findOne') {
        const cached = global.apiCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return res.json(cached.data);
        }
    }

    // Invalidate cache on mutations
    if (['insertOne', 'updateOne', 'deleteOne', 'deleteMany'].includes(action)) {
        // Clear all cache for this collection to be safe
        Array.from(global.apiCache.keys()).forEach(key => {
            if (key.startsWith(`${collection}:`)) {
                global.apiCache.delete(key);
            }
        });
    }

    try {
        let result;
        const setCache = (data) => {
            if (action === 'find' || action === 'findOne') {
                global.apiCache.set(cacheKey, { data, timestamp: Date.now() });
            }
        };
        switch (action) {
            case 'find':
                const query = filter || {};
                const options = {};
                if (req.body.limit) options.limit = parseInt(req.body.limit);
                if (req.body.projection) options.projection = req.body.projection;
                if (req.body.sort) options.sort = req.body.sort;

                result = await col.find(query, options).toArray();
                const responseData = { documents: result };
                setCache(responseData);
                res.json(responseData);
                break;

            case 'findOne':
                const findOneOptions = {};
                if (req.body.projection) findOneOptions.projection = req.body.projection;
                result = await col.findOne(filter || {}, findOneOptions);
                const responseDataOne = { document: result };
                setCache(responseDataOne);
                res.json(responseDataOne);
                break;

            case 'insertOne':
                result = await col.insertOne(document);
                // Real-time notifications
                if (collection === 'registrations') {
                    io.emit('data_updated', { collection: 'registrations', action: 'insert', eventId: document.eventId });
                } else if (collection === 'events') {
                    io.emit('data_updated', { collection: 'events', action: 'insert', document });
                } else if (collection === 'notifications') {
                    io.emit('notification_received', document);
                }
                res.json({ insertedId: result.insertedId });
                break;

            case 'updateOne':
                // MongoDB driver updateOne takes (filter, update)
                // Data API 'update' usually has operators like $set
                result = await col.updateOne(filter, update);
                if (collection === 'events' || collection === 'registrations') {
                    io.emit('data_updated', { collection, action: 'update', filter, update });
                }
                res.json(result);
                break;

            case 'deleteOne':
                result = await col.deleteOne(filter);
                if (collection === 'events' || collection === 'registrations') {
                    io.emit('data_updated', { collection, action: 'delete', filter });
                }
                res.json(result);
                break;

            case 'deleteMany':
                result = await col.deleteMany(filter);
                if (collection === 'events' || collection === 'registrations') {
                    io.emit('data_updated', { collection, action: 'delete_many', filter });
                }
                res.json(result);
                break;

            case 'fetchBatch':
                const { requests } = req.body;
                if (!Array.isArray(requests)) {
                    return res.status(400).json({ error: "requests must be an array" });
                }

                // Execute all requests in parallel
                const results = await Promise.all(requests.map(async (reqItem) => {
                    const subCol = db.collection(reqItem.collection);
                    if (reqItem.action === 'find') {
                        const subQuery = reqItem.filter || {};
                        const subOptions = {};
                        if (reqItem.limit) subOptions.limit = parseInt(reqItem.limit);
                        if (reqItem.projection) subOptions.projection = reqItem.projection;
                        if (reqItem.sort) subOptions.sort = reqItem.sort;

                        const docs = await subCol.find(subQuery, subOptions).toArray();
                        return { documents: docs };
                    } else if (reqItem.action === 'findOne') {
                        const subOptions = {};
                        if (reqItem.projection) subOptions.projection = reqItem.projection;
                        const doc = await subCol.findOne(reqItem.filter || {}, subOptions);
                        return { document: doc };
                    }
                    return { error: "Unsupported batch action" };
                }));

                res.json({ results });
                break;

            default:
                res.status(400).json({ error: "Unknown action" });
        }
    } catch (e) {
        console.error("Action failed", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
