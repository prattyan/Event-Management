import { MongoClient } from 'mongodb';

let cachedClient = null;

async function getClient() {
    if (cachedClient) return cachedClient;

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGODB_URI environment variable");

    const client = new MongoClient(uri, {
        tls: true,
        serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    cachedClient = client;
    return client;
}

export const handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, POST, PUT, DELETE, PATCH',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const action = event.queryStringParameters.action;
        const body = JSON.parse(event.body || '{}');
        const { collection, filter, document: docData, update } = body;

        if (!collection) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing collection name" }) };
        }

        const client = await getClient();
        const db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');
        const col = db.collection(collection);

        let result;

        switch (action) {
            case 'find':
                const query = filter || {};
                const options = {};
                if (body.limit) options.limit = parseInt(body.limit);
                if (body.projection) options.projection = body.projection;
                if (body.sort) options.sort = body.sort;
                result = await col.find(query, options).toArray();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ documents: result })
                };

            case 'findOne':
                const findOneOptions = {};
                if (body.projection) findOneOptions.projection = body.projection;
                result = await col.findOne(filter || {}, findOneOptions);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ document: result })
                };

            case 'insertOne':
                result = await col.insertOne(docData);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ insertedId: result.insertedId })
                };

            case 'updateOne':
                result = await col.updateOne(filter || {}, update);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(result)
                };

            case 'deleteOne':
                result = await col.deleteOne(filter || {});
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(result)
                };

            case 'deleteMany':
                result = await col.deleteMany(filter || {});
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(result)
                };

            case 'fetchBatch':
                const requests = body.requests;
                if (!Array.isArray(requests)) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: "Batch requests must be an array" }) };
                }
                const batchResults = await Promise.all(requests.map(async (reqItem) => {
                    try {
                        const batchCol = db.collection(reqItem.collection);
                        if (reqItem.action === 'find') {
                            const opts = {};
                            if (reqItem.limit) opts.limit = parseInt(reqItem.limit);
                            if (reqItem.projection) opts.projection = reqItem.projection;
                            const docs = await batchCol.find(reqItem.filter || {}, opts).toArray();
                            return { documents: docs };
                        } else if (reqItem.action === 'findOne') {
                            const opts = {};
                            if (reqItem.projection) opts.projection = reqItem.projection;
                            const doc = await batchCol.findOne(reqItem.filter || {}, opts);
                            return { document: doc };
                        }
                        return null;
                    } catch (e) { return { error: e.message }; }
                }));
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ results: batchResults })
                };

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Unknown action: ${action}` })
                };
        }
    } catch (e) {
        console.error("MongoDB Function Error:", e);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Server Error",
                details: e.message
            })
        };
    }
};
