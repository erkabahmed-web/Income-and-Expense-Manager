# MelaPocket — Income & Expense Manager

A responsive daily money tracker built with vanilla HTML, CSS, and JavaScript. No build step or external JavaScript packages are required.

## Features

- Create an account and log in with a password
- Add, edit, and delete income and expense entries
- Categories, dates, amounts, and optional notes
- Daily and monthly summaries with income, expenses, and net balance
- Search and filter the full transaction history
- Responsive dashboard and transaction list
- Separate local data for each account in the browser

## Run locally

1. Open this folder in VS Code.
2. Install the **Live Server** extension, if it is not already installed.
3. Right-click `index.html` and choose **Open with Live Server**.
4. Create an account from the sign-in screen.

The app uses JavaScript modules and the Web Crypto API, so run it from `localhost` (or HTTPS); opening `index.html` directly as a `file://` URL may not work. Alternatively, if Python is installed, run `python -m http.server 5500` in this folder and open `http://localhost:5500`.

## Stack and development walkthrough

For this learning-friendly, single-device version, the stack is semantic HTML, responsive CSS, vanilla JavaScript modules, and `localStorage`. That keeps setup small while separating authentication, storage, transaction rules, and interface code.

1. Create the folder structure shown below and add `index.html` plus the stylesheet.
2. Add `storage.js` for browser persistence, then `auth.js` for signup and login.
3. Add `transactions.js` for categories and transaction CRUD operations.
4. Connect those modules from `app.js`; it renders summaries and handles search, filters, and dialogs.
5. Serve the folder on `localhost`, create an account, and test daily/monthly views and transaction edits.

For a production app with multiple devices and private per-user data, use **React + TypeScript + Vite** for the frontend, **Node.js + Express** for an API, **PostgreSQL + Prisma** for persistent storage, and **Argon2id** for password hashing. Use server-managed sessions in `HttpOnly`, `Secure`, `SameSite` cookies, validate every API input on the server, and scope every transaction query to the authenticated user. Keep secrets and database credentials on the server; do not treat client-side storage or UI checks as access control.

## Project structure

```text
Income-and-Expense-Manager/
├── index.html
├── README.md
└── assets/
    ├── css/
    │   └── style.css
    └── js/
        ├── app.js
        ├── auth.js
        ├── storage.js
        └── transactions.js
```

- `app.js` connects the interface, authentication flow, dashboard, and transaction actions.
- `auth.js` handles account creation and sign-in. Passwords are stored as salted PBKDF2 hashes rather than plain text.
- `transactions.js` contains transaction categories and create, update, and delete operations.
- `storage.js` isolates browser storage access.

## Data storage and privacy

This starter app stores accounts and transactions in the browser's `localStorage`. Each account's transaction list uses its own storage key, and the active account remains signed in on this device. Data does not sync to another browser or device. Clearing site data removes the accounts and transactions, so export or back up important records before clearing browser storage.

This is suitable for a local learning project, not production authentication or financial record keeping. Browser storage can be inspected or modified by someone with access to the device, and a client-only app cannot securely enforce account ownership. For a deployed, multi-device app, use a backend API (for example, Node.js with Express), PostgreSQL with per-user transaction ownership, server-side sessions, and a proven password-hashing library such as Argon2id. Never store real passwords or trust client-side access controls.

## Currency settings

- Open **Settings** from the sidebar and search for a currency by its ISO code or name. The selector uses the browser's supported ISO 4217 currencies and formats amounts with `Intl.NumberFormat`.
- The selection is saved per account on this device and changes the displayed currency only; it does not convert existing transaction amounts.

## Customize

- Edit the category arrays in `assets/js/transactions.js` to customize the income and expense categories.
- For compatibility with existing saved accounts and transactions, data remains stored under `daybook.users.v1`, `daybook.session.v1`, and `daybook.transactions.v1.<user-id>` in browser local storage.
- Currency preferences are stored separately under `daybook.preferences.v1.<user-id>`.
