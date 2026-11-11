# Manual verification matrix

Run on a clean local PostgreSQL database:

- `dotnet build GodGram.csproj` succeeds.
- GET `/` redirects to `/app`, GET `/app` displays original GodGram UI.
- GET `/styles.css` and `/app.js` serve separate source assets.
- POST `/api/auth/send_code` returns code in **dev only** mode.
- POST `/api/auth/sign_in` returns `reg_token` for first login.
- POST `/api/auth/sign_up` returns token.
- GET `/api/me` with Bearer token returns profile; without returns 401.
- Register second account, search users, start private chat.
- Send message, read it from second account, see poll version advance.
- Create group, channel, join public channel, pin chat.
- POST `/api/report` saves report; forbidden admin calls return 403.
- No duplicate private chats on repeated requests.
- PostgreSQL tables and data persist after restart.
- Unsupported money/market operations return HTTP 501 and do NOT modify balances.

For production: test auth throttling, SMS/email provider, HTTPS/CSP and rate limits before opening public access.
