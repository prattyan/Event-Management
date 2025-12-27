import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
// Cache the client to reuse connects in serverless environment
let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to .env.local");
}

if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    // Expecting POST request
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // The action is part of the query parameter in Vercel functions if using rewrites?
    // Or we can just use query param: /api/action?type=find
    // But our current frontend calls /api/action/:action
    // Let's rely on query params or path segments if configured. 
    // Easier: Parse everything from body or query.

    // Actually, standard Vercel function at api/action.js maps to /api/action
    // So we will pass the 'action' in the body or query.
    // Let's modify frontend to receive action in body or URL query.
    // The current route is /api/action/:action. 
    // Vercel dynamic routes: api/action/[action].js would map to /api/action/find

    try {
        const { action } = req.query; // If file is api/action/[action].js, this works.

        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');

        const { collection, filter, document: docData, update } = req.body;

        console.log(`Processing Vercel ${action} on ${collection}`);

        const col = db.collection(collection);
        let result;

        switch (action) {
            case 'find':
                result = await col.find(filter || {}).toArray();
                res.status(200).json({ documents: result });
                break;

            case 'findOne':
                result = await col.findOne(filter || {});
                res.status(200).json({ document: result });
                break;

            case 'insertOne':
                result = await col.insertOne(docData);
                res.status(200).json({ insertedId: result.insertedId });
                break;

            case 'updateOne':
                result = await col.updateOne(filter || {}, update);
                res.status(200).json(result);
                break;

            case 'deleteOne':
                result = await col.deleteOne(filter || {});
                res.status(200).json(result);
                break;

            default:
                res.status(400).json({ error: "Unknown action" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}
