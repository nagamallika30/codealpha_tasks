# SocialApp

A Django social media project with authentication, profiles, image posts, likes, comments, follows, search, profile editing, and responsive UI.

## Features

- Register, login, and logout
- Create image/text posts
- Like and comment on posts
- Follow and unfollow users
- Search people by username/name
- Edit profile photo, headline, bio, location, website, and skills
- Portfolio-style profile pages
- Admin dashboards for posts, comments, and profiles

## Run Locally

```powershell
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver
```

Open:

```text
http://127.0.0.1:8000/
```

## Deployment Environment Variables

Set these on your hosting platform:

```text
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com
```

## Start Command

```text
gunicorn socialmedia.wsgi:application
```
