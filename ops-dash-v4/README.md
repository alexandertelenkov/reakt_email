# Ops Dash v4 — Smart Import Engine

Single-page React + Vite dashboard for ops workflows:

- **Smart Import**: paste rows from Google Sheets (tab-separated) → auto-parses → dedupes → auto-creates missing Accounts/Hotels → writes Audit log.
- **Accounts Ready**: eligibility rules + multi-select copy (email\tpassword) + **Stat (positive/cancelled)**.
- **Dashboard → RawData**: paste `email\tpassword` to update passwords everywhere + filter for emails without passwords.
- **Bookings Log**: Google-like columns, per-column filters, Reward Type, auto-calculated **Reward paid on** (14/64 days after CheckOut by Type) + editable override.

## Local run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub push (quick)

```bash
git init
git add .
git commit -m "Ops Dash v4"
# create a repo on GitHub, then:
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```
