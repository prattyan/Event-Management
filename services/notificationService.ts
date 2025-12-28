import { RegistrationStatus } from '../types';

// In a real application, this would call a backend endpoint or a service like EmailJS / SendGrid.
// For this demo, we simulate the network delay and log the email content.

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

const simulateSendEmail = async (payload: EmailPayload): Promise<boolean> => {
  console.group('📧 Email Simulation');
  console.log(`To: ${payload.to}`);
  console.log(`Subject: ${payload.subject}`);
  console.log(`Body: \n${payload.body}`);
  console.groupEnd();

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  return true;
};

export const sendStatusUpdateEmail = async (
  toEmail: string,
  participantName: string,
  eventTitle: string,
  status: RegistrationStatus
): Promise<boolean> => {
  const isApproved = status === RegistrationStatus.APPROVED;
  const subject = isApproved
    ? `Confirmation: You're going to ${eventTitle}!`
    : `Update regarding your registration for ${eventTitle}`;

  const body = isApproved
    ? `Dear ${participantName},

We are thrilled to inform you that your registration for "${eventTitle}" has been APPROVED!

You can now view your digital ticket in the "My Tickets" section of the EventHorizon app. Please present your QR code at the venue for entry.

We look forward to seeing you there!

Best regards,
The EventHorizon Team`
    : `Dear ${participantName},

Thank you for your interest in "${eventTitle}".

Unfortunately, we are unable to approve your registration at this time. This may be due to capacity limits or specific event criteria.

We hope to see you at future events.

Best regards,
The EventHorizon Team`;

  return simulateSendEmail({ to: toEmail, subject, body });
};

export const sendReminderEmail = async (
  toEmail: string,
  participantName: string,
  eventTitle: string,
  eventDate: string,
  location: string
): Promise<boolean> => {
  const formattedDate = new Date(eventDate).toLocaleString();

  const subject = `Reminder: Upcoming Event - ${eventTitle}`;

  const body = `Dear ${participantName},

This is a friendly reminder that you are registered for "${eventTitle}".

📅 Date: ${formattedDate}
📍 Location: ${location}

Don't forget to have your QR code ticket ready for check-in upon arrival. You can access it via the "My Tickets" tab in the app.

Safe travels!

Best regards,
The EventHorizon Team`;

  return simulateSendEmail({ to: toEmail, subject, body });
};
