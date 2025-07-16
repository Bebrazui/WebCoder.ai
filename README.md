# Firebase Studio

This is a NextJS starter in Firebase Studio, now configured to run as a cross-platform desktop application using Electron.

## Getting Started

To get started, take a look at `src/app/page.tsx`.

## Running the Application

### As a Web App

To run the application in your browser for standard web development:

```bash
npm run dev
```

### As a Desktop App (Electron)

**1. Run in Development Mode:**

This will start the Next.js development server and open it in an Electron window. This is ideal for testing and debugging.

```bash
npm run electron:dev
```

**2. Build for Production:**

This command will first build your Next.js application into static files and then package it into an executable for your current operating system (e.g., `.exe` for Windows, `.dmg` for macOS).

```bash
npm run electron:build
```

After the build is complete, you will find the finished application inside the `dist` directory.

> **Note:** The first time you run a build, it may take a few minutes to download the required Electron binaries.
