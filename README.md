# Nebula Mail

An AI-powered mail web application that integrates Gmail with an AI assistant capable of controlling the mail interface through natural-language commands.

## Live Demo

https://nebula-mail-app.vercel.app

## Project Overview

Nebula Mail is a Gmail-integrated web application built as an engineering hiring-task project.

The application combines:

- Real Gmail account integration
- Inbox and Sent mail
- Email search and filtering
- Email composition and sending
- AI-powered email actions
- Context-aware reply and forward
- Real-time Gmail synchronization
- Human confirmation before AI-triggered sending

The main goal is to make the AI assistant an interactive controller of the mail interface rather than only a conversational chatbot.

---

## Key Features

### Gmail Integration

The application connects to a real Gmail account using Google OAuth.

Supported Gmail operations include:

- Read Inbox emails
- Read Sent emails
- Open individual emails
- Search emails
- Filter emails
- Compose emails
- Send real emails

### Inbox

The Inbox displays real emails from the connected Gmail account.

Each email can be opened to view its details.

### Sent Mail

The Sent section displays emails sent through the connected Gmail account.

### Compose Email

Users can manually compose an email with:

- Recipient
- Subject
- Message

The email can then be sent through Gmail.

### Email Filters

The Inbox supports filtering by:

- Keyword
- Sender
- From date
- To date
- Read status
- Unread status

Multiple filters can be combined.

---

# AI Assistant

The AI Assistant is the main feature of Nebula Mail.

Instead of only returning text responses, the assistant can perform actions inside the application.

## Supported AI Actions

### Compose

Example:

> Compose an email to john@example.com with subject Meeting Tomorrow and body Let's meet at 3pm.

The assistant opens the compose page and fills:

- To
- Subject
- Message

The user can review the generated content before sending.

### Send

Example:

> Send an email to john@example.com with subject Meeting Tomorrow and body Let's meet at 3pm.

The assistant prepares the email and displays a confirmation card.

The user can review:

- Recipient
- Subject
- Message

The email is sent only after the user clicks **Send Email**.

This provides a human-in-the-loop confirmation step before an external action.

### Search

Example:

> Find emails from Chess.com.

The assistant converts the request into a Gmail search operation and updates the main Inbox with the matching messages.

### Open Email

Example:

> Open the email from Chess.com.

The assistant navigates to the corresponding email detail page.

### Reply

When an email is currently open, the user can say:

> Reply to this saying thanks.

The assistant understands the currently displayed email and prepares a reply.

### Forward

Example:

> Forward this email to john@example.com.

The assistant prepares a forwarded email using the currently opened email as context.

---

# Context Awareness

The AI Assistant can use the currently opened email as context.

For example:

1. User opens an email.
2. User asks: "Reply to this saying thanks."
3. The assistant identifies the current email.
4. The reply is prepared using the current email context.

This allows the assistant to operate on the email currently being viewed instead of requiring the user to manually provide the email information again.

---

# Real-Time Gmail Synchronization

Nebula Mail implements Gmail push notifications using Google Cloud Pub/Sub.

The synchronization flow is:

```text
Gmail
   |
   v
Gmail Watch
   |
   v
Google Cloud Pub/Sub
   |
   v
Webhook Endpoint
   |
   v
Nebula Mail Realtime State
   |
   v
Mail UI detects change
   |
   v
Inbox refreshes