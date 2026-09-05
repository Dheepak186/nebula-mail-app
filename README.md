# Nebula Mail

An AI-powered mail web application that integrates Gmail with an AI assistant capable of controlling the mail interface through natural-language commands.

## Live Demo

https://nebula-mail-app.vercel.app

## GitHub Repository

https://github.com/Dheepak186/nebula-mail-app

---

## Project Overview

Nebula Mail is a Gmail-integrated web application built as an engineering hiring-task project.

The application combines:

* Real Gmail account integration
* Inbox and Sent mail
* Email search and filtering
* Email composition and sending
* AI-powered email actions
* Context-aware reply and forward
* Real-time Gmail synchronization
* Human confirmation before AI-triggered sending

The main goal is to make the AI assistant an interactive controller of the mail interface rather than only a conversational chatbot.

---

# Key Features

## Gmail Integration

The application connects to a real Gmail account using Google OAuth.

Supported Gmail operations include:

* Read Inbox emails
* Read Sent emails
* Open individual emails
* Search emails
* Filter emails
* Compose emails
* Send real emails

---

## Inbox

The Inbox displays real emails from the connected Gmail account.

Each email can be opened to view its details.

---

## Sent Mail

The Sent section displays emails sent through the connected Gmail account.

---

## Compose Email

Users can manually compose an email with:

* Recipient
* Subject
* Message

The email can then be sent through Gmail.

---

## Email Filters

The Inbox supports filtering by:

* Keyword
* Sender
* From date
* To date
* Read status
* Unread status

Multiple filters can be combined.

---

# AI Assistant

The AI Assistant is the main feature of Nebula Mail.

Instead of only returning text responses, the assistant can perform actions inside the application.

## Supported AI Actions

### Compose

Example:

> Compose an email to [john@example.com](mailto:john@example.com) with subject Meeting Tomorrow and body Let's meet at 3pm.

The assistant opens the compose page and fills:

* To
* Subject
* Message

The user can review the generated content before sending.

### Send

Example:

> Send an email to [john@example.com](mailto:john@example.com) with subject Meeting Tomorrow and body Let's meet at 3pm.

The assistant prepares the email and displays a confirmation card.

The user can review:

* Recipient
* Subject
* Message

The email is sent only after the user clicks **Send Email**.

This provides a human-in-the-loop confirmation step before an external action.

### Search

Example:

> Find emails from Chess.com.

The assistant converts the request into a Gmail search operation and updates the main Inbox with the matching messages.

### Filtering

The assistant can translate natural-language requests into mail filters.

Examples:

> Find unread emails.

> Find emails from Claude.

> Find emails from today.

> Find emails from Claude containing the word plan.

The assistant applies the appropriate filters and displays the matching emails in the main mail interface.

### Open Email

Example:

> Open the email from Chess.com.

The assistant navigates to the corresponding email detail page.

### Reply

When an email is currently open, the user can say:

> Reply to this saying thanks.

The assistant understands the currently displayed email and prepares a reply using the email as context.

### Forward

Example:

> Forward this email to [john@example.com](mailto:john@example.com).

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

# Architecture

Nebula Mail uses a web application architecture where the frontend, backend API routes, Gmail APIs, AI processing, and real-time notification system work together.

```text
                         ┌──────────────────────┐
                         │       User           │
                         └──────────┬───────────┘
                                    │
                                    v
                         ┌──────────────────────┐
                         │   Nebula Mail UI     │
                         │      Next.js          │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────┘       └─────────────┐
                    v                                  v
          ┌───────────────────┐              ┌──────────────────┐
          │   AI Assistant   │              │   Mail Interface │
          └─────────┬─────────┘              └────────┬─────────┘
                    │                                 │
                    v                                 v
          ┌───────────────────┐              ┌──────────────────┐
          │ Backend API Routes│              │ Gmail API        │
          └─────────┬─────────┘              └────────┬─────────┘
                    │                                 │
                    └────────────────┬────────────────┘
                                     v
                            ┌──────────────────┐
                            │   Gmail Account  │
                            └──────────────────┘


Real-Time Synchronization:

Gmail
  │
  v
Gmail Watch
  │
  v
Google Cloud Pub/Sub
  │
  v
Webhook
  │
  v
Nebula Mail Realtime State
  │
  v
Mail UI
```

---

# Architecture Decisions and Trade-offs

## Next.js Application Architecture

The application uses a Next.js-based architecture so that the user interface and backend API routes can be maintained within the same project.

### Decision

Use Next.js for both the mail interface and server-side API functionality.

### Reason

This keeps the project relatively simple for a small application and avoids maintaining separate frontend and backend deployments.

### Trade-off

A larger production system could separate frontend and backend services for independent scaling and deployment. For this project, the single application architecture keeps development and deployment simpler.

---

## Gmail API Integration

The application uses the Gmail API rather than mocking email data.

### Decision

Use real Gmail data and Gmail operations.

### Reason

The hiring task requires real Gmail integration and actual email sending.

### Trade-off

Real Gmail integration introduces OAuth configuration, access-token handling, API limitations, and external dependency on Google's services. However, it provides a realistic mail application rather than a simulated demo.

---

## AI as an Action Controller

The AI Assistant is designed to perform application actions instead of only generating conversational responses.

### Decision

Natural-language commands are translated into application actions such as:

* Compose
* Search
* Filter
* Open
* Reply
* Forward
* Send

### Reason

The main objective is to demonstrate an AI assistant that can control the mail interface.

### Trade-off

Action-based AI requires additional validation and state management compared with a simple chatbot. The benefit is a more useful and interactive user experience.

---

## Human Confirmation Before Sending

AI-generated emails are not automatically sent without user confirmation.

### Decision

Display the generated email content and require the user to confirm sending.

### Reason

Sending an email is an external action with real-world consequences.

### Trade-off

This adds one interaction step, but it reduces the risk of accidental or incorrect AI-triggered email sending.

---

## Real-Time Gmail Synchronization

The application uses Gmail Watch notifications with Google Cloud Pub/Sub.

### Decision

Use Gmail push notifications instead of continuously polling Gmail from the browser.

### Reason

Push notifications are more efficient and better suited for detecting changes to the mailbox.

### Trade-off

The implementation requires Google Cloud Pub/Sub configuration and webhook infrastructure. Real-time synchronization is therefore more complex than simple client-side polling.

The backend Gmail watch and webhook flow has been verified in production.

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
Mail UI
```

The project includes backend components for:

* Gmail watch registration
* Gmail webhook handling
* Synchronization state
* Real-time event processing

The production Gmail watch and webhook notification flow has been tested successfully.

---

# Project Structure

The project follows a Next.js application structure.

Important areas include:

```text
app/
  API routes
  Mail pages
  UI components

lib/
  Gmail integration
  Gmail real-time synchronization
  Application utilities
```

Important real-time files include:

```text
lib/gmail-realtime.ts
app/api/gmail/webhook/route.ts
app/api/gmail/sync-status/route.ts
app/api/gmail/watch/route.ts
```

---

# Setup Instructions

## Prerequisites

Install:

* Node.js
* npm
* Git

A Google Cloud project with Gmail API and OAuth configuration is required for real Gmail integration.

An AI API configuration is also required for the AI Assistant functionality.

---

## Clone the Repository

```bash
git clone https://github.com/Dheepak186/nebula-mail-app.git
cd nebula-mail-app
```

---

## Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a local environment file:

```text
.env.local
```

Configure the required environment variables for:

* Google OAuth
* Gmail API access
* AI API access
* Application configuration

**Do not commit `.env.local` or any credentials to GitHub.**

The exact environment variable names should match the variables used by the application source code.

---

## Run the Development Server

```bash
npm run dev
```

The application can then be opened locally in the browser.

---

## Production Build

To verify the project builds successfully:

```bash
npm run build
```

---

# Deployment

The application is deployed using Vercel.

Live application:

https://nebula-mail-app.vercel.app

The production deployment includes the Gmail integration and AI Assistant functionality.

---

# AI Assistant Demo

The assistant can control the mail interface using natural-language commands.

Example workflow:

```text
User:
"Find unread emails"

        ↓

AI Assistant

        ↓

Interprets the request

        ↓

Applies the unread filter

        ↓

Main Inbox displays matching emails
```

Another example:

```text
User:
"Open the email from Claude"

        ↓

AI Assistant

        ↓

Searches for the requested email

        ↓

Identifies the matching message

        ↓

Opens the email detail page
```

Compose workflow:

```text
User:
"Compose an email to john@example.com
with subject Meeting Tomorrow"

        ↓

AI Assistant

        ↓

Opens Compose

        ↓

Fills To / Subject / Message

        ↓

User reviews the email

        ↓

User confirms Send
```

These workflows demonstrate that the assistant is interacting with the application's UI state rather than acting only as a text chatbot.

---

# Screenshots / Demo Evidence

Screenshots or a short video demonstration can be added here to show the AI Assistant controlling the mail interface.

Recommended demonstrations include:

1. AI Compose — assistant fills To, Subject and Message.
2. AI Search — assistant searches Gmail and updates the main inbox.
3. AI Filter — assistant applies unread/date/sender/keyword filters.
4. AI Open — assistant opens a specific email.
5. AI Reply — assistant uses the currently opened email as context.
6. AI Send — assistant prepares an email and waits for user confirmation.

> Demo screenshots/video should be added to this section before final submission if available.

---

# Security Considerations

* Google OAuth is used for Gmail authentication.
* Credentials and API keys are stored through environment variables.
* Secrets should not be committed to the public repository.
* AI-triggered email sending uses a human confirmation step.
* Gmail operations are performed through authenticated API requests.

---

# What I Would Improve With More Time

If additional development time were available, the following improvements would be considered:

## 1. Stronger Real-Time UI Updates

The backend Gmail webhook and watch system are implemented and verified. The next improvement would be making the frontend update immediately and reliably when a new Gmail event arrives without causing the inbox to flicker or temporarily lose displayed messages.

## 2. Conversation / Thread View

A full Gmail-style conversation view could be added so that related messages are grouped into a single thread.

## 3. Automated Testing

Unit tests and integration tests could be added for:

* Gmail API operations
* AI command parsing
* Search and filters
* Compose and send
* Reply and forward
* Authentication
* Real-time synchronization

## 4. Richer AI Interface

The assistant could provide richer visual previews for actions such as:

* Search results
* Email previews
* Suggested replies
* Filter summaries

## 5. Improved AI Command Handling

The AI command layer could be expanded to handle more natural variations of the same request and provide clearer feedback when an action cannot be completed.

## 6. Dark Mode and UI Refinements

Additional UI customization, including dark mode, animations, responsive improvements, and accessibility refinements, could further improve the user experience.

---

# Current Project Status

The main hiring-task functionality has been implemented and tested:

* Real Gmail integration
* Google OAuth
* Inbox
* Sent mail
* Compose
* Real email sending
* AI Compose
* AI Send
* AI Search
* AI Filters
* AI Open
* Context-aware AI Reply
* AI Forward
* Gmail real-time backend synchronization
* Google Cloud Pub/Sub integration
* Vercel deployment
* Public GitHub repository

The project is intended to demonstrate how an AI assistant can interact with and control a real mail application through natural-language commands.

---

# License

This project was created as part of the Nebula KnowLab 2027 Batch hiring task.
