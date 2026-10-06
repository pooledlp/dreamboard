# Security

Dreamboard is a local pre-production review workspace. It has no authentication, tenant isolation, separate reviewer identities, or tamper-proof audit log. Do not expose its port or use real customer data.

The server binds to 127.0.0.1, validates host and origin, limits request bodies, validates domain fields, and serves only allowlisted public assets. These controls reduce accidental exposure but do not replace a production security model.

Keep `.env`, `data/`, and workspace exports out of public Git history. An export may contain task context and comments.

Report a vulnerability privately through GitHub private vulnerability reporting if enabled or an established private channel with the repository owner. Do not post credentials or customer data in public issues.

