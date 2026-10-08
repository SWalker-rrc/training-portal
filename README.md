# YMB Training Portal - YMB Secure Serverless API Demonstration

A static COMP-3020 teaching demo for Cognito sign-in and a training-event API. Use it in Module 2B Tutorial 4 and as a lecture example of security patterns students will apply in Assignment 3.

This is a separate training-event application, not an Assignment 3 solution. Students can transfer the authentication, API-integration, and authorization reasoning, but must design and implement their own assignment-specific data model, API, backend behavior, and tests.

## Repository layout

```text
training-portal/
├── README.md
├── docs/                 # GitHub Pages site
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── README.md         # Detailed setup and instructor demonstration guide
├── src/                  # Lambda handler versions used in Tutorials 3 and 4
└── lab4-starter/         # Tutorial 4 starter environment (run on the course EC2 instance)
    ├── setup-lab4.sh     # Creates the -lab4 table, Lambda function, and REST API
    ├── test-lab4.sh      # curl regression tests for the /events routes
    ├── teardown-lab4.sh  # Removes the -lab4 resources to restart the lab
    ├── events/           # Lambda and API Gateway console test inputs
    └── README.md         # Step-by-step guide to explore and test each layer
```

## Tutorial 4 starter environment

On the course EC2 instance with `LabRole` attached:

```bash
git clone https://github.com/<your-github-username>/training-portal.git
cd training-portal/lab4-starter
bash setup-lab4.sh
source ./lab4.env
```

See [`lab4-starter/README.md`](lab4-starter/README.md) to explore and test the API step by step.

## Run locally

From the repository root, serve the site with Python:

```powershell
python -m http.server 8080 --directory docs
```

Open <http://localhost:8080>. Use **Connection > Connection settings** to enter the API base URL, Cognito domain, and public app client ID; they are saved in this browser. The checked-in app uses the live training-event API, so event loading requires that endpoint to be available. To demonstrate the interface without the API, set `API_MODE` to `"mock"` in `docs/app.js`. Cognito sign-in requires a configured User Pool and an exact callback URL match.

## Publish with GitHub Pages

In the repository, open **Settings > Pages** and choose **Deploy from a branch**, your default branch (usually `main`), and the `/docs` folder. Use the published HTTPS URL as the Cognito callback and sign-out URL, matching it exactly. See [`docs/README.md`](docs/README.md) for Cognito setup, lecture flow, API configuration, and browser-testing guidance.

## Security and course use

Never commit passwords, authorization codes, JWTs, or Cognito client secrets. This browser app uses a public Cognito client, so its client ID and domain are not secrets. Keep the demo's training-event model distinct from Assignment 3, and use only test data during demonstrations.

## Link

- [Live Demo](https://Comp-3020-Nico.github.io/training-portal/)
