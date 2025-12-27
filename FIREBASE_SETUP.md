# Firebase Setup Guide

To enable Firebase Authentication for your application, follow these steps:

## 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add project"** and follow the setup wizard.
3. Once created, go to **"Authentication"** > **"Get started"**.
4. Enable **"Email/Password"** sign-in method.

## 2. Get Your Web App Credentials
1. In the Project Overview (gear icon > Project settings), scroll down to **"Your apps"**.
2. Click the **"</>" (Web)** icon.
3. Register your app (e.g., "EventHorizon").
4. You will see a `firebaseConfig` object. It looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:..."
   };
   ```

## 3. Update your `.env` File
Copy the values from your `firebaseConfig` and paste them into your `.env` file in the project root:

```env
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
```

## 4. Restart the Server
After saving the `.env` file, stop your running server (Ctrl+C) and restart it:
```bash
npm run dev:all
```
