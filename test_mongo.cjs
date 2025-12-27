const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkEvents() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("Missing MONGODB_URI");
        return;
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');
        const events = await db.collection('events').find({}).limit(5).toArray();
        console.log("Events sample:", JSON.stringify(events, null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

checkEvents();
