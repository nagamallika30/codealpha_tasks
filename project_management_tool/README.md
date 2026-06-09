# Project Management Tool

A full-stack collaborative board app similar to Trello or Asana. It includes authentication, group projects, task assignment, comments, notifications, analytics, persisted backend data, and real-time updates over WebSockets.

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Demo login:

- Email: `demo@example.com`
- Password: `demo123`

## Features

- Register and sign in with token-based auth.
- Create group projects and invite existing users by email.
- Create and edit task cards with status, priority, assignee, due date, and description.
- Track task labels, sprint, estimated hours, blocked reason, checklists, and link attachments.
- Filter boards by search term, assignee, priority, label, and delivery risk.
- Comment inside task cards for task-level communication.
- View project analytics for completion rate, overdue work, blocked work, checklist progress, priority mix, status distribution, and team workload.
- Review a project activity timeline for task changes, comments, checklist updates, invites, and project creation.
- Receive notifications for invites, assignments, task changes, and comments.
- Live board updates using WebSockets.
- Data persists to `backend/data/db.json`.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/members`
- `POST /api/projects/:id/tasks`
- `PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/checklist/:itemId`
- `POST /api/tasks/:id/comments`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `GET /ws?token=...`
