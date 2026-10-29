# Postman collections

| File | Covers |
|---|---|
| `expense-tracker-auth.postman_collection.json` | Register, login, protected routes, refresh, logout |
| `expense-tracker-transactions.postman_collection.json` | Transaction CRUD (POST/GET/PUT/PATCH/DELETE), validation and error cases |

Both are self-contained: each run registers its own fresh user.

1. Start the API (`uvicorn app.main:app --reload` in `backend/`, or `make up`).
2. Postman → **Import** → pick a collection file.
3. Run the whole collection with the **Collection Runner** (top to bottom), or send requests one by one.

Each run registers a fresh `user_<timestamp>@example.com`, captures the access token into the
`accessToken` collection variable, and every protected request inherits `Authorization: Bearer {{accessToken}}`.
The refresh token travels as an HttpOnly cookie that Postman stores and resends automatically.

Change `baseUrl` (collection variables) if the API isn't on `http://localhost:8000/api/v1`.

CLI: `npx newman run docs/postman/<collection>.postman_collection.json`
