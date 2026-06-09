const STATUSES = ["Backlog", "In Progress", "Review", "Blocked", "Done"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const state = {
  token: localStorage.getItem("pmt_token") || "",
  user: JSON.parse(localStorage.getItem("pmt_user") || "null"),
  projects: [],
  activeProjectId: localStorage.getItem("pmt_project") || "",
  activeProject: null,
  notifications: [],
  socket: null,
  authMode: "login",
  modal: null,
  drawerOpen: false,
  view: localStorage.getItem("pmt_view") || "board",
  filters: {
    search: "",
    assignee: "all",
    priority: "all",
    label: "all",
    risk: "all"
  }
};

const app = document.querySelector("#app");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function userName(userId) {
  return (state.activeProject?.users || []).find(user => user.id === userId)?.name || "Unassigned";
}

function taskRisk(task) {
  if (task.status === "Blocked") return "blocked";
  if (!task.dueDate || task.status === "Done") return "normal";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days <= 7) return "due-soon";
  return "normal";
}

function checklistProgress(task) {
  const items = task.checklist || [];
  if (!items.length) return { done: 0, total: 0, rate: 0 };
  const done = items.filter(item => item.done).length;
  return { done, total: items.length, rate: Math.round((done / items.length) * 100) };
}

function allLabels() {
  return [...new Set((state.activeProject?.tasks || []).flatMap(task => task.labels || []))].sort();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("pmt_token", token);
  localStorage.setItem("pmt_user", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("pmt_token");
  localStorage.removeItem("pmt_user");
  localStorage.removeItem("pmt_project");
  state.token = "";
  state.user = null;
  state.activeProject = null;
  state.projects = [];
  state.socket?.close();
  render();
}

async function loadApp() {
  if (!state.token) return render();
  try {
    const [projectData, notificationData] = await Promise.all([
      api("/api/projects"),
      api("/api/notifications")
    ]);
    state.projects = projectData.projects;
    state.notifications = notificationData.notifications;
    if (!state.activeProjectId && state.projects[0]) state.activeProjectId = state.projects[0].id;
    if (state.activeProjectId) await loadProject(state.activeProjectId);
    connectSocket();
  } catch (error) {
    console.warn(error);
    logout();
  }
  render();
}

async function loadProject(projectId) {
  const project = await api(`/api/projects/${projectId}`);
  state.activeProject = project;
  state.activeProjectId = project.project.id;
  localStorage.setItem("pmt_project", state.activeProjectId);
}

function connectSocket() {
  if (state.socket || !state.token) return;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${location.host}/ws?token=${encodeURIComponent(state.token)}`);
  state.socket = socket;
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "project_updated") {
      if (message.project?.project?.id === state.activeProjectId) state.activeProject = message.project;
      refreshSidebar();
    }
    if (message.notification) state.notifications.unshift(message.notification);
    render();
  });
  socket.addEventListener("close", () => {
    state.socket = null;
    if (state.token) setTimeout(connectSocket, 1200);
  });
}

async function refreshSidebar() {
  const data = await api("/api/projects");
  state.projects = data.projects;
}

function filteredTasks() {
  const search = state.filters.search.toLowerCase().trim();
  return (state.activeProject?.tasks || []).filter(task => {
    const haystack = [task.title, task.description, task.sprint, task.blockedReason, ...(task.labels || [])]
      .join(" ")
      .toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (state.filters.assignee !== "all" && task.assigneeId !== state.filters.assignee) return false;
    if (state.filters.priority !== "all" && task.priority !== state.filters.priority) return false;
    if (state.filters.label !== "all" && !(task.labels || []).includes(state.filters.label)) return false;
    if (state.filters.risk !== "all" && taskRisk(task) !== state.filters.risk) return false;
    return true;
  });
}

function render() {
  if (!state.token || !state.user) return renderAuth();
  renderShell();
}

function renderAuth() {
  const isLogin = state.authMode === "login";
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-copy">
        <h1>Project Management Tool</h1>
        <p>Plan group work with live boards, analytics, workload visibility, checklists, task discussions, and project notifications.</p>
      </section>
      <section class="auth-panel">
        <h2>${isLogin ? "Sign in" : "Create account"}</h2>
        <form class="form" id="authForm">
          ${isLogin ? "" : `<div class="field"><label for="name">Name</label><input id="name" name="name" autocomplete="name" required /></div>`}
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" value="${isLogin ? "demo@example.com" : ""}" required /></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" value="${isLogin ? "demo123" : ""}" required minlength="6" /></div>
          <div class="error" id="authError"></div>
          <button class="btn primary" type="submit">${isLogin ? "Sign in" : "Create account"}</button>
        </form>
        <button class="link-button" id="toggleAuth">${isLogin ? "Need an account? Register" : "Already have an account? Sign in"}</button>
      </section>
    </main>
  `;
  document.querySelector("#toggleAuth").addEventListener("click", () => {
    state.authMode = isLogin ? "register" : "login";
    render();
  });
  document.querySelector("#authForm").addEventListener("submit", handleAuth);
}

async function handleAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const error = document.querySelector("#authError");
  error.textContent = "";
  try {
    const data = await api(state.authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") })
    });
    setAuth(data.token, data.user);
    await loadApp();
  } catch (err) {
    error.textContent = err.message;
  }
}

function renderShell() {
  const project = state.activeProject?.project;
  const unread = state.notifications.filter(item => !item.read).length;
  app.innerHTML = `
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand"><h1>WorkBoard Pro</h1><span class="presence">Live</span></div>
        <button class="btn primary" id="newProject">+ Project</button>
        <div class="project-list">
          ${state.projects.map(item => `
            <button class="project-button ${item.id === state.activeProjectId ? "active" : ""}" data-project="${item.id}">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${item.taskCount} tasks / ${item.memberCount} members</span>
            </button>
          `).join("") || `<div class="empty-state">Create a group project to begin.</div>`}
        </div>
        <div class="sidebar-footer">
          <strong>${escapeHtml(state.user.name)}</strong>
          <span>${escapeHtml(state.user.email)}</span>
          <button class="btn secondary" id="logout">Sign out</button>
        </div>
      </aside>
      <section class="main">
        <header class="topbar">
          <div class="project-title">
            <h2>${project ? escapeHtml(project.name) : "No project selected"}</h2>
            <p>${project ? escapeHtml(project.description || "Group project board") : "Create a project to start assigning work."}</p>
          </div>
          <div class="toolbar">
            <button class="btn secondary notification-button" id="notifications">Notifications ${unread ? `<span class="badge">${unread}</span>` : ""}</button>
            ${project ? `<button class="btn secondary" id="inviteMember">+ Member</button><button class="btn primary" id="newTask">+ Task</button>` : ""}
          </div>
        </header>
        ${project ? renderProjectWorkspace() : `<section class="workspace"><div class="empty-state">No board is open yet.</div></section>`}
      </section>
      ${state.drawerOpen ? renderNotifications() : ""}
      ${state.modal ? renderModal() : ""}
    </main>
  `;
  bindShellEvents();
}

function renderProjectWorkspace() {
  return `
    <section class="control-band">
      ${renderTabs()}
      ${state.view === "board" ? renderFilters() : ""}
    </section>
    <section class="workspace">
      ${state.view === "board" ? renderBoard() : ""}
      ${state.view === "insights" ? renderInsights() : ""}
      ${state.view === "activity" ? renderActivity() : ""}
    </section>
  `;
}

function renderTabs() {
  return `
    <div class="tabs">
      ${["board", "insights", "activity"].map(view => `
        <button class="tab ${state.view === view ? "active" : ""}" data-view="${view}">${view[0].toUpperCase() + view.slice(1)}</button>
      `).join("")}
    </div>
  `;
}

function renderFilters() {
  const labels = allLabels();
  return `
    <div class="filters">
      <input id="filterSearch" placeholder="Search tasks, labels, sprint..." value="${escapeHtml(state.filters.search)}" />
      <select id="filterAssignee"><option value="all">All assignees</option>${state.activeProject.users.map(user => `<option value="${user.id}" ${state.filters.assignee === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("")}</select>
      <select id="filterPriority"><option value="all">All priorities</option>${PRIORITIES.map(priority => `<option ${state.filters.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}</select>
      <select id="filterLabel"><option value="all">All labels</option>${labels.map(label => `<option ${state.filters.label === label ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>
      <select id="filterRisk"><option value="all">All risk</option><option value="overdue" ${state.filters.risk === "overdue" ? "selected" : ""}>Overdue</option><option value="due-soon" ${state.filters.risk === "due-soon" ? "selected" : ""}>Due soon</option><option value="blocked" ${state.filters.risk === "blocked" ? "selected" : ""}>Blocked</option></select>
    </div>
  `;
}

function renderBoard() {
  const tasks = filteredTasks();
  return `
    <div class="board">
      ${STATUSES.map(status => {
        const columnTasks = tasks.filter(task => task.status === status);
        return `
          <section class="column">
            <div class="column-header"><h3>${status}</h3><span class="pill">${columnTasks.length}</span></div>
            <div class="task-list">${columnTasks.map(renderTaskCard).join("") || `<div class="empty-state">No matching tasks</div>`}</div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderTaskCard(task) {
  const comments = state.activeProject.comments.filter(comment => comment.taskId === task.id).length;
  const progress = checklistProgress(task);
  const risk = taskRisk(task);
  return `
    <button class="task-card ${risk}" data-task="${task.id}">
      <div class="meta-row">
        <span class="pill ${task.priority.toLowerCase()}">${task.priority}</span>
        ${risk !== "normal" ? `<span class="pill risk">${risk.replace("-", " ")}</span>` : ""}
        ${task.sprint ? `<span class="pill">${escapeHtml(task.sprint)}</span>` : ""}
      </div>
      <h4>${escapeHtml(task.title)}</h4>
      <p>${escapeHtml(task.description || "No description")}</p>
      ${(task.labels || []).length ? `<div class="label-row">${task.labels.map(label => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
      ${progress.total ? `<div class="progress"><span style="width:${progress.rate}%"></span></div>` : ""}
      <div class="meta-row">
        <span class="pill">${escapeHtml(userName(task.assigneeId))}</span>
        ${task.estimateHours ? `<span class="pill">${task.estimateHours}h</span>` : ""}
        ${task.dueDate ? `<span class="pill">${formatDate(task.dueDate)}</span>` : ""}
        <span class="pill">${comments} comments</span>
        ${(task.attachments || []).length ? `<span class="pill">${task.attachments.length} links</span>` : ""}
      </div>
    </button>
  `;
}

function renderInsights() {
  const analytics = state.activeProject.analytics;
  const workload = Object.entries(analytics.workload || {});
  return `
    <div class="insights">
      <div class="metric"><span>Completion</span><strong>${analytics.completionRate}%</strong><div class="progress"><span style="width:${analytics.completionRate}%"></span></div></div>
      <div class="metric"><span>Total tasks</span><strong>${analytics.totalTasks}</strong></div>
      <div class="metric danger"><span>Overdue</span><strong>${analytics.overdue}</strong></div>
      <div class="metric warning"><span>Due soon</span><strong>${analytics.dueSoon}</strong></div>
      <div class="metric danger"><span>Blocked</span><strong>${analytics.blocked}</strong></div>
      <div class="metric"><span>Checklist done</span><strong>${analytics.checklistRate}%</strong></div>
      <section class="analytics-panel">
        <h3>Status distribution</h3>
        ${STATUSES.map(status => renderBar(status, analytics.counts[status] || 0, analytics.totalTasks)).join("")}
      </section>
      <section class="analytics-panel">
        <h3>Priority mix</h3>
        ${PRIORITIES.map(priority => renderBar(priority, analytics.priorities[priority] || 0, analytics.totalTasks)).join("")}
      </section>
      <section class="analytics-panel wide">
        <h3>Team workload</h3>
        ${workload.map(([userId, data]) => renderBar(`${userName(userId)} (${data.estimateHours}h)`, data.taskCount, analytics.totalTasks)).join("") || `<div class="empty-state">No assigned tasks yet.</div>`}
      </section>
    </div>
  `;
}

function renderBar(label, value, total) {
  const width = total ? Math.round((value / total) * 100) : 0;
  return `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar"><i style="width:${width}%"></i></div><strong>${value}</strong></div>`;
}

function renderActivity() {
  return `
    <div class="activity-list">
      ${(state.activeProject.activities || []).map(activity => `
        <div class="activity-item">
          <strong>${escapeHtml(userName(activity.userId))}</strong>
          <span>${escapeHtml(activity.message)}</span>
          <small>${new Date(activity.createdAt).toLocaleString()}</small>
        </div>
      `).join("") || `<div class="empty-state">Project activity will appear here.</div>`}
    </div>
  `;
}

function renderNotifications() {
  return `
    <aside class="notification-drawer">
      ${state.notifications.map(item => `
        <button class="notification-item ${item.read ? "" : "unread"}" data-notification="${item.id}">
          <strong>${escapeHtml(item.message)}</strong><small>${new Date(item.createdAt).toLocaleString()}</small>
        </button>
      `).join("") || `<div class="notification-item"><strong>No notifications yet</strong><small>Updates will appear here.</small></div>`}
    </aside>
  `;
}

function renderModal() {
  if (state.modal.type === "project") return projectModal();
  if (state.modal.type === "invite") return inviteModal();
  if (state.modal.type === "task") return taskModal(state.modal.taskId);
  return "";
}

function projectModal() {
  return `
    <div class="overlay">
      <form class="modal form" id="projectForm">
        <div class="modal-header"><h2>New project</h2><button class="btn ghost" type="button" data-close>Close</button></div>
        <div class="modal-body">
          <div class="field"><label>Name</label><input name="name" required /></div>
          <div class="field"><label>Description</label><textarea name="description"></textarea></div>
          <div class="error" id="modalError"></div>
        </div>
        <div class="modal-footer"><button class="btn secondary" type="button" data-close>Cancel</button><button class="btn primary">Create project</button></div>
      </form>
    </div>
  `;
}

function inviteModal() {
  return `
    <div class="overlay">
      <form class="modal form" id="inviteForm">
        <div class="modal-header"><h2>Add member</h2><button class="btn ghost" type="button" data-close>Close</button></div>
        <div class="modal-body">
          <div class="field"><label>User email</label><input name="email" type="email" placeholder="taylor@example.com" required /></div>
          <div class="error" id="modalError"></div>
        </div>
        <div class="modal-footer"><button class="btn secondary" type="button" data-close>Cancel</button><button class="btn primary">Add member</button></div>
      </form>
    </div>
  `;
}

function taskModal(taskId) {
  const task = state.activeProject.tasks.find(item => item.id === taskId) || {
    title: "",
    description: "",
    status: "Backlog",
    priority: "Medium",
    assigneeId: "",
    dueDate: "",
    labels: [],
    checklist: [],
    attachments: [],
    estimateHours: 0,
    sprint: "",
    blockedReason: ""
  };
  const comments = state.activeProject.comments.filter(comment => comment.taskId === taskId);
  return `
    <div class="overlay">
      <div class="modal">
        <form class="form" id="taskForm">
          <div class="modal-header"><h2>${taskId ? "Task details" : "New task"}</h2><button class="btn ghost" type="button" data-close>Close</button></div>
          <div class="modal-body">
            <div class="field"><label>Title</label><input name="title" value="${escapeHtml(task.title)}" required /></div>
            <div class="field"><label>Description</label><textarea name="description">${escapeHtml(task.description)}</textarea></div>
            <div class="grid-2">
              <div class="field"><label>Status</label><select name="status">${STATUSES.map(status => `<option ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
              <div class="field"><label>Priority</label><select name="priority">${PRIORITIES.map(priority => `<option ${task.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}</select></div>
              <div class="field"><label>Assignee</label><select name="assigneeId"><option value="">Unassigned</option>${state.activeProject.users.map(user => `<option value="${user.id}" ${task.assigneeId === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("")}</select></div>
              <div class="field"><label>Due date</label><input name="dueDate" type="date" value="${escapeHtml(task.dueDate)}" /></div>
              <div class="field"><label>Estimate hours</label><input name="estimateHours" type="number" min="0" step="0.5" value="${escapeHtml(task.estimateHours)}" /></div>
              <div class="field"><label>Sprint</label><input name="sprint" value="${escapeHtml(task.sprint)}" placeholder="Sprint 2" /></div>
            </div>
            <div class="field"><label>Labels</label><input name="labels" value="${escapeHtml((task.labels || []).join(", "))}" placeholder="Frontend, QA, Risk" /></div>
            <div class="field"><label>Blocked reason</label><input name="blockedReason" value="${escapeHtml(task.blockedReason)}" /></div>
            <div class="field"><label>Checklist</label><textarea name="checklist">${escapeHtml((task.checklist || []).map(item => item.text).join("\n"))}</textarea></div>
            <div class="field"><label>Attachments</label><textarea name="attachments" placeholder="Name | https://example.com">${escapeHtml((task.attachments || []).map(item => `${item.name} | ${item.url}`).join("\n"))}</textarea></div>
            <div class="error" id="modalError"></div>
          </div>
          <div class="modal-footer"><button class="btn secondary" type="button" data-close>Cancel</button><button class="btn primary">${taskId ? "Save task" : "Create task"}</button></div>
        </form>
        ${taskId ? renderTaskCollaboration(task, comments) : ""}
      </div>
    </div>
  `;
}

function renderTaskCollaboration(task, comments) {
  return `
    <div class="modal-body">
      <h2>Execution</h2>
      <div class="checklist">
        ${(task.checklist || []).map(item => `
          <button class="check-item ${item.done ? "done" : ""}" data-check="${item.id}">
            <span>${item.done ? "✓" : ""}</span>${escapeHtml(item.text)}
          </button>
        `).join("") || `<div class="empty-state">No checklist items yet.</div>`}
      </div>
      ${(task.attachments || []).length ? `<div class="attachment-list">${task.attachments.map(item => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.name)}</a>`).join("")}</div>` : ""}
      <h2>Comments</h2>
      <div class="comments">${comments.map(comment => `<div class="comment"><strong>${escapeHtml(userName(comment.userId))}</strong><p>${escapeHtml(comment.body)}</p></div>`).join("") || `<div class="empty-state">No comments yet.</div>`}</div>
      <form class="form" id="commentForm">
        <div class="field"><label>Add comment</label><textarea name="body" required></textarea></div>
        <button class="btn secondary">Post comment</button>
      </form>
    </div>
  `;
}

function bindShellEvents() {
  document.querySelector("#newProject")?.addEventListener("click", () => openModal("project"));
  document.querySelector("#newTask")?.addEventListener("click", () => openModal("task"));
  document.querySelector("#inviteMember")?.addEventListener("click", () => openModal("invite"));
  document.querySelector("#logout")?.addEventListener("click", logout);
  document.querySelector("#notifications")?.addEventListener("click", () => {
    state.drawerOpen = !state.drawerOpen;
    render();
  });
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      localStorage.setItem("pmt_view", state.view);
      render();
    });
  });
  document.querySelectorAll("[data-project]").forEach(button => {
    button.addEventListener("click", async () => {
      await loadProject(button.dataset.project);
      render();
    });
  });
  document.querySelectorAll("[data-task]").forEach(button => button.addEventListener("click", () => openModal("task", button.dataset.task)));
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
  document.querySelectorAll("[data-notification]").forEach(button => {
    button.addEventListener("click", async () => {
      await api(`/api/notifications/${button.dataset.notification}/read`, { method: "PATCH" });
      state.notifications = state.notifications.map(item => item.id === button.dataset.notification ? { ...item, read: true } : item);
      render();
    });
  });
  document.querySelectorAll("[data-check]").forEach(button => {
    button.addEventListener("click", async () => {
      const data = await api(`/api/tasks/${state.modal.taskId}/checklist/${button.dataset.check}`, { method: "PATCH" });
      state.activeProject = data.project;
      render();
    });
  });
  bindFilter("#filterSearch", "input", value => state.filters.search = value);
  bindFilter("#filterAssignee", "change", value => state.filters.assignee = value);
  bindFilter("#filterPriority", "change", value => state.filters.priority = value);
  bindFilter("#filterLabel", "change", value => state.filters.label = value);
  bindFilter("#filterRisk", "change", value => state.filters.risk = value);
  document.querySelector("#projectForm")?.addEventListener("submit", handleProjectSubmit);
  document.querySelector("#inviteForm")?.addEventListener("submit", handleInviteSubmit);
  document.querySelector("#taskForm")?.addEventListener("submit", handleTaskSubmit);
  document.querySelector("#commentForm")?.addEventListener("submit", handleCommentSubmit);
}

function bindFilter(selector, eventName, setter) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.addEventListener(eventName, () => {
    setter(element.value);
    render();
  });
}

function openModal(type, taskId = "") {
  state.modal = { type, taskId };
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: form.get("name"), description: form.get("description") })
    });
    await refreshSidebar();
    await loadProject(data.project.id);
    closeModal();
  } catch (error) {
    document.querySelector("#modalError").textContent = error.message;
  }
}

async function handleInviteSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    state.activeProject = await api(`/api/projects/${state.activeProjectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: form.get("email") })
    });
    await refreshSidebar();
    closeModal();
  } catch (error) {
    document.querySelector("#modalError").textContent = error.message;
  }
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  const taskId = state.modal.taskId;
  try {
    const data = taskId
      ? await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await api(`/api/projects/${state.activeProjectId}/tasks`, { method: "POST", body: JSON.stringify(payload) });
    state.activeProject = data.project;
    await refreshSidebar();
    closeModal();
  } catch (error) {
    document.querySelector("#modalError").textContent = error.message;
  }
}

async function handleCommentSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api(`/api/tasks/${state.modal.taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: form.get("body") })
    });
    state.activeProject = data.project;
    render();
  } catch (error) {
    document.querySelector("#modalError").textContent = error.message;
  }
}

loadApp();
