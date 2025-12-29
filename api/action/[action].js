import { MongoClient } from 'mongodb';

let cachedClient = null;

async function getClient() {
    if (cachedClient) return cachedClient;

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGODB_URI");

    const client = new MongoClient(uri, {
        tls: true,
        serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    cachedClient = client;
    return client;
}

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action } = req.query;
        const { collection, filter, document: docData, update } = req.body;

        if (!collection) {
            return res.status(400).json({ error: "Missing collection name" });
        }

        const client = await getClient();
        const db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');
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
                return res.status(200).json({ documents: result });

            case 'findOne':
                const findOneOptions = {};
                if (req.body.projection) findOneOptions.projection = req.body.projection;
                result = await col.findOne(filter || {}, findOneOptions);
                return res.status(200).json({ document: result });

            case 'insertOne':
                result = await col.insertOne(docData);
                return res.status(200).json({ insertedId: result.insertedId });

            case 'updateOne':
                result = await col.updateOne(filter || {}, update);
                return res.status(200).json(result);

            case 'deleteOne':
                result = await col.deleteOne(filter || {});
                return res.status(200).json(result);

            case 'deleteMany':
                result = await col.deleteMany(filter || {});
                return res.status(200).json(result);

            case 'fetchBatch':
                // req.body.requests should be an array of { collection, action, filter, limit, projection, sort }
                const requests = req.body.requests;
                if (!Array.isArray(requests)) {
                    return res.status(400).json({ error: "Batch requests must be an array" });
                }

                // Execute all requests in parallel
                const batchResults = await Promise.all(requests.map(async (reqItem) => {
                    try {
                        const batchCol = db.collection(reqItem.collection);
                        if (reqItem.action === 'find') {
                            const opts = {};
                            if (reqItem.limit) opts.limit = parseInt(reqItem.limit);
                            if (reqItem.projection) opts.projection = reqItem.projection;
                            if (reqItem.sort) opts.sort = reqItem.sort;
                            const docs = await batchCol.find(reqItem.filter || {}, opts).toArray();
                            return { documents: docs };
                        } else if (reqItem.action === 'findOne') {
                            const opts = {};
                            if (reqItem.projection) opts.projection = reqItem.projection;
                            const doc = await batchCol.findOne(reqItem.filter || {}, opts);
                            return { document: doc };
                        }
                        return null;
                    } catch (e) {
                        return { error: e.message };
                    }
                }));
                return res.status(200).json({ results: batchResults });

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (e) {
        console.error("Vercel API Error:", e);
        return res.status(500).json({
            error: "Server Error",
            details: e.message
        });
    }
}
