/* ==========================================================================
   Yarrow-Mullein Bank — Training & Compliance Event Registration Portal
  Vanilla JS demo app. Set API_MODE to "mock" for local sample data; live
  API and Cognito endpoints are configurable from the Connection panel.
   ========================================================================== */

"use strict";

/* ---------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------ */

const API_MODE = "live"; // "mock" | "live"
const DEFAULT_API_BASE_URL =
  "https://ofv2g3zaeg.execute-api.us-east-1.amazonaws.com/dev";

/* ---------------------------------------------------------------------------
 * Cognito Hosted UI configuration (Authorization Code + PKCE, no client
 * secret). Fill these in with your own User Pool's Hosted UI domain, app
 * client ID, and the exact URL this app is hosted at.
 * See README.md for full setup instructions.
 * ------------------------------------------------------------------------ */

const DEFAULT_COGNITO_CONFIG = {
  domain: "https://us-east-17azivy6rv.auth.us-east-1.amazoncognito.com",
  clientId: "3rurcttf3m5cml5qd8b7oiib1c",
};

const STORAGE_KEYS = {
  events: "ymb_training_events",
  registrations: "ymb_event_registrations",
  seeded: "ymb_demo_seeded",
  connectionSettings: "ymb_training_connection_settings",
  // The live API only stores { eventId, title, status }. Everything else the
  // UI needs (description, delivery mode, capacity, etc.) is kept here,
  // keyed by eventId, and merged back in when events are loaded/created.
  eventMetadata: "ymb_event_metadata",
};

const savedConnectionSettings = loadFromStorage(
  STORAGE_KEYS.connectionSettings,
  {},
);
let API_BASE_URL = savedConnectionSettings?.apiBaseUrl || DEFAULT_API_BASE_URL;
const COGNITO_CONFIG = {
  domain:
    savedConnectionSettings?.cognitoDomain || DEFAULT_COGNITO_CONFIG.domain,
  clientId:
    savedConnectionSettings?.clientId || DEFAULT_COGNITO_CONFIG.clientId,
  redirectUri: window.location.origin + window.location.pathname,
  logoutRedirectUri: window.location.origin + window.location.pathname,
  scope: "openid email", // must match the checked "OpenID Connect scopes" on the app client
};

const DEPARTMENTS = [
  "Security Services",
  "Compliance",
  "IT Risk",
  "Application Development",
  "Service Desk",
  "Business Continuity",
  "Customer Experience",
  "Banking Operations",
];

/* ---------------------------------------------------------------------------
 * Mock data seed (used only on first run, then persisted to localStorage)
 * ------------------------------------------------------------------------ */

const SEED_EVENTS = [
  {
    eventId: "TRN2026-001",
    title: "Security Awareness Refresher",
    description: "Annual security awareness session for all employees.",
    eventType: "SECURITY_TRAINING",
    deliveryMode: "TEAMS",
    location: "Microsoft Teams",
    date: "2026-03-15",
    capacity: 50,
    ownerDepartment: "Security Services",
    dataClassification: "Internal",
    status: "PUBLISHED",
    createdAt: "2026-01-05T09:00:00.000Z",
    updatedAt: "2026-01-05T09:00:00.000Z",
  },
  {
    eventId: "TRN2026-002",
    title: "AML Compliance Update",
    description: "Mandatory anti-money laundering compliance briefing.",
    eventType: "COMPLIANCE",
    deliveryMode: "IN_PERSON",
    location: "Head Office - Room 4B",
    date: "2026-02-10",
    capacity: 30,
    ownerDepartment: "Compliance",
    dataClassification: "Confidential",
    status: "PUBLISHED",
    createdAt: "2026-01-06T09:00:00.000Z",
    updatedAt: "2026-01-06T09:00:00.000Z",
  },
  {
    eventId: "TRN2026-003",
    title: "Business Continuity Tabletop Exercise",
    description:
      "Simulated disaster recovery walkthrough for critical systems.",
    eventType: "BCP_DR",
    deliveryMode: "HYBRID",
    location: "Head Office - Boardroom / Teams",
    date: "2026-04-02",
    capacity: 20,
    ownerDepartment: "Business Continuity",
    dataClassification: "Confidential",
    status: "DRAFT",
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedAt: "2026-01-10T09:00:00.000Z",
  },
  {
    eventId: "TRN2026-004",
    title: "Secure Development Workshop",
    description: "Secure coding practices for internal application teams.",
    eventType: "IT_CHANGE",
    deliveryMode: "IN_PERSON",
    location: "Tech Campus - Lab 2",
    date: "2026-01-28",
    capacity: 25,
    ownerDepartment: "Application Development",
    dataClassification: "Internal",
    status: "CLOSED",
    createdAt: "2025-12-15T09:00:00.000Z",
    updatedAt: "2026-01-29T09:00:00.000Z",
  },
  {
    eventId: "TRN2026-005",
    title: "Customer Fraud Awareness Info Session",
    description: "Educating front-line staff on customer fraud red flags.",
    eventType: "CUSTOMER_EDUCATION",
    deliveryMode: "TEAMS",
    location: "Microsoft Teams",
    date: "2026-05-20",
    capacity: 40,
    ownerDepartment: "Customer Experience",
    dataClassification: "Internal",
    status: "PUBLISHED",
    createdAt: "2026-01-12T09:00:00.000Z",
    updatedAt: "2026-01-12T09:00:00.000Z",
  },
];

const SEED_REGISTRATIONS = [
  {
    eventId: "TRN2026-001",
    registrationId: "REG2026-0001",
    employeeId: "YMB10001",
    employeeName: "J. Doe",
    department: "IT Risk",
    registeredAt: "2026-01-20T10:00:00.000Z",
    registeredVia: "WebPortalSSO",
    status: "ACTIVE",
    attendanceConfirmed: false,
    completedAt: null,
    auditReferenceId: "AUD-0001",
  },
  {
    eventId: "TRN2026-001",
    registrationId: "REG2026-0002",
    employeeId: "YMB10002",
    employeeName: "A. Smith",
    department: "Security Services",
    registeredAt: "2026-01-21T10:00:00.000Z",
    registeredVia: "API",
    status: "ACTIVE",
    attendanceConfirmed: false,
    completedAt: null,
    auditReferenceId: "AUD-0002",
  },
  {
    eventId: "TRN2026-002",
    registrationId: "REG2026-0003",
    employeeId: "YMB10003",
    employeeName: "P. Nguyen",
    department: "Compliance",
    registeredAt: "2026-01-15T10:00:00.000Z",
    registeredVia: "Admin",
    status: "COMPLETED",
    attendanceConfirmed: true,
    completedAt: "2026-02-10T15:00:00.000Z",
    auditReferenceId: "AUD-0003",
  },
  {
    eventId: "TRN2026-002",
    registrationId: "REG2026-0004",
    employeeId: "YMB10004",
    employeeName: "R. Chalmers",
    department: "Banking Operations",
    registeredAt: "2026-01-16T10:00:00.000Z",
    registeredVia: "WebPortalSSO",
    status: "COMPLETED",
    attendanceConfirmed: true,
    completedAt: "2026-02-10T15:00:00.000Z",
    auditReferenceId: "AUD-0004",
  },
  {
    eventId: "TRN2026-004",
    registrationId: "REG2026-0005",
    employeeId: "YMB10005",
    employeeName: "K. Osei",
    department: "Application Development",
    registeredAt: "2025-12-20T10:00:00.000Z",
    registeredVia: "API",
    status: "COMPLETED",
    attendanceConfirmed: true,
    completedAt: "2026-01-28T16:00:00.000Z",
    auditReferenceId: "AUD-0005",
  },
  {
    eventId: "TRN2026-004",
    registrationId: "REG2026-0006",
    employeeId: "YMB10006",
    employeeName: "L. Fontaine",
    department: "Service Desk",
    registeredAt: "2025-12-21T10:00:00.000Z",
    registeredVia: "WebPortalSSO",
    status: "NO_SHOW",
    attendanceConfirmed: false,
    completedAt: null,
    auditReferenceId: "AUD-0006",
  },
  {
    eventId: "TRN2026-005",
    registrationId: "REG2026-0007",
    employeeId: "YMB10007",
    employeeName: "M. Ibrahim",
    department: "Customer Experience",
    registeredAt: "2026-01-25T10:00:00.000Z",
    registeredVia: "WebPortalSSO",
    status: "ACTIVE",
    attendanceConfirmed: false,
    completedAt: null,
    auditReferenceId: "AUD-0007",
  },
  {
    eventId: "TRN2026-003",
    registrationId: "REG2026-0008",
    employeeId: "YMB10008",
    employeeName: "T. Beauchamp",
    department: "Business Continuity",
    registeredAt: "2026-01-18T10:00:00.000Z",
    registeredVia: "Admin",
    status: "CANCELLED",
    attendanceConfirmed: false,
    completedAt: null,
    auditReferenceId: "AUD-0008",
  },
];

/* ---------------------------------------------------------------------------
 * Local storage helpers
 * ------------------------------------------------------------------------ */

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error("Failed to read from localStorage", key, err);
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function seedDemoDataIfNeeded() {
  if (!localStorage.getItem(STORAGE_KEYS.seeded)) {
    saveToStorage(STORAGE_KEYS.events, SEED_EVENTS);
    saveToStorage(STORAGE_KEYS.registrations, SEED_REGISTRATIONS);
    localStorage.setItem(STORAGE_KEYS.seeded, "true");
  }
}

function resetDemoData() {
  saveToStorage(STORAGE_KEYS.events, SEED_EVENTS);
  saveToStorage(STORAGE_KEYS.registrations, SEED_REGISTRATIONS);
  saveToStorage(STORAGE_KEYS.eventMetadata, {});
}

/* ---------------------------------------------------------------------------
 * Cognito authentication (Hosted UI, Authorization Code + PKCE)
 * Public SPA clients cannot safely hold a client secret, so the app client
 * used here must be configured without one (see README.md). Tokens are kept
 * in sessionStorage only (cleared when the tab closes) instead of
 * localStorage, to reduce exposure if this device is shared.
 * ------------------------------------------------------------------------ */

const AUTH_STORAGE_KEYS = {
  idToken: "ymb_auth_id_token",
  accessToken: "ymb_auth_access_token",
  email: "ymb_auth_email",
  pkceVerifier: "ymb_auth_pkce_verifier",
};

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier) {
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalized));
  } catch (err) {
    console.error("Failed to decode JWT payload", err);
    return null;
  }
}

function getStoredIdToken() {
  return sessionStorage.getItem(AUTH_STORAGE_KEYS.idToken);
}

function isSignedIn() {
  return Boolean(getStoredIdToken());
}

async function signIn() {
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(AUTH_STORAGE_KEYS.pkceVerifier, verifier);
  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    response_type: "code",
    scope: COGNITO_CONFIG.scope,
    redirect_uri: COGNITO_CONFIG.redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.assign(`${COGNITO_CONFIG.domain}/oauth2/authorize?${params}`);
}

function signOut() {
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.idToken);
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.email);

  const params = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    logout_uri: COGNITO_CONFIG.logoutRedirectUri,
  });
  window.location.assign(`${COGNITO_CONFIG.domain}/logout?${params}`);
}

// Exchanges the ?code=... from the Hosted UI redirect for tokens, then
// strips it from the URL so a page refresh doesn't try to reuse it.
async function handleAuthRedirectCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    console.error(
      "Cognito redirected with an error:",
      error,
      url.searchParams.get("error_description"),
    );
    showStatusMessage(
      `Sign-in error from Cognito: ${url.searchParams.get("error_description") || error}`,
      "error",
    );
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, document.title, url.toString());
    return;
  }

  if (!code) return;

  const verifier = sessionStorage.getItem(AUTH_STORAGE_KEYS.pkceVerifier);
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.pkceVerifier);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CONFIG.clientId,
    code,
    redirect_uri: COGNITO_CONFIG.redirectUri,
    code_verifier: verifier || "",
  });

  try {
    const response = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok)
      throw new Error(`Token exchange failed (${response.status})`);
    const tokens = await response.json();

    sessionStorage.setItem(AUTH_STORAGE_KEYS.idToken, tokens.id_token);
    sessionStorage.setItem(AUTH_STORAGE_KEYS.accessToken, tokens.access_token);
    const claims = decodeJwtPayload(tokens.id_token);
    if (claims?.email) {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.email, claims.email);
    }
  } catch (err) {
    console.error("Cognito token exchange failed", err);
    showStatusMessage("Sign-in failed. Please try again.", "error");
  } finally {
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.toString());
  }
}

function renderAuthUi() {
  const signedIn = isSignedIn();
  document.getElementById("auth-signin-btn").hidden = signedIn;
  document.getElementById("auth-signout-btn").hidden = !signedIn;
  const emailEl = document.getElementById("auth-user-email");
  const email = sessionStorage.getItem(AUTH_STORAGE_KEYS.email);
  emailEl.textContent = email || "";
  emailEl.hidden = !signedIn || !email;
}

function initAuthUi() {
  document.getElementById("auth-signin-btn").addEventListener("click", signIn);
  document
    .getElementById("auth-signout-btn")
    .addEventListener("click", signOut);
}

function normalizeConnectionUrl(value, label, allowPath) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Enter a valid ${label} URL.`);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${label} must use HTTPS and cannot contain credentials, a query, or a fragment.`,
    );
  }

  const path = url.pathname.replace(/\/+$/, "");
  if (!allowPath && path) {
    throw new Error(`${label} must be the domain root, without a path.`);
  }
  return `${url.origin}${allowPath ? path : ""}`;
}

function initConnectionSettings() {
  const form = document.getElementById("connection-settings-form");
  const apiUrlInput = document.getElementById("connection-api-url");
  const cognitoDomainInput = document.getElementById(
    "connection-cognito-domain",
  );
  const clientIdInput = document.getElementById("connection-client-id");
  const status = document.getElementById("connection-settings-status");

  apiUrlInput.value = API_BASE_URL;
  cognitoDomainInput.value = COGNITO_CONFIG.domain;
  clientIdInput.value = COGNITO_CONFIG.clientId;

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    try {
      const settings = {
        apiBaseUrl: normalizeConnectionUrl(
          apiUrlInput.value.trim(),
          "API base URL",
          true,
        ),
        cognitoDomain: normalizeConnectionUrl(
          cognitoDomainInput.value.trim(),
          "Cognito domain",
          false,
        ),
        clientId: clientIdInput.value.trim(),
      };
      if (!settings.clientId) {
        throw new Error("Enter the Cognito public app client ID.");
      }

      saveToStorage(STORAGE_KEYS.connectionSettings, settings);
      API_BASE_URL = settings.apiBaseUrl;
      COGNITO_CONFIG.domain = settings.cognitoDomain;
      COGNITO_CONFIG.clientId = settings.clientId;
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.idToken);
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.email);
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.pkceVerifier);
      renderAuthUi();

      state.events = API_MODE === "mock" ? await apiService.getEvents() : [];
      renderRoute(state.currentRoute);
      renderDashboard();
      status.textContent =
        "Settings saved in this browser. Sign in again to load live events.";
      showStatusMessage("Connection settings saved.", "success");
    } catch (err) {
      showStatusMessage(
        err.message || "Could not save connection settings.",
        "error",
      );
    }
  });
}

/* ---------------------------------------------------------------------------
 * Event metadata cache (live mode only)
 * The live training-event API only persists { eventId, title, status }. The
 * richer fields below are stored client-side, keyed by eventId, so events
 * created through this app keep their full details across reloads.
 * ------------------------------------------------------------------------ */

function loadEventMetadata() {
  return loadFromStorage(STORAGE_KEYS.eventMetadata, {});
}

function saveEventMetadata(eventId, meta) {
  const all = loadEventMetadata();
  all[eventId] = { ...all[eventId], ...meta };
  saveToStorage(STORAGE_KEYS.eventMetadata, all);
}

function normalizeEvent(apiEvent) {
  const meta = loadEventMetadata()[apiEvent.eventId] || {};
  return {
    eventId: apiEvent.eventId,
    title: apiEvent.title,
    status: apiEvent.status,
    description: meta.description || "No additional details available.",
    eventType: meta.eventType || "GENERAL",
    deliveryMode: meta.deliveryMode || "UNSPECIFIED",
    location: meta.location || "TBD",
    date: meta.date || "",
    capacity: meta.capacity ?? null,
    ownerDepartment: meta.ownerDepartment || "",
    dataClassification: meta.dataClassification || "",
    createdAt: meta.createdAt || null,
    updatedAt: meta.updatedAt || null,
  };
}

function nextLiveEventId(existingEvents) {
  const maxNumber = existingEvents.reduce((max, event) => {
    const match = /^TRN(\d+)$/.exec(event.eventId || "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `TRN${String(maxNumber + 1).padStart(3, "0")}`;
}

// API Gateway's Cognito User Pool authorizer expects the ID token (not the
// access token) in the Authorization header.
function authHeaders() {
  const idToken = getStoredIdToken();
  return idToken ? { Authorization: idToken } : {};
}

/* ---------------------------------------------------------------------------
 * API service layer
 * In mock mode every method reads/writes localStorage synchronously but
 * still returns a Promise. Live mode uses the saved API base URL.
 * ------------------------------------------------------------------------ */

const apiService = {
  async getHealth() {
    if (API_MODE === "mock") {
      return {
        status: "ok",
        service: "ymb-training-event-api",
        version: "1.0",
        environment: "demo",
      };
    }
    // The deployed API has no /health route; use a lightweight GET /events
    // as a reachability probe instead.
    try {
      const response = await fetch(`${API_BASE_URL}/events`);
      return {
        status: response.ok ? "ok" : "degraded",
        service: "ymb-training-event-api",
        version: "1.0",
        environment: "dev",
      };
    } catch (err) {
      return {
        status: "unreachable",
        service: "ymb-training-event-api",
        version: "1.0",
        environment: "dev",
      };
    }
  },

  async getEvents() {
    if (API_MODE === "mock") {
      return loadFromStorage(STORAGE_KEYS.events, []);
    }
    const response = await fetch(`${API_BASE_URL}/events`, {
      headers: authHeaders(),
    });
    if (!response.ok)
      throw new Error(`GET /events failed (${response.status})`);
    const data = await response.json();
    return (data.events || []).map(normalizeEvent);
  },

  async createEvent(eventData) {
    if (API_MODE === "mock") {
      const events = loadFromStorage(STORAGE_KEYS.events, []);
      const nextNumber = events.length + 1;
      const newEvent = {
        ...eventData,
        eventId: `TRN2026-${String(nextNumber).padStart(3, "0")}`,
        status: "PUBLISHED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      events.push(newEvent);
      saveToStorage(STORAGE_KEYS.events, events);
      return newEvent;
    }
    // The live API only accepts/persists { eventId, title, status }; we
    // generate the eventId client-side and stash the rest in local metadata.
    const existingEvents = await apiService.getEvents();
    const eventId = nextLiveEventId(existingEvents);
    const status = "PUBLISHED";
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ eventId, title: eventData.title, status }),
    });
    if (!response.ok)
      throw new Error(`POST /events failed (${response.status})`);

    const now = new Date().toISOString();
    saveEventMetadata(eventId, {
      ...eventData,
      createdAt: now,
      updatedAt: now,
    });
    return normalizeEvent({ eventId, title: eventData.title, status });
  },

  async getEventById(eventId) {
    if (API_MODE === "mock") {
      const events = loadFromStorage(STORAGE_KEYS.events, []);
      return events.find((event) => event.eventId === eventId) || null;
    }
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) return null;
    return normalizeEvent(await response.json());
  },

  // NOTE: the deployed training-event API has no registration endpoints at
  // all (only /events and /events/{eventId}). Registrations are always
  // handled locally via localStorage, regardless of API_MODE.
  async getRegistrations(eventId) {
    const registrations = loadFromStorage(STORAGE_KEYS.registrations, []);
    return eventId
      ? registrations.filter((reg) => reg.eventId === eventId)
      : registrations;
  },

  async createRegistration(eventId, registrationData) {
    const registrations = loadFromStorage(STORAGE_KEYS.registrations, []);
    const nextNumber = registrations.length + 1;
    const newRegistration = {
      ...registrationData,
      eventId,
      registrationId: `REG2026-${String(nextNumber).padStart(4, "0")}`,
      registeredAt: new Date().toISOString(),
      status: "ACTIVE",
      attendanceConfirmed: false,
      completedAt: null,
      auditReferenceId: `AUD-${String(nextNumber).padStart(4, "0")}`,
    };
    registrations.push(newRegistration);
    saveToStorage(STORAGE_KEYS.registrations, registrations);
    return newRegistration;
  },

  async updateRegistration(eventId, registrationId, updateData) {
    const registrations = loadFromStorage(STORAGE_KEYS.registrations, []);
    const index = registrations.findIndex(
      (reg) => reg.eventId === eventId && reg.registrationId === registrationId,
    );
    if (index === -1) return null;
    registrations[index] = { ...registrations[index], ...updateData };
    saveToStorage(STORAGE_KEYS.registrations, registrations);
    return registrations[index];
  },

  async cancelRegistration(eventId, registrationId) {
    return apiService.updateRegistration(eventId, registrationId, {
      status: "CANCELLED",
    });
  },
};

/* ---------------------------------------------------------------------------
 * App state
 * ------------------------------------------------------------------------ */

const state = {
  events: [],
  registrations: [],
  currentRoute: "dashboard",
};

/* ---------------------------------------------------------------------------
 * Status messages (aria-live region)
 * ------------------------------------------------------------------------ */

function showStatusMessage(message, type) {
  const region = document.getElementById("status-region");
  region.innerHTML = "";
  const el = document.createElement("p");
  el.className = `status-message status-message--${type}`;
  el.textContent = message;
  region.appendChild(el);
  window.setTimeout(() => {
    if (region.contains(el)) region.removeChild(el);
  }, 6000);
}

/* ---------------------------------------------------------------------------
 * Navigation / routing
 * ------------------------------------------------------------------------ */

function initNavigation() {
  const navLinks = document.querySelectorAll(".app-nav__link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => navigateTo(link.dataset.route));
  });
}

function navigateTo(route) {
  state.currentRoute = route;

  document.querySelectorAll(".route").forEach((section) => {
    section.hidden = section.dataset.routeSection !== route;
  });

  document.querySelectorAll(".app-nav__link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.route === route);
  });

  const activeSection = document.querySelector(
    `[data-route-section="${route}"] h1`,
  );
  if (activeSection) activeSection.focus?.();

  renderRoute(route);
}

function renderRoute(route) {
  switch (route) {
    case "dashboard":
      renderDashboard();
      break;
    case "events":
      renderEventsTable();
      break;
    case "create-event":
      break;
    case "register":
      populateRegisterEventOptions();
      break;
    case "registrations":
      populateRegistrationFilters();
      renderRegistrationsTable();
      break;
    case "reports":
      renderReports();
      break;
    default:
      break;
  }
}

/* ---------------------------------------------------------------------------
 * Formatting helpers
 * ------------------------------------------------------------------------ */

function formatStatusLabel(status) {
  return status
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());
}

function statusPillHtml(status) {
  return `<span class="status-pill status-pill--${status.toLowerCase()}">${formatStatusLabel(status)}</span>`;
}

function countRegistrationsForEvent(eventId) {
  return state.registrations.filter(
    (reg) => reg.eventId === eventId && reg.status !== "CANCELLED",
  ).length;
}

/* ---------------------------------------------------------------------------
 * Dashboard
 * ------------------------------------------------------------------------ */

function renderDashboard() {
  const totalEvents = state.events.length;
  const openRegistrations = state.registrations.filter(
    (reg) => reg.status === "ACTIVE",
  ).length;
  const completedSessions = state.registrations.filter(
    (reg) => reg.status === "COMPLETED",
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  const upcomingCompliance = state.events.filter(
    (event) =>
      event.eventType === "COMPLIANCE" &&
      event.date >= today &&
      event.status === "PUBLISHED",
  ).length;

  document.getElementById("stat-total-events").textContent = totalEvents;
  document.getElementById("stat-open-registrations").textContent =
    openRegistrations;
  document.getElementById("stat-completed-sessions").textContent =
    completedSessions;
  document.getElementById("stat-upcoming-compliance").textContent =
    upcomingCompliance;

  const upcomingList = document.getElementById("upcoming-events-list");
  const upcomingEvents = state.events
    .filter((event) => event.date >= today && event.status === "PUBLISHED")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  upcomingList.innerHTML = upcomingEvents.length
    ? upcomingEvents
        .map(
          (event) =>
            `<li><strong>${event.title}</strong> &mdash; ${event.date} (${formatStatusLabel(event.eventType)})</li>`,
        )
        .join("")
    : "<li>No upcoming published events.</li>";

  const activityList = document.getElementById("recent-activity-list");
  const recentActivity = [...state.registrations]
    .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
    .slice(0, 5);

  activityList.innerHTML = recentActivity.length
    ? recentActivity
        .map(
          (reg) =>
            `<li>${reg.employeeName} registered for ${reg.eventId} ${statusPillHtml(reg.status)}</li>`,
        )
        .join("")
    : "<li>No registration activity yet.</li>";
}

/* ---------------------------------------------------------------------------
 * Training Events route
 * ------------------------------------------------------------------------ */

function initEventsFilters() {
  const form = document.getElementById("events-filter-form");
  form.addEventListener("input", renderEventsTable);
}

function renderEventsTable() {
  const eventType = document.getElementById("filter-event-type").value;
  const status = document.getElementById("filter-event-status").value;
  const search = document
    .getElementById("filter-event-search")
    .value.trim()
    .toLowerCase();

  const filtered = state.events.filter((event) => {
    if (eventType && event.eventType !== eventType) return false;
    if (status && event.status !== status) return false;
    if (search && !event.title.toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody = document.getElementById("events-table-body");
  const emptyState = document.getElementById("events-empty-state");

  tbody.innerHTML = filtered
    .map((event) => {
      const registeredCount = countRegistrationsForEvent(event.eventId);
      return `
        <tr>
          <td>${event.eventId}</td>
          <td>${event.title}</td>
          <td>${formatStatusLabel(event.eventType)}</td>
          <td>${formatStatusLabel(event.deliveryMode)}</td>
          <td>${event.date}</td>
          <td>${event.capacity}</td>
          <td>${registeredCount}</td>
          <td>${statusPillHtml(event.status)}</td>
          <td class="row-actions">
            <button type="button" class="button button--secondary button--small" data-view-event="${event.eventId}">View</button>
            <button type="button" class="button button--primary button--small" data-register-for-event="${event.eventId}">Register</button>
          </td>
        </tr>`;
    })
    .join("");

  emptyState.hidden = filtered.length !== 0;

  tbody.querySelectorAll("[data-view-event]").forEach((btn) => {
    btn.addEventListener("click", () =>
      showEventDetails(btn.dataset.viewEvent),
    );
  });
  tbody.querySelectorAll("[data-register-for-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateTo("register");
      document.getElementById("register-event").value =
        btn.dataset.registerForEvent;
    });
  });
}

function showEventDetails(eventId) {
  const event = state.events.find((e) => e.eventId === eventId);
  if (!event) return;
  window.alert(
    `${event.title}\n\n${event.description}\n\nType: ${formatStatusLabel(event.eventType)}\nDelivery: ${formatStatusLabel(
      event.deliveryMode,
    )}\nLocation: ${event.location}\nDate: ${event.date}\nCapacity: ${event.capacity}\nOwner department: ${event.ownerDepartment}\nClassification: ${event.dataClassification}\nStatus: ${formatStatusLabel(event.status)}`,
  );
}

/* ---------------------------------------------------------------------------
 * Create Event form
 * ------------------------------------------------------------------------ */

function initCreateEventForm() {
  const form = document.getElementById("create-event-form");
  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    clearFormErrors(form);

    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const errors = validateEventForm(values);

    if (Object.keys(errors).length > 0) {
      applyFormErrors(form, errors);
      return;
    }

    const newEvent = await apiService.createEvent({
      title: values.title.trim(),
      description: values.description.trim(),
      eventType: values.eventType,
      deliveryMode: values.deliveryMode,
      location: values.location.trim(),
      date: values.date,
      capacity: Number(values.capacity),
      ownerDepartment: values.ownerDepartment,
      dataClassification: values.dataClassification,
    });

    state.events = await apiService.getEvents();
    showStatusMessage(
      `Training event "${newEvent.title}" created (${newEvent.eventId}).`,
      "success",
    );
    form.reset();
    renderDashboard();
  });
}

function validateEventForm(values) {
  const errors = {};
  if (!values.title || !values.title.trim())
    errors.title = "Title is required.";
  if (!values.description || !values.description.trim())
    errors.description = "Description is required.";
  if (!values.eventType) errors.eventType = "Event type is required.";
  if (!values.deliveryMode) errors.deliveryMode = "Delivery mode is required.";
  if (!values.location || !values.location.trim())
    errors.location = "Location is required.";
  if (!values.date) errors.date = "Date is required.";
  if (
    !values.capacity ||
    Number(values.capacity) <= 0 ||
    !Number.isInteger(Number(values.capacity))
  ) {
    errors.capacity = "Capacity must be a positive whole number.";
  }
  if (!values.ownerDepartment)
    errors.ownerDepartment = "Owner department is required.";
  if (!values.dataClassification)
    errors.dataClassification = "Data classification is required.";
  return errors;
}

function clearFormErrors(form) {
  form.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  form
    .querySelectorAll("[aria-invalid]")
    .forEach((el) => el.removeAttribute("aria-invalid"));
}

function applyFormErrors(form, errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = form.elements[field];
    const errorEl = document.getElementById(`${input.id}-error`);
    if (errorEl) errorEl.textContent = message;
    input.setAttribute("aria-invalid", "true");
  });
  const firstField = Object.keys(errors)[0];
  if (firstField) form.elements[firstField].focus();
}

/* ---------------------------------------------------------------------------
 * Register Employee form
 * ------------------------------------------------------------------------ */

function populateRegisterEventOptions() {
  const select = document.getElementById("register-event");
  const currentValue = select.value;
  select.innerHTML =
    '<option value="">Select an event</option>' +
    state.events
      .map(
        (event) =>
          `<option value="${event.eventId}">${event.eventId} — ${event.title}</option>`,
      )
      .join("");
  if (currentValue) select.value = currentValue;
}

function initRegisterForm() {
  const form = document.getElementById("register-form");
  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    clearFormErrors(form);

    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const errors = validateRegistrationForm(values);

    if (Object.keys(errors).length > 0) {
      applyFormErrors(form, errors);
      return;
    }

    const event = state.events.find((e) => e.eventId === values.eventId);
    const registeredCount = countRegistrationsForEvent(values.eventId);

    if (event.status === "CLOSED" || event.status === "CANCELLED") {
      showStatusMessage(
        `Cannot register: "${event.title}" is ${formatStatusLabel(event.status).toLowerCase()}.`,
        "error",
      );
      return;
    }
    if (event.capacity != null && registeredCount >= event.capacity) {
      showStatusMessage(
        `Cannot register: "${event.title}" has reached capacity.`,
        "error",
      );
      return;
    }

    const newRegistration = await apiService.createRegistration(
      values.eventId,
      {
        employeeId: values.employeeId.trim(),
        employeeName: values.employeeName.trim(),
        department: values.department,
        registeredVia: values.registeredVia,
      },
    );

    state.registrations = await apiService.getRegistrations();
    showStatusMessage(
      `Registration confirmed: ${newRegistration.registrationId} for ${newRegistration.employeeName}.`,
      "success",
    );
    form.reset();
    renderDashboard();
  });
}

function validateRegistrationForm(values) {
  const errors = {};
  if (!values.eventId) errors.eventId = "Please select a training event.";
  if (!values.employeeId || !values.employeeId.trim())
    errors.employeeId = "Employee ID is required.";
  if (!values.employeeName || !values.employeeName.trim())
    errors.employeeName = "Employee name is required.";
  if (!values.department) errors.department = "Department is required.";
  if (!values.registeredVia)
    errors.registeredVia = "Registration channel is required.";
  return errors;
}

/* ---------------------------------------------------------------------------
 * Registrations route
 * ------------------------------------------------------------------------ */

function populateRegistrationFilters() {
  const eventSelect = document.getElementById("filter-reg-event");
  const currentEventValue = eventSelect.value;
  eventSelect.innerHTML =
    '<option value="">All events</option>' +
    state.events
      .map(
        (event) => `<option value="${event.eventId}">${event.eventId}</option>`,
      )
      .join("");
  if (currentEventValue) eventSelect.value = currentEventValue;

  const deptSelect = document.getElementById("filter-reg-department");
  const currentDeptValue = deptSelect.value;
  deptSelect.innerHTML =
    '<option value="">All departments</option>' +
    DEPARTMENTS.map((dept) => `<option value="${dept}">${dept}</option>`).join(
      "",
    );
  if (currentDeptValue) deptSelect.value = currentDeptValue;
}

function initRegistrationsFilters() {
  const form = document.getElementById("registrations-filter-form");
  form.addEventListener("input", renderRegistrationsTable);
  form.addEventListener("change", renderRegistrationsTable);
}

function renderRegistrationsTable() {
  const eventId = document.getElementById("filter-reg-event").value;
  const department = document.getElementById("filter-reg-department").value;
  const status = document.getElementById("filter-reg-status").value;

  const filtered = state.registrations.filter((reg) => {
    if (eventId && reg.eventId !== eventId) return false;
    if (department && reg.department !== department) return false;
    if (status && reg.status !== status) return false;
    return true;
  });

  const tbody = document.getElementById("registrations-table-body");
  const emptyState = document.getElementById("registrations-empty-state");

  tbody.innerHTML = filtered
    .map(
      (reg) => `
        <tr>
          <td>${reg.registrationId}</td>
          <td>${reg.eventId}</td>
          <td>${reg.employeeId}</td>
          <td>${reg.employeeName}</td>
          <td>${reg.department}</td>
          <td>${statusPillHtml(reg.status)}</td>
          <td>${reg.attendanceConfirmed ? "Yes" : "No"}</td>
          <td class="row-actions">
            <button type="button" class="button button--secondary button--small" data-mark-completed="${reg.eventId}|${reg.registrationId}" ${reg.status !== "ACTIVE" ? "disabled" : ""}>Mark completed</button>
            <button type="button" class="button button--secondary button--small" data-mark-no-show="${reg.eventId}|${reg.registrationId}" ${reg.status !== "ACTIVE" ? "disabled" : ""}>Mark no-show</button>
            <button type="button" class="button button--danger button--small" data-cancel-registration="${reg.eventId}|${reg.registrationId}" ${reg.status !== "ACTIVE" ? "disabled" : ""}>Cancel</button>
          </td>
        </tr>`,
    )
    .join("");

  emptyState.hidden = filtered.length !== 0;

  tbody.querySelectorAll("[data-mark-completed]").forEach((btn) => {
    btn.addEventListener("click", () =>
      handleRegistrationStatusChange(btn.dataset.markCompleted, "COMPLETED"),
    );
  });
  tbody.querySelectorAll("[data-mark-no-show]").forEach((btn) => {
    btn.addEventListener("click", () =>
      handleRegistrationStatusChange(btn.dataset.markNoShow, "NO_SHOW"),
    );
  });
  tbody.querySelectorAll("[data-cancel-registration]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [eventId, registrationId] =
        btn.dataset.cancelRegistration.split("|");
      confirmAction(`Cancel registration ${registrationId}?`, async () => {
        await apiService.cancelRegistration(eventId, registrationId);
        state.registrations = await apiService.getRegistrations();
        renderRegistrationsTable();
        renderDashboard();
        showStatusMessage(
          `Registration ${registrationId} cancelled.`,
          "success",
        );
      });
    });
  });
}

async function handleRegistrationStatusChange(key, status) {
  const [eventId, registrationId] = key.split("|");
  const updateData =
    status === "COMPLETED"
      ? {
          status: "COMPLETED",
          attendanceConfirmed: true,
          completedAt: new Date().toISOString(),
        }
      : { status: "NO_SHOW", attendanceConfirmed: false };
  await apiService.updateRegistration(eventId, registrationId, updateData);
  state.registrations = await apiService.getRegistrations();
  renderRegistrationsTable();
  renderDashboard();
  showStatusMessage(
    `Registration ${registrationId} updated to ${formatStatusLabel(status)}.`,
    "success",
  );
}

/* ---------------------------------------------------------------------------
 * Reports route
 * ------------------------------------------------------------------------ */

function renderReports() {
  const completionContainer = document.getElementById("completion-rate-bars");
  completionContainer.innerHTML = state.events
    .map((event) => {
      const registrationsForEvent = state.registrations.filter(
        (reg) => reg.eventId === event.eventId,
      );
      const completed = registrationsForEvent.filter(
        (reg) => reg.status === "COMPLETED",
      ).length;
      const total = registrationsForEvent.length || 1;
      const percent = Math.round((completed / total) * 100);
      return progressBarHtml(`${event.eventId} — ${event.title}`, percent);
    })
    .join("");

  const deptContainer = document.getElementById("department-bars");
  const maxCount = Math.max(
    1,
    ...DEPARTMENTS.map(
      (dept) => state.registrations.filter((r) => r.department === dept).length,
    ),
  );
  deptContainer.innerHTML = DEPARTMENTS.map((dept) => {
    const count = state.registrations.filter(
      (r) => r.department === dept,
    ).length;
    const percent = Math.round((count / maxCount) * 100);
    return progressBarHtml(`${dept} (${count})`, percent);
  }).join("");
}

function progressBarHtml(label, percent) {
  return `
    <div class="progress-item">
      <div class="progress-item__label"><span>${label}</span><span>${percent}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    </div>`;
}

function initReportsActions() {
  document.getElementById("export-data-btn").addEventListener("click", () => {
    const payload = {
      events: state.events,
      registrations: state.registrations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ymb-demo-data.json";
    link.click();
    URL.revokeObjectURL(url);
    showStatusMessage("Demo data exported as JSON.", "success");
  });

  document.getElementById("reset-data-btn").addEventListener("click", () => {
    confirmAction(
      "Reset all demo data to its original seed values? This cannot be undone.",
      async () => {
        resetDemoData();
        state.events = await apiService.getEvents();
        state.registrations = await apiService.getRegistrations();
        renderRoute(state.currentRoute);
        renderDashboard();
        showStatusMessage("Demo data has been reset.", "success");
      },
    );
  });
}

/* ---------------------------------------------------------------------------
 * Confirmation dialog
 * ------------------------------------------------------------------------ */

let pendingConfirmAction = null;

function confirmAction(message, onConfirm) {
  pendingConfirmAction = onConfirm;
  document.getElementById("confirm-dialog-message").textContent = message;
  const overlay = document.getElementById("confirm-dialog");
  overlay.hidden = false;
  document.getElementById("confirm-dialog-confirm").focus();
}

function closeConfirmDialog() {
  document.getElementById("confirm-dialog").hidden = true;
  pendingConfirmAction = null;
}

function initConfirmDialog() {
  document
    .getElementById("confirm-dialog-confirm")
    .addEventListener("click", async () => {
      const action = pendingConfirmAction;
      closeConfirmDialog();
      if (action) await action();
    });
  document
    .getElementById("confirm-dialog-cancel")
    .addEventListener("click", closeConfirmDialog);
  document
    .getElementById("confirm-dialog")
    .addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") closeConfirmDialog();
    });
}

/* ---------------------------------------------------------------------------
 * App bootstrap
 * ------------------------------------------------------------------------ */

async function init() {
  seedDemoDataIfNeeded();
  initConnectionSettings();
  await handleAuthRedirectCallback();

  initNavigation();
  initEventsFilters();
  initCreateEventForm();
  initRegisterForm();
  initRegistrationsFilters();
  initReportsActions();
  initConfirmDialog();
  initAuthUi();
  renderAuthUi();

  try {
    state.events = await apiService.getEvents();
  } catch (err) {
    console.error("Failed to load training events", err);
    state.events = [];
    showStatusMessage(
      "Could not reach the training event API. Check API availability and CORS configuration.",
      "error",
    );
  }
  state.registrations = await apiService.getRegistrations();

  renderDashboard();
  navigateTo("dashboard");
}

document.addEventListener("DOMContentLoaded", init);
