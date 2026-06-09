# CodeAlpha Tasks

This repository contains three deployable CodeAlpha demo projects:

- `E_Commerce_Store`: Django e-commerce store
- `socialmedia`: Django social media app
- `project_management_tool`: Node.js project management tool

## Live Demo Deployment With Render

The root `render.yaml` file defines one Render web service for each project. To deploy all three:

1. Push this repository to GitHub.
2. Open Render.
3. Choose `New +` then `Blueprint`.
4. Connect this repository.
5. Let Render create the services from `render.yaml`.

Render services:

```text
codealpha-ecommerce-store
codealpha-socialmedia
codealpha-project-management-tool
```

## Git Remote

This local repository is connected to:

```text
https://github.com/nagamallika30/codealpha_tasks.git
```

## Demo Data Notes

The Django apps use SQLite. The Node app stores data in `backend/data/db.json`. These are suitable for live demos, but production deployments should use managed databases and persistent file storage.
