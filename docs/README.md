# Yarrow-Mullein Bank Training & Compliance Event Registration Portal

A finished frontend demo client for **COMP-3020**. Use it to demonstrate the browser side of Cognito sign-in and a protected training-event API; students do not need to build this frontend.

This same client is used twice in the course:

- **Module 2B Tutorial 4** — clone the public course repository containing this `web/` folder, publish it with **GitHub Pages**, and connect it to a Cognito User Pool you create yourself, to test the Managed Login authentication flow end to end.

The checked-in `app.js` uses the live training-event API. Use the **Connection** panel on the page to enter the API base URL, Cognito domain, and public app client ID. These settings are saved in this browser's `localStorage`; Cognito tokens remain in `sessionStorage`. Registrations are always stored locally and are not sent to the API.

---

## Project overview

This portal simulates an internal Yarrow-Mullein Bank system for managing training, compliance, and security awareness events:

- **Dashboard** — summary stats, upcoming events, recent registration activity, demo API health indicator.
- **Training Events** — searchable/filterable list of events.
- **Create Event** — form to add a new training event.
- **Register Employee** — form to register an employee for an event (capacity and status checks included).
- **Registrations** — filterable table with actions to mark completed, mark no-show, or cancel a registration.
- **Reports** — completion rate and registrations-by-department progress bars, plus export/reset demo data.

Built with plain **HTML5, CSS3, and vanilla JavaScript (ES6+)** — no framework, no build step, no external dependencies.

## Lecture demonstration: preparing for Assignment 3

Use this portal as a worked example of authentication flow and client-to-API integration. It is a separate training-event application, not the customer service-request API students will design for Assignment 3. Keep the demo's business data and API behavior distinct; the goal is to transfer security reasoning, not copy an implementation.

### Suggested demonstration sequence

1. **Trace the architecture.** Start at the browser, follow the sign-in redirect to Cognito, then return to the page and follow an event request to API Gateway and the training-event API. Point out that registrations are not sent to that API.
2. **Show the public-client sign-in flow.** In `app.js`, locate `COGNITO_CONFIG`, the PKCE verifier/challenge, the authorization-code callback, and token storage in `sessionStorage`. Explain why a browser app uses a public client without a client secret.
3. **Follow an authenticated API request.** Inspect `authHeaders()` and the `getEvents()` / `createEvent()` methods. The browser sends an ID token; the API's Cognito authorizer validates it. A client-side token check alone would not protect a backend route.
4. **Make the trust boundary explicit.** The API must make authorization decisions from identity claims in its verified request context. Data ownership and access checks belong in the backend, not in editable browser state or values supplied by the client.
5. **Run a quick verification.** Sign in, load the event list, and create or inspect an event if the live API is available. Then show what an unauthenticated or invalid-token request should demonstrate at the API boundary. Do not use real customer information or expose tokens in screenshots.
6. **Bridge to the assignment.** Ask students to explain which parts of this flow transfer and which application-specific decisions they must make themselves. The assignment requires their own data model, routes, backend checks, and authorization tests; this portal does not implement those.

### Transfer guide

**Patterns students can reuse:** public-client Cognito configuration, Authorization Code with PKCE, exact callback/sign-out URL matching, sending a token to an API, authorizer-based authentication, deriving identity from verified claims, negative authorization tests, and keeping secrets out of source control.

**Students must design and implement themselves:** the assignment's business-specific request schema, API contract, persistence design, Lambda behavior, ownership enforcement, status-code choices, and test evidence. Do not copy this portal's event model or endpoint behavior as an assignment solution.

### Instructor preflight

- Confirm the GitHub Pages URL and Cognito callback/sign-out URLs match exactly, including the repository path and trailing slash.
- Confirm the app client is a public client with no secret and supports Authorization Code with PKCE.
- Confirm `COGNITO_CONFIG` points to the demo User Pool and `API_MODE` / `API_BASE_URL` match the demonstration environment.
- Test sign-in and event loading in a private browser window before class. Keep a mock-mode fallback ready if the live API is unavailable.
- Never display or capture passwords, authorization codes, or JWTs. Public client IDs and Cognito domains are configuration values, not client secrets.

---

## How to run locally

1. Open a terminal at the project root; the `docs/` folder contains `index.html` and `app.js`.
2. Double-click `index.html` to open it directly in a browser, **or** serve it with a simple local server (recommended so `localStorage` behaves consistently):

```powershell
Set-Location docs
python -m http.server 8080
```

Then browse to `http://localhost:8080`.

No installation, build tools, or dependencies are required.

---

## Deploying with GitHub Pages and connecting Cognito

Use this path for Tutorial 4. It publishes the app at a real, public HTTPS URL, which Cognito's Managed Login page requires for its callback and sign-out URLs (a `file://` path or `localhost` will not work for GitHub Pages, and a mismatched URL will not work at all).

1. Clone the public course repository containing this project to your own GitHub account (fork it, or use the **Use this template** / **Import repository** option your instructor provides).
2. In your copy of the repository, open **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the branch (for example `main`) and the `/docs` folder, then save.
4. Wait for the **Pages** build to finish, then record the published URL GitHub shows you, for example `https://<your-username>.github.io/<your-repo>/`. Include the trailing slash.
5. Follow Tutorial 4 to create your Cognito User Pool and app client. When you configure Managed Login, set both the **callback URL** and the **sign-out URL** to your exact GitHub Pages URL from step 4.
6. On the published page, open **Connection > Connection settings**. Enter the API base URL, Cognito domain, and public app client ID for your environment, then choose **Save settings**. The callback and sign-out URLs are derived from the page URL; configure those exact values in Cognito. Saving settings clears the current sign-in, so sign in again afterward.
7. Commit and push your changes, wait for GitHub Pages to redeploy, then open your GitHub Pages URL and choose **Sign In** to verify the flow works.

Do not commit a real test password, authorization code, or token to the repository. The API URL, Cognito domain, and public app client ID are configuration values, not secrets; the browser client must not use an app client secret.

### Configure the connection in the browser

Open **Connection > Connection settings** and enter:

- **API base URL:** your API Gateway invoke URL, including its stage (for example, `/dev`).
- **Cognito domain URL:** the HTTPS domain root, without a path.
- **Cognito public app client ID:** the ID for the public app client configured for Authorization Code with PKCE.

Choose **Save settings**, then sign in. Settings persist in this browser only. The callback and sign-out URLs must match the page URL exactly, including the GitHub Pages repository path and trailing slash.

---

## Mock mode and live API mode

- The checked-in `app.js` currently sets `API_MODE` to `"live"`. Confirm the API URL entered in the Connection panel is available before relying on live event data in a lecture.
- To demonstrate the interface without the backend, set `API_MODE` to `"mock"` at the top of `app.js` and redeploy. Mock mode uses local sample data and does not require the training-event API.
- On first load, the app seeds `localStorage` with 5 sample training events and 8 sample registrations.
- All create/update/cancel actions read and write directly to `localStorage` via the `apiService` object, so data persists across page reloads in the same browser.
- Use **Reports → Reset demo data** to restore the original seed data at any time.
- Use **Reports → Export demo data as JSON** to download the current state.

---

## Live training-event API mode

Live mode sends event operations to the YMB training-event API. It is separate from Assignment 3's backend and does not persist registrations.

1. The checked-in app already uses live mode. Enter the API Gateway invoke URL, including stage, in the Connection panel and save it.
2. The `fetch(...)` implementations are already present in `apiService`; no uncommenting is required.
3. Configure API Gateway CORS for the published page and confirm the event routes are reachable. The browser renders through `apiService`; registrations continue to use `localStorage`.

## Backend endpoint mapping

The deployed API only exposes two resources — `/events` and `/events/{eventId}` — and
only persists `{ eventId, title, status }` per event. There is no `/health` route and
no registration endpoints, so registrations always stay in `localStorage` even in
`"live"` mode. Extra event fields (description, delivery mode, capacity, etc.) entered
in the Create Event form are cached client-side (keyed by `eventId`) and merged back in
when events are loaded, since the API itself doesn't store them.

| `apiService` method                                 | Backend endpoint                             |
| --------------------------------------------------- | -------------------------------------------- |
| `getHealth()`                                       | `GET /events` (used as a reachability probe) |
| `getEvents()`                                       | `GET /events`                                |
| `createEvent(eventData)`                            | `POST /events`                               |
| `getEventById(eventId)`                             | `GET /events/{eventId}`                      |
| `getRegistrations(eventId)`                         | local only (`localStorage`)                  |
| `createRegistration(eventId, data)`                 | local only (`localStorage`)                  |
| `updateRegistration(eventId, registrationId, data)` | local only (`localStorage`)                  |
| `cancelRegistration(eventId, registrationId)`       | local only (`localStorage`)                  |

> **CORS:** the deployed API does not currently return `Access-Control-Allow-Origin`
> headers. Enable CORS on the `/events` and `/events/{eventId}` resources in API
> Gateway (or via `Access-Control-Allow-Origin` response headers from the Lambda) and
> redeploy the `dev` stage, or browser requests from this app will be blocked.

---

## Accessibility notes

- Semantic landmarks: `header`, `nav`, `main`, `section`, `footer`.
- All form fields have visible `<label>` elements (no placeholder-only labeling).
- Required fields are marked visually and validated with inline error text tied via `aria-describedby`.
- Status messages (success/error) use an `aria-live="polite"` region.
- Focus states are visible (`:focus-visible` outline using the gold accent colour).
- Colour is never the only way status is communicated — text labels accompany every status pill and error.
- The confirmation dialog is a keyboard-friendly `alertdialog` (Escape closes it, focus moves to the confirm button).

---

## Browser testing checklist

- [ ] Loads correctly in Chrome, Edge, and Firefox.
- [ ] Navigation works without a page reload.
- [ ] Creating an event updates the Training Events list and Dashboard counts.
- [ ] Registering an employee is blocked when an event is closed/cancelled or at capacity.
- [ ] Mark completed / mark no-show / cancel actions update the Registrations table and Dashboard.
- [ ] Reports page renders progress bars and export/reset buttons work.
- [ ] Layout is usable at desktop, tablet, and mobile widths.
- [ ] Keyboard-only navigation can reach and operate every control.

---

## Known limitations

- Data is stored only in the browser's `localStorage`; it is not shared between devices or users.
- Authentication uses Amazon Cognito Managed Login; you need to follow the instructions in Module 2B to complete the setup and update `COGNITO_CONFIG`. Without completing the setup and updating `COGNITO_CONFIG`, sign-in will fail.
- This is a teaching demo, not a production-ready banking application.d between devices or users.
- Authentication uses Amazon Cognito Managed Login; you need to follow the instructions in Module 2B to complete the setup and update `COGNITO_CONFIG`. Without completing the setup and updating `COGNITO_CONFIG`, sign-in will fail.
- This is a teaching demo, not a production-ready banking application.
