---
status: accepted
---

# Platforms vouch for a Student with a short-lived token scoped to one World; Publish uses a shared key

The game service has no sign-in of its own. A Platform vouches for a Student by signing a short-lived JWT with HS256 and a secret shared with the game service (one env var on each side). The token carries `sub` (the Student id), `world` (the World id), `exp`, and `aud: "game-service"`, so a token the Platform signs for anything else with the same secret is refused. The browser calls the game service directly, sending the token as an `Authorization: Bearer` header. The service refuses to load a World or to read or write its Flags unless the token names that World. So the Platform decides which Worlds a Student may play, and the service enforces it without knowing about courses or enrollment.

The Platform signs tokens in a small route of its own, guarded by whatever sign-in it already uses: check the session, check the Student may play that World, sign. The client package doesn't take a fixed token. It takes a `getToken()` callback, calls it at mount, and when the service answers 401 it calls it again and retries once, so a token that expires mid-Script doesn't lose a Flag write. The Platform chooses the lifetime; the installation guide's example uses one hour.

Publish doesn't use Student tokens. The service is configured with a single shared Publish key. The CLI reads it from its environment and sends it as a Bearer token. One game service serves one Platform with one Asset Library, so there are no per-Author accounts.

## Considered Options

- **The Platform proxies every call, and the service trusts its private network.** Rejected: every installer would have to write and run proxy code, every Flag read would take two hops, and a service exposed by mistake would accept any Student id.
- **A gateway sets a trusted `X-Student-Id` header.** Rejected for the same reasons. It's the proxy with someone else's gateway.
- **Accept the Platform's own auth JWT (e.g. Better Auth's JWT plugin through its JWKS).** Rejected: those tokens identify only the user. Better Auth's `definePayload` sees the user, not the request, so it can't name a World, and the service would have to trust any World the browser asked for.
- **Asymmetric signing (EdDSA/RS256, public key or JWKS URL).** Rejected for now: a shared secret is one env var to install, and the service is already trusted with all Flags, so stopping it from signing tokens protects nothing. JWKS can be added if an installer needs key rotation.
- **Per-Author accounts, or an "author" role on Platform tokens, for Publish.** Rejected: accounts would make the service own users, and a role would make the Platform hand tokens to a CLI. Per-Author audit isn't needed yet.
