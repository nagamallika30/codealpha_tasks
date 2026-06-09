const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const STATUSES = ["Backlog", "In Progress", "Review", "Blocked", "Done"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const clients = new Map();

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const createdAt = now();
    const seedPassword = hashPassword("demo123");
    const demoUser = {
      id: "usr_demo",
      name: "Demo Lead",
      email: "demo@example.com",
      passwordHash: seedPassword.hash,
      passwordSalt: seedPassword.salt,
      createdAt
    };
    const teammate = {
      id: "usr_team",
      name: "Taylor Ops",
      email: "taylor@example.com",
      passwordHash: seedPassword.hash,
      passwordSalt: seedPassword.salt,
      createdAt
    };
    const project = {
      id: "prj_demo",
      name: "Website Launch",
      description: "Coordinate launch tasks, reviews, and release notes.",
      ownerId: demoUser.id,
      memberIds: [demoUser.id, teammate.id],
      createdAt,
      updatedAt: createdAt
    };
    const task = {
      id: "tsk_demo",
      projectId: project.id,
      title: "Finalize launch checklist",
      description: "Confirm content, QA, analytics, and rollout ownership.",
      status: "In Progress",
      priority: "High",
      assigneeId: teammate.id,
      dueDate: "",
      labels: ["Launch", "QA"],
      checklist: [
        { id: "chk_demo_1", text: "Review final pages", done: true },
        { id: "chk_demo_2", text: "Confirm analytics events", done: false },
        { id: "chk_demo_3", text: "Prepare release notes", done: false }
      ],
      attachments: [
        { id: "att_demo_1", name: "Launch plan", url: "https://example.com/launch-plan", createdAt }
      ],
      estimateHours: 6,
      sprint: "Sprint 1",
      blockedReason: "",
      createdBy: demoUser.id,
      createdAt,
      updatedAt: createdAt
    };
    const blockedTask = {
      id: "tsk_blocked",
      projectId: project.id,
      title: "Resolve staging deployment access",
      description: "Ops needs access restored before release testing can continue.",
      status: "Blocked",
      priority: "Urgent",
      assigneeId: demoUser.id,
      dueDate: "",
      labels: ["DevOps", "Risk"],
      checklist: [
        { id: "chk_blocked_1", text: "Open access ticket", done: true },
        { id: "chk_blocked_2", text: "Confirm staging login", done: false }
      ],
      attachments: [],
      estimateHours: 3,
      sprint: "Sprint 1",
      blockedReason: "Waiting on staging account permissions.",
      createdBy: teammate.id,
      createdAt,
      updatedAt: createdAt
    };
    writeDb({
      users: [demoUser, teammate],
      sessions: [],
      projects: [project],
      tasks: [task, blockedTask],
      comments: [
        {
          id: "cmt_demo",
          taskId: task.id,
          userId: demoUser.id,
          body: "Please add the analytics verification step before release.",
          createdAt
        }
      ],
      activities: [
        {
          id: "act_demo",
          projectId: project.id,
          taskId: task.id,
          userId: demoUser.id,
          type: "comment_added",
          message: "commented on Finalize launch checklist",
          createdAt
        }
      ],
      notifications: []
    });
  }
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return normalizeDb(db);
}

function writeDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function normalizeDb(db) {
  db.users ||= [];
  db.sessions ||= [];
  db.projects ||= [];
  db.tasks ||= [];
  db.comments ||= [];
  db.activities ||= [];
  db.notifications ||= [];
  for (const project of db.projects) {
    project.memberIds ||= project.ownerId ? [project.ownerId] : [];
    project.updatedAt ||= project.createdAt || now();
  }
  for (const task of db.tasks) {
    task.labels = Array.isArray(task.labels) ? task.labels : [];
    task.checklist = Array.isArray(task.checklist) ? task.checklist : [];
    task.attachments = Array.isArray(task.attachments) ? task.attachments : [];
    task.estimateHours = Number(task.estimateHours || 0);
    task.sprint = task.sprint || "";
    task.blockedReason = task.blockedReason || "";
    if (!STATUSES.includes(task.status)) task.status = "Backlog";
    if (!PRIORITIES.includes(task.priority)) task.priority = "Medium";
  }
  const demoProject = db.projects.find(project => project.id === "prj_demo");
  const demoTask = db.tasks.find(task => task.id === "tsk_demo");
  if (demoProject && demoTask && !demoTask.labels.length) {
    demoTask.labels = ["Launch", "QA"];
    demoTask.checklist = [
      { id: "chk_demo_1", text: "Review final pages", done: true },
      { id: "chk_demo_2", text: "Confirm analytics events", done: false },
      { id: "chk_demo_3", text: "Prepare release notes", done: false }
    ];
    demoTask.attachments = [{ id: "att_demo_1", name: "Launch plan", url: "https://example.com/launch-plan", createdAt: demoTask.createdAt || now() }];
    demoTask.estimateHours = 6;
    demoTask.sprint = "Sprint 1";
  }
  if (demoProject && !db.tasks.some(task => task.id === "tsk_blocked")) {
    const createdAt = now();
    db.tasks.push({
      id: "tsk_blocked",
      projectId: demoProject.id,
      title: "Resolve staging deployment access",
      description: "Ops needs access restored before release testing can continue.",
      status: "Blocked",
      priority: "Urgent",
      assigneeId: "usr_demo",
      dueDate: "",
      labels: ["DevOps", "Risk"],
      checklist: [
        { id: "chk_blocked_1", text: "Open access ticket", done: true },
        { id: "chk_blocked_2", text: "Confirm staging login", done: false }
      ],
      attachments: [],
      estimateHours: 3,
      sprint: "Sprint 1",
      blockedReason: "Waiting on staging account permissions.",
      createdBy: "usr_team",
      createdAt,
      updatedAt: createdAt
    });
  }
  if (demoProject && !db.activities.some(activity => activity.projectId === demoProject.id)) {
    db.activities.push({
      id: "act_demo",
      projectId: demoProject.id,
      taskId: demoTask?.id || "",
      userId: "usr_demo",
      type: "project_reviewed",
      message: "reviewed launch readiness and checklist progress",
      createdAt: demoTask?.createdAt || now()
    });
  }
  return db;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex")
  };
}

function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function stripSecrets(db) {
  return {
    users: db.users.map(publicUser),
    projects: db.projects,
    tasks: db.tasks,
    comments: db.comments,
    notifications: db.notifications
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return "";
}

function authenticate(req, db) {
  const token = getToken(req);
  const session = db.sessions.find(item => item.token === token);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  return db.users.find(user => user.id === session.userId) || null;
}

function isProjectMember(project, userId) {
  return project && project.memberIds.includes(userId);
}

function getProjectBundle(db, projectId) {
  const project = db.projects.find(item => item.id === projectId);
  if (!project) return null;
  const tasks = db.tasks.filter(task => task.projectId === projectId);
  const taskIds = new Set(tasks.map(task => task.id));
  return {
    project,
    tasks,
    comments: db.comments.filter(comment => taskIds.has(comment.taskId)),
    activities: db.activities
      .filter(activity => activity.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 80),
    analytics: buildAnalytics(db, projectId),
    users: db.users.filter(user => project.memberIds.includes(user.id)).map(publicUser)
  };
}

function buildAnalytics(db, projectId) {
  const tasks = db.tasks.filter(task => task.projectId === projectId);
  const counts = Object.fromEntries(STATUSES.map(status => [status, 0]));
  const priorities = Object.fromEntries(PRIORITIES.map(priority => [priority, 0]));
  const workload = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let overdue = 0;
  let dueSoon = 0;
  let completedChecklist = 0;
  let totalChecklist = 0;

  for (const task of tasks) {
    counts[task.status] = (counts[task.status] || 0) + 1;
    priorities[task.priority] = (priorities[task.priority] || 0) + 1;
    if (task.assigneeId) {
      workload[task.assigneeId] ||= { taskCount: 0, estimateHours: 0 };
      workload[task.assigneeId].taskCount += 1;
      workload[task.assigneeId].estimateHours += Number(task.estimateHours || 0);
    }
    for (const item of task.checklist || []) {
      totalChecklist += 1;
      if (item.done) completedChecklist += 1;
    }
    if (task.dueDate && task.status !== "Done") {
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);
      const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (days < 0) overdue += 1;
      if (days >= 0 && days <= 7) dueSoon += 1;
    }
  }

  const done = counts.Done || 0;
  return {
    totalTasks: tasks.length,
    completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    overdue,
    dueSoon,
    blocked: counts.Blocked || 0,
    counts,
    priorities,
    workload,
    checklistRate: totalChecklist ? Math.round((completedChecklist / totalChecklist) * 100) : 0
  };
}

function logActivity(db, projectId, taskId, userId, type, message) {
  const activity = { id: id("act"), projectId, taskId, userId, type, message, createdAt: now() };
  db.activities.unshift(activity);
  return activity;
}

function parseLabels(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean).slice(0, 8);
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseChecklist(value, existing = []) {
  if (Array.isArray(value)) {
    return value
      .map(item => ({
        id: item.id || id("chk"),
        text: String(item.text || "").trim(),
        done: Boolean(item.done)
      }))
      .filter(item => item.text)
      .slice(0, 30);
  }
  const existingByText = new Map(existing.map(item => [item.text.toLowerCase(), item]));
  return String(value || "")
    .split("\n")
    .map(text => text.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map(text => {
      const previous = existingByText.get(text.toLowerCase());
      return previous || { id: id("chk"), text, done: false };
    });
}

function parseAttachments(value, existing = []) {
  if (Array.isArray(value)) {
    return value
      .map(item => ({
        id: item.id || id("att"),
        name: String(item.name || item.url || "").trim(),
        url: String(item.url || "").trim(),
        createdAt: item.createdAt || now()
      }))
      .filter(item => item.name && item.url)
      .slice(0, 12);
  }
  const lines = String(value || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!lines.length) return existing;
  return lines.map(line => {
    const [namePart, urlPart] = line.includes("|") ? line.split("|") : [line, line];
    return {
      id: id("att"),
      name: String(namePart || urlPart).trim(),
      url: String(urlPart || namePart).trim(),
      createdAt: now()
    };
  });
}

function createNotification(db, userId, type, message, meta = {}) {
  const notification = {
    id: id("ntf"),
    userId,
    type,
    message,
    meta,
    read: false,
    createdAt: now()
  };
  db.notifications.unshift(notification);
  return notification;
}

function notifyProject(db, project, actorId, type, message, meta = {}) {
  return project.memberIds
    .filter(userId => userId !== actorId)
    .map(userId => createNotification(db, userId, type, message, meta));
}

function sendSocket(socket, event) {
  socket.write(encodeWsFrame(JSON.stringify(event)));
}

function broadcastToUsers(userIds, event) {
  for (const userId of userIds) {
    for (const socket of clients.get(userId) || []) {
      sendSocket(socket, event);
    }
  }
}

function broadcastProject(project, event) {
  broadcastToUsers(project.memberIds, event);
}

function encodeWsFrame(text) {
  const payload = Buffer.from(text);
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(FRONTEND_DIR, safePath));
  if (!filePath.startsWith(FRONTEND_DIR)) return sendError(res, 403, "Forbidden.");
  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(FRONTEND_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) return sendError(res, 404, "Not found.");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const db = readDb();
  const pathname = url.pathname;

  if (req.method === "POST" && pathname === "/api/auth/register") {
    const body = await parseBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!name || !email || password.length < 6) {
      return sendError(res, 400, "Name, valid email, and a 6+ character password are required.");
    }
    if (db.users.some(user => user.email === email)) return sendError(res, 409, "Email is already registered.");
    const passwordData = hashPassword(password);
    const user = {
      id: id("usr"),
      name,
      email,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      createdAt: now()
    };
    const token = id("ses");
    db.users.push(user);
    db.sessions.push({ token, userId: user.id, createdAt: now(), expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString() });
    writeDb(db);
    return sendJson(res, 201, { token, user: publicUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = db.users.find(item => item.email === email);
    if (!user) return sendError(res, 401, "Invalid email or password.");
    const candidate = hashPassword(password, user.passwordSalt);
    if (candidate.hash !== user.passwordHash) return sendError(res, 401, "Invalid email or password.");
    const token = id("ses");
    db.sessions.push({ token, userId: user.id, createdAt: now(), expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString() });
    writeDb(db);
    return sendJson(res, 200, { token, user: publicUser(user) });
  }

  const user = authenticate(req, db);
  if (!user) return sendError(res, 401, "Authentication required.");

  if (req.method === "GET" && pathname === "/api/me") {
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === "GET" && pathname === "/api/projects") {
    const projects = db.projects
      .filter(project => project.memberIds.includes(user.id))
      .map(project => ({
        ...project,
        taskCount: db.tasks.filter(task => task.projectId === project.id).length,
        memberCount: project.memberIds.length
      }));
    return sendJson(res, 200, { projects, users: db.users.map(publicUser) });
  }

  if (req.method === "POST" && pathname === "/api/projects") {
    const body = await parseBody(req);
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    if (!name) return sendError(res, 400, "Project name is required.");
    const project = {
      id: id("prj"),
      name,
      description,
      ownerId: user.id,
      memberIds: [user.id],
      createdAt: now(),
      updatedAt: now()
    };
    db.projects.unshift(project);
    logActivity(db, project.id, "", user.id, "project_created", `created project ${project.name}`);
    writeDb(db);
    return sendJson(res, 201, { project });
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (req.method === "GET" && projectMatch) {
    const bundle = getProjectBundle(db, projectMatch[1]);
    if (!bundle || !isProjectMember(bundle.project, user.id)) return sendError(res, 404, "Project not found.");
    return sendJson(res, 200, bundle);
  }

  const memberMatch = pathname.match(/^\/api\/projects\/([^/]+)\/members$/);
  if (req.method === "POST" && memberMatch) {
    const body = await parseBody(req);
    const project = db.projects.find(item => item.id === memberMatch[1]);
    if (!project || !isProjectMember(project, user.id)) return sendError(res, 404, "Project not found.");
    const email = String(body.email || "").trim().toLowerCase();
    const invited = db.users.find(item => item.email === email);
    if (!invited) return sendError(res, 404, "No user with that email exists.");
    if (!project.memberIds.includes(invited.id)) project.memberIds.push(invited.id);
    project.updatedAt = now();
    const notification = createNotification(db, invited.id, "project_invite", `${user.name} added you to ${project.name}.`, { projectId: project.id });
    logActivity(db, project.id, "", user.id, "member_added", `added ${invited.name} to the project`);
    writeDb(db);
    broadcastProject(project, { type: "project_updated", project: getProjectBundle(db, project.id), notification });
    return sendJson(res, 200, getProjectBundle(db, project.id));
  }

  const taskCollectionMatch = pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
  if (req.method === "POST" && taskCollectionMatch) {
    const body = await parseBody(req);
    const project = db.projects.find(item => item.id === taskCollectionMatch[1]);
    if (!project || !isProjectMember(project, user.id)) return sendError(res, 404, "Project not found.");
    const title = String(body.title || "").trim();
    if (!title) return sendError(res, 400, "Task title is required.");
    const assigneeId = project.memberIds.includes(body.assigneeId) ? body.assigneeId : "";
    const task = {
      id: id("tsk"),
      projectId: project.id,
      title,
      description: String(body.description || "").trim(),
      status: STATUSES.includes(body.status) ? body.status : "Backlog",
      priority: PRIORITIES.includes(body.priority) ? body.priority : "Medium",
      assigneeId,
      dueDate: String(body.dueDate || "").trim(),
      labels: parseLabels(body.labels),
      checklist: parseChecklist(body.checklist),
      attachments: parseAttachments(body.attachments),
      estimateHours: Number(body.estimateHours || 0),
      sprint: String(body.sprint || "").trim(),
      blockedReason: String(body.blockedReason || "").trim(),
      createdBy: user.id,
      createdAt: now(),
      updatedAt: now()
    };
    db.tasks.unshift(task);
    project.updatedAt = now();
    logActivity(db, project.id, task.id, user.id, "task_created", `created task ${task.title}`);
    notifyProject(db, project, user.id, "task_created", `${user.name} created "${task.title}".`, { projectId: project.id, taskId: task.id });
    if (assigneeId && assigneeId !== user.id) {
      createNotification(db, assigneeId, "task_assigned", `${user.name} assigned you "${task.title}".`, { projectId: project.id, taskId: task.id });
    }
    writeDb(db);
    const bundle = getProjectBundle(db, project.id);
    broadcastProject(project, { type: "project_updated", project: bundle });
    return sendJson(res, 201, { task, project: bundle });
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (req.method === "PATCH" && taskMatch) {
    const body = await parseBody(req);
    const task = db.tasks.find(item => item.id === taskMatch[1]);
    const project = task && db.projects.find(item => item.id === task.projectId);
    if (!task || !project || !isProjectMember(project, user.id)) return sendError(res, 404, "Task not found.");
    const previousAssignee = task.assigneeId;
    for (const key of ["title", "description", "dueDate"]) {
      if (key in body) task[key] = String(body[key] || "").trim();
    }
    if (STATUSES.includes(body.status)) task.status = body.status;
    if (PRIORITIES.includes(body.priority)) task.priority = body.priority;
    if ("assigneeId" in body) task.assigneeId = project.memberIds.includes(body.assigneeId) ? body.assigneeId : "";
    if ("labels" in body) task.labels = parseLabels(body.labels);
    if ("checklist" in body) task.checklist = parseChecklist(body.checklist, task.checklist);
    if ("attachments" in body) task.attachments = parseAttachments(body.attachments, task.attachments);
    if ("estimateHours" in body) task.estimateHours = Number(body.estimateHours || 0);
    if ("sprint" in body) task.sprint = String(body.sprint || "").trim();
    if ("blockedReason" in body) task.blockedReason = String(body.blockedReason || "").trim();
    task.updatedAt = now();
    project.updatedAt = now();
    logActivity(db, project.id, task.id, user.id, "task_updated", `updated task ${task.title}`);
    notifyProject(db, project, user.id, "task_updated", `${user.name} updated "${task.title}".`, { projectId: project.id, taskId: task.id });
    if (task.assigneeId && task.assigneeId !== previousAssignee && task.assigneeId !== user.id) {
      createNotification(db, task.assigneeId, "task_assigned", `${user.name} assigned you "${task.title}".`, { projectId: project.id, taskId: task.id });
    }
    writeDb(db);
    const bundle = getProjectBundle(db, project.id);
    broadcastProject(project, { type: "project_updated", project: bundle });
    return sendJson(res, 200, { task, project: bundle });
  }

  const commentMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/comments$/);
  if (req.method === "POST" && commentMatch) {
    const body = await parseBody(req);
    const task = db.tasks.find(item => item.id === commentMatch[1]);
    const project = task && db.projects.find(item => item.id === task.projectId);
    if (!task || !project || !isProjectMember(project, user.id)) return sendError(res, 404, "Task not found.");
    const commentBody = String(body.body || "").trim();
    if (!commentBody) return sendError(res, 400, "Comment cannot be empty.");
    const comment = { id: id("cmt"), taskId: task.id, userId: user.id, body: commentBody, createdAt: now() };
    db.comments.push(comment);
    task.updatedAt = now();
    project.updatedAt = now();
    logActivity(db, project.id, task.id, user.id, "comment_added", `commented on ${task.title}`);
    notifyProject(db, project, user.id, "comment_added", `${user.name} commented on "${task.title}".`, { projectId: project.id, taskId: task.id });
    writeDb(db);
    const bundle = getProjectBundle(db, project.id);
    broadcastProject(project, { type: "project_updated", project: bundle });
    return sendJson(res, 201, { comment, project: bundle });
  }

  const checklistMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/checklist\/([^/]+)$/);
  if (req.method === "PATCH" && checklistMatch) {
    const task = db.tasks.find(item => item.id === checklistMatch[1]);
    const project = task && db.projects.find(item => item.id === task.projectId);
    if (!task || !project || !isProjectMember(project, user.id)) return sendError(res, 404, "Checklist item not found.");
    const item = task.checklist.find(check => check.id === checklistMatch[2]);
    if (!item) return sendError(res, 404, "Checklist item not found.");
    item.done = !item.done;
    task.updatedAt = now();
    project.updatedAt = now();
    logActivity(db, project.id, task.id, user.id, "checklist_toggled", `${item.done ? "completed" : "reopened"} checklist item ${item.text}`);
    writeDb(db);
    const bundle = getProjectBundle(db, project.id);
    broadcastProject(project, { type: "project_updated", project: bundle });
    return sendJson(res, 200, { task, project: bundle });
  }

  if (req.method === "GET" && pathname === "/api/notifications") {
    return sendJson(res, 200, { notifications: db.notifications.filter(item => item.userId === user.id) });
  }

  const notificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (req.method === "PATCH" && notificationMatch) {
    const notification = db.notifications.find(item => item.id === notificationMatch[1] && item.userId === user.id);
    if (!notification) return sendError(res, 404, "Notification not found.");
    notification.read = true;
    writeDb(db);
    return sendJson(res, 200, { notification });
  }

  sendError(res, 404, "API route not found.");
}

function handleUpgrade(req, socket) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/ws") return socket.destroy();
  const db = readDb();
  const token = url.searchParams.get("token") || "";
  const session = db.sessions.find(item => item.token === token);
  const user = session && db.users.find(item => item.id === session.userId);
  if (!user) return socket.destroy();

  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      ""
    ].join("\r\n")
  );

  if (!clients.has(user.id)) clients.set(user.id, new Set());
  clients.get(user.id).add(socket);
  sendSocket(socket, { type: "connected", user: publicUser(user) });
  socket.on("close", () => clients.get(user.id)?.delete(socket));
  socket.on("error", () => clients.get(user.id)?.delete(socket));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    sendError(res, 500, error.message || "Server error.");
  }
});

server.on("upgrade", handleUpgrade);
server.listen(PORT, () => {
  ensureDb();
  console.log(`Project management tool running at http://localhost:${PORT}`);
});
