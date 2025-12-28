import { MongoClient } from 'mongodb';

// We'll initialize the client lazily in the handler to avoid crashing on module load
// if the env var is missing. This allows us to return a proper error message.

async function getClientPromise() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGODB_URI");

    // In standard serverless, caching the client is good, but for debugging 
    // let's create a fresh connection if the promise isn't holding up.
    if (!global._mongoClientPromise) {
        const options = {
            tls: true,
            serverSelectionTimeoutMS: 5000,
            // Sometimes needed if Atlas has issues with specific Node versions in serverless
            // family: 4 
        };
        const client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
}

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action } = req.query; // Derived from filename [action].js

        // Get the database client
        const mongoClient = await getClientPromise();
        const db = mongoClient.db(process.env.MONGODB_DB_NAME || 'event_horizon');

        const { collection, filter, document: docData, update } = req.body;

        if (!collection) {
            return res.status(400).json({ error: "Missing collection name" });
        }

        const col = db.collection(collection);
        let result;

        switch (action) {
            case 'find':
                const query = filter || {};
                const options = {};
                if (req.body.limit) options.limit = parseInt(req.body.limit);
                if (req.body.projection) options.projection = req.body.projection;
                if (req.body.sort) options.sort = req.body.sort;

                result = await col.find(query, options).toArray();
                res.status(200).json({ documents: result });
                break;

            case 'findOne':
                const findOneOptions = {};
                if (req.body.projection) findOneOptions.projection = req.body.projection;
                result = await col.findOne(filter || {}, findOneOptions);
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

            case 'deleteMany':
                result = await col.deleteMany(filter || {});
                res.status(200).json(result);
                break;

            default:
                res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (e) {
        console.error("FULL VERCEL API ERROR:", e);
        console.error("ERROR MESSAGE:", e.message);
        console.error("Stack:", e.stack);
        res.status(500).json({
            error: "Server Error",
            details: e.message,
            hint: "Check Vercel Logs for 'FULL VERCEL API ERROR'"
        });
    }
}
