# Life Command Centre

## Short intro

Life Command Centre is a personal command center for people whose work is scattered across Gmail, Calendar, Drive, Docs, and Sheets. Instead of manually rebuilding your priorities every day, it turns those systems into one live queue of commitments you can review and act on in one place.

## One-line pitch

Life Command Centre is a personal operations dashboard that turns scattered work across Gmail, Calendar, Drive, Docs, and Sheets into one live queue of commitments, plus a daily briefing that tells you what actually matters.

## The problem

Most personal productivity systems fail because the real work is spread across too many tools. Deadlines live in calendar events, follow-ups hide in email threads, documents sit in Drive, and recurring responsibilities never make it into one reliable place. The result is missed commitments, constant context switching, and a daily habit of re-triaging the same mess by hand.

## The solution

Life Command Centre gives a single view of your actual commitments.

It connects to the tools you already use, extracts deadlines, follow-ups, recurring work, and document-driven tasks, and organizes them into a live operational queue. From there, you can:

- review a dashboard of what needs attention now
- trigger a fresh sync on demand
- add manual commitments quickly
- snooze or complete items
- generate a daily AI briefing
- draft Gmail replies
- edit calendar events
- preview documents tied to work in flight

## Feature explanation

### 1. Connector-based onboarding

Users connect the Google services they already rely on. This makes the product useful immediately without asking them to migrate their workflow into a brand-new system.

### 2. Live commitments queue

The core product surface is a queue of commitments, not a generic task list. It captures deadlines, follow-ups, recurring responsibilities, and document-related work, then organizes them into practical categories like loops, deadlines, recurring, documents, follow-ups, snoozed, and unclassified.

### 3. Manual capture

Not every important task comes from an external system. Quick Capture lets users add manual commitments directly so the dashboard stays complete.

### 4. On-demand sync

The `Check now` flow gives users control. They can pull in the latest updates from connected systems immediately and see per-source sync progress instead of waiting for a background job they cannot see.

### 5. Actionable queue items

The product is not just for reading. Users can mark work done, snooze it, unsnooze it, draft Gmail replies, edit calendar events, and preview document-backed items directly from the queue.

### 6. Daily AI Briefing

The AI briefing turns a large queue into a focused daily narrative. Instead of reading dozens of rows, the user gets a concise summary of what matters today and what needs attention next.

### 7. Read-only queue Q&A

The AI surface is also useful for lightweight questions like "what is overdue?" or "what is due this week?" without turning every interaction into a risky agent action.

### 8. Unclassified inbox

Some captured items need one more pass before they belong in the main queue. The unclassified inbox gives the system a staging area where items can be classified or dismissed without losing auditability.

## How it works

The product has two halves:

- `life-cc/`: a React frontend for the operator experience
- `pod/`: a Lemma pod bundle with tables, functions, workflows, schedules, and agents

The important design choice is that product actions are function-backed and deterministic wherever possible. That means durable actions like commitment creation, status updates, sync runs, document preview, Gmail draft creation, and calendar edits do not depend on a free-form agent deciding what to do. AI is used selectively where it adds value, mainly for briefings and reply suggestions.

## Why it is different

- It is built around commitments, not generic notes or tasks.
- It pulls work out of the systems where it already exists instead of asking the user to manually re-enter everything.
- It separates deterministic actions from AI generation, which makes the product safer and easier to trust.
- It keeps the AI layer narrow and useful: summarize, classify, suggest, but do not become the source of truth for every action.
- It is designed as a live operational console, not a static productivity dashboard.

## Who it is for

This project is strongest for:

- busy solo operators
- founders and executives
- people running their life through Google Workspace
- anyone who needs one place to manage follow-ups, deadlines, and recurring obligations

## Demo

### What to show

1. Start on onboarding or connections and connect Gmail, Calendar, Drive, Docs, and Sheets.
2. Run `Check now` and show that the system pulls in real commitments from connected tools.
3. Open the dashboard to show KPI cards, day navigation, and the live queue.
4. Move through the category views to show how commitments are grouped into useful buckets.
5. Use Quick Capture to add a manual item and show that the queue updates immediately.
6. Open the AI Briefing and show how it summarizes the day.
7. Ask a simple question in the queue Q&A, such as "What is overdue?" or "What is due this week?"
8. Open a Gmail-backed item and create a suggested reply draft.
9. Open a calendar-backed item and edit the event.
10. Open a document-backed item and preview the content.
11. Snooze one item and mark another done to show the queue is operational, not just informative.

### Demo talk track

“Life Command Centre pulls commitments out of the tools people already use and turns them into one operational view. Instead of checking Gmail, Calendar, and documents separately, the user can sync once, see everything in one queue, get a briefing, and act from the same interface.”

## Short version for intros

Life Command Centre is an AI-assisted personal ops layer for Google Workspace. It continuously turns your email, calendar, and documents into a live commitments queue, then helps you review, brief, and act on that work from one place.
