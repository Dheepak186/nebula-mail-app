# Nebula Mail
An AI-powered mail web application that integrates Gmail with an AI assistant capable of controlling the mail interface through natural-language commands.

## Live Demo
[Nebula Mail Live Demo](https://nebula-mail-app.vercel.app)

## GitHub Repository
[GitHub Repository](https://github.com/Dheepak186/nebula-mail-app)

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

The email is sent only after the user clicks **\*\*Send Email\*\***.

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

**\*\*Do not commit \`.env.local\` or any credentials to GitHub.\*\***

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
## Run Tests

The project includes Vitest unit tests for Gmail email-processing utilities.

```bash
npm run test
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

The project was tested using the deployed application and real Gmail data.

The demonstration covers:

1. Real Gmail Inbox with received messages.
2. Email detail view with current-email context available to the AI Assistant.
3. AI Compose filling To, Subject, and Message.
4. AI Search updating the main Inbox.
5. AI Filter actions for unread, date, sender, and keyword filtering.
6. AI Open navigating to a matching email.
7. AI Reply using the currently opened email as context.
8. AI Forward using the currently opened email as context.
9. AI Send preparing an email and requiring human confirmation before sending.
10. Gmail real-time synchronization where a newly received message appears without manually refreshing the page.
11. Gmail Thread View displaying multiple messages in the same conversation.
12. Dark Mode with persistent user preference.

---
# Security Considerations
* Google OAuth is used for Gmail authentication.

* Credentials and API keys are stored through environment variables.

* Secrets should not be committed to the public repository.

* AI-triggered email sending uses a human confirmation step.

* Gmail operations are performed through authenticated API requests.

---
# What I Would Improve With More Time

The main required and bonus functionality has been implemented. Further improvements could include:

## 1. More Natural AI Command Handling

Expand the AI command layer to understand more variations of the same request and provide clearer explanations when an action cannot be completed.

## 2. More Comprehensive Automated Testing

Additional integration and end-to-end tests could cover:

- Gmail API operations
- AI command parsing
- Search and filters
- Compose and send
- Reply and forward
- Authentication
- Real-time synchronization

## 3. Richer AI Action Previews

The assistant could provide richer visual previews for search results, email previews, suggested replies, and filter summaries.

## 4. Accessibility and Responsive Refinements

Additional keyboard navigation, accessibility improvements, animations, and mobile-specific layout refinements could further improve the application.

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

* Gmail real-time synchronization with automatic Inbox updates

* Google Cloud Pub/Sub integration

* Vercel deployment

* Public GitHub repository
* Gmail Thread View
* Human confirmation before AI-triggered sending
* Rich Inbox UI
* Dark Mode
* Persistent theme preference
* Automated unit tests with Vitest

The project is intended to demonstrate how an AI assistant can interact with and control a real mail application through natural-language commands.

---
# License
This project was created as part of the Nebula KnowLab 2027 Batch hiring task.
