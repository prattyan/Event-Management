# EventHorizon 🚀

EventHorizon is a premium, full-stack event management platform designed to provide a seamless experience for both event organizers and attendees. Built with a modern tech stack and a focus on sleek, responsive UI, it offers robust features for event creation, registration, and attendance tracking.

---

## ✨ Key Features

### 👤 User Roles
- **Organizers**: Create and manage events, approve/reject registrations, track attendance via QR scanning, and send automated reminders.
- **Attendees**: Browse upcoming events, view beautiful event details, register with custom questions, and access digital tickets.

### 📅 Event Management
- **Smart Event Dashboard**: Clear separation between upcoming and past events.
- **AI-Powered Descriptions**: Integrated with **Google Gemini AI** to automatically generate compelling event descriptions based on your title and location.
- **Live Status**: Real-time indicators for events currently in progress.
- **Premium Image Handling**: Integrated image cropping tool (`react-easy-crop`) for high-quality event cards.

### 🎫 Registration & Ticketing
- **Custom Questionnaires**: Organizers can add text, multiple-choice, or yes/no questions to registration forms.
- **Approval Workflow**: Organizers can review participant answers before approving registrations.
- **Digital Tickets**: Approved attendees receive a unique QR-coded ticket for easy entry.
- **Attendance Tracking**: Built-in QR scanner for organizers to mark attendance instantly.

### 📱 Premium UX
- **Perfect Mobile View**: A fully responsive "app-like" experience optimized for touch and small screens.
- **Glassmorphic UI**: Sleek, modern aesthetic using Tailwind CSS with dark mode, backdrop blurs, and smooth animations.
- **Instant Feedback**: Toast notifications for all user actions.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Icons**: Lucide React
- **Backend API**: Node.js & Express
- **Database**: MongoDB Atlas (Data API / Connection String)
- **Authentication**: Firebase Auth (Email/Password & Google Login)
- **AI Integration**: Google Gemini API
- **Utilities**: `date-fns` (Date formatting), `react-qr-code` (Ticket generation), `react-easy-crop` (Image processing)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/cloud/atlas) account
- [Firebase](https://console.firebase.google.com/) project
- [Google AI (Gemini)](https://aistudio.google.com/) API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/event-management.git
   cd event-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory (or use `.env.local`) and add the following:
   ```env
   # Gemini AI
   GEMINI_API_KEY=your_gemini_api_key

   # MongoDB
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB_NAME=event_horizon

   # Firebase
   FIREBASE_API_KEY=your_firebase_key
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   ```

4. **Run the application**
   Launch both the frontend and the backend server concurrently:
   ```bash
   npm run dev:all
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000`

---

## 🏗️ Project Structure

- `/src`: Main application logic (React components and hooks)
- `/services`: API integration (Storage, AI, Notifications)
- `/components`: Reusable UI components (Scanner, Layouts)
- `server.js`: Express proxy for secure MongoDB operations
- `types.ts`: Global TypeScript interfaces

---

## 🔒 Security

EventHorizon uses a secure proxy server (`server.js`) to interact with the MongoDB Data API, ensuring that database credentials and API keys are never exposed on the client side. Authentication is handled safely via Firebase's secure SDKs.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

---

**Built with ❤️ for better event experiences.**
