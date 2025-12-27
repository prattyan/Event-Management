import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

async function connectDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB via Connection String");
        db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');
    } catch (e) {
        console.error("Failed to connect to MongoDB", e);
    }
}

connectDB();

// Generic Data API Proxy
app.post('/api/action/:action', async (req, res) => {
    const { action } = req.params;
    const { collection, filter, document, update } = req.body;

    if (!db) return res.status(500).json({ error: "Database not connected" });

    const col = db.collection(collection);
    console.log(`Processing ${action} on ${collection} with filter:`, JSON.stringify(filter));

    try {
        let result;
        switch (action) {
            case 'find':
                const query = filter || {};
                // Handle basic ID queries if passed as string but stored as ObjectId?
                // For simplicity, we assume the frontend sends what matches. 
                // But our storageService generates UUID strings for IDs, so we don't need ObjectId casting usually.
                result = await col.find(query).toArray();
                // Wrap in 'documents' to match Data API response format
                res.json({ documents: result });
                break;

            case 'findOne':
                result = await col.findOne(filter || {});
                res.json({ document: result });
                break;

            case 'insertOne':
                result = await col.insertOne(document);
                res.json({ insertedId: result.insertedId });
                break;

            case 'updateOne':
                // MongoDB driver updateOne takes (filter, update)
                // Data API 'update' usually has operators like $set
                result = await col.updateOne(filter, update);
                res.json(result);
                break;

            case 'deleteOne':
                result = await col.deleteOne(filter);
                res.json(result);
                break;

            case 'deleteMany':
                result = await col.deleteMany(filter);
                res.json(result);
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
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
