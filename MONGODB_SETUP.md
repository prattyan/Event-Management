# MongoDB Setup Guide (Connection String Method)

You have switched to using a direct **Connection String** (`mongodb+srv://...`).
To support this, a lightweight backend server has been added to your project.

## 1. Get your Connection String
1.  Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2.  Click **Connect** on your Cluster.
3.  Choose **Drivers** (Node.js).
4.  Copy the connection string (e.g., `mongodb+srv://<username>:<password>@cluster0...`).

## 2. Update Environment Variables
1.  Open `.env`.
2.  Paste your connection string into `MONGODB_URI`.
3.  Replace `<password>` with your actual database user password.

```env
GEMINI_API_KEY=...
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.example.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=event_horizon
```

## 3. Run the Application
Instead of just `npm run dev`, you should now run:

```bash
npm run dev:all
```

This command runs **both**:
- The Backend Server (Port 5000) - Connects to MongoDB
- The Frontend App (Port 3000) - Connects to the Backend

If you see "Connected to MongoDB via Connection String" in the terminal, it is working!
