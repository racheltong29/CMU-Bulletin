# CMU Bulletin ✨

Your one-stop shop for everything happening at Carnegie Mellon. Never miss an event on campus again.

**Live at [cmubulletin.com](https://cmubulletin.com)** (Once Deployed)

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- **Firebase account** and project setup

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CMU-Bulletin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   VITE_FIREBASE_API_KEY=your_firebase_api_key_here
   ```
   
   You can find your Firebase API key in your Firebase project settings:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project (`cmu-bulletin`)
   - Go to Project Settings → General
   - Under "Your apps", find the Web app config
   - Copy the `apiKey` value

4. **Install Firebase Functions dependencies** (optional, for backend functions)
   ```bash
   cd functions
   npm install
   cd ..
   ```

### Running the Project

**Development Mode:**
```bash
npm run dev
```

This will start the Vite development server, typically at `http://localhost:5173`

**Build for Production:**
```bash
npm run build
```

**Preview Production Build:**
```bash
npm run preview
```

**Lint Code:**
```bash
npm run lint
```

### Firebase Functions (Backend)

If you need to work with or deploy Firebase Functions:

```bash
cd functions
npm run serve    # Run functions locally with emulator
npm run deploy   # Deploy functions to Firebase
```

### Poster Autofill (Optional)

The poster upload form includes an **Autofill from image** button that uses **OpenAI** (vision model, default `gpt-4o-mini` in `functions/index.js`) to extract event details from poster images.

Put your **OpenAI API key** in **`functions/.env`** (gitignored), not in `.env.local` with a `VITE_` prefix—that would expose the key in the browser. For quick local iteration, keeping the key only in `functions/.env` is enough; tighten this up before any public launch.

The function reads **`OPENAI_API_KEY`** via Firebase **params** (`defineString`), which works on the **Spark (free)** plan:

```text
OPENAI_API_KEY=sk-proj-...
```

Then: `cd functions && npm install && npm run deploy`. The CLI uses `functions/.env` at deploy time to set the parameter.

**OpenAI** billing is separate from Firebase (see [OpenAI pricing](https://openai.com/pricing)).

### Run against local emulators (no production Firebase)

The emulator still calls **OpenAI** over the internet. You *can* avoid **production** Firebase (Auth, Firestore, Functions) by using the **Firebase Emulator Suite**.

1. **`functions/.env`** — same `OPENAI_API_KEY=...` as above (loaded when the Functions emulator runs).
2. From the repo root, start emulators:
   ```bash
   firebase emulators:start --only auth,firestore,functions
   ```
3. In **`.env.local`** (next to your existing `VITE_FIREBASE_API_KEY`), add:
   ```text
   VITE_USE_FIREBASE_EMULATORS=true
   ```
4. Run the app: `npm run dev`.

Use the Emulator UI (link in the terminal, default port **4000**) to add a test user in **Auth**, then sign in in the app. Firestore data stays on your machine. Toggle **`VITE_USE_FIREBASE_EMULATORS`** off (or remove it) when you want the live Firebase project again.

---

### Features

- **Discover:** A beautiful, filterable grid of event posters.
- **Share:** Upload your own posters in seconds.
- **Save:** Like events to keep them on your personal profile.
- **Engage:** Click any poster for a full-screen detailed view.

### Tech Stack

- **Frontend:** React & Vite
- **Backend & Hosting:** Firebase (Auth, Firestore, Storage, Hosting)
- **Styling:** Pure CSS
