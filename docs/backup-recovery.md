# Backup and isolated recovery

The existing weekly encrypted table backup remains available. Without `SUPABASE_DB_URL`, its manifest explicitly says `complete:false`: it excludes Auth credentials and private Storage bytes.

For the implemented full path, configure the private repository secret `SUPABASE_DB_URL` (direct or session-pooler database URL, PostgreSQL 17) alongside the existing Supabase URL/service key. Prefer a separate `BACKUP_ENCRYPTION_KEY`; retain historical encryption keys when rotating. The workflow falls back to the historical service-key encryption key for compatibility. Never put credentials into command arguments or logs.

`npm run backup -- --require-full --out /private/backup` produces a native custom-format dump of `public`, `auth`, and `storage`, bucket metadata, original object metadata, private file bytes, and SHA-256 checksums. Storage metadata is read over PostgreSQL because Storage is not a public REST schema. Changes during the export abort the full backup. Database snapshots cannot include Supabase dashboard Auth provider settings or external OAuth/provider secrets: retain those in the credential manager.

Decrypt the existing artifact privately with OpenSSL (AES-256-CBC, PBKDF2, 200000 iterations; encryption password supplied via environment), then unpack it. Verify the artifact came from the trusted workflow; CBC archives are not authenticated encryption. Keep decrypted data out of the public repository and remove it after recovery.

Recovery is implemented for a **fresh, isolated Supabase project**, with the same platform schema version and database privileges required by `pg_restore --disable-triggers`. Configure its Supabase URL, service key, database URL, and `RESTORE_EMPTY_PROJECT_ACK` equal to its project ref, then run:

```
npm run backup -- --restore /private/backup
```

The command validates every checksum before mutation, refuses JobPao production and the original project, verifies the database URL identifies the isolated target, checks for existing users/jobs/applications/storage objects, restores public schema and data without replaying platform-managed Auth/Storage DDL or platform migration ledger rows, uploads bytes, restores original owner/metadata values, and downloads each recovered object for checksum verification. A failed isolated recovery is discarded and restarted in a fresh project; do not retry into a partially restored project. Production restore is deliberately unsupported by this command.

Automated tests cover corrupted/incomplete backups, unsafe paths, TLS connection setup and production-target rejection. A real native PostgreSQL/Supabase restore drill and first full encrypted backup remain operational verification steps; do not claim recovery readiness solely from these tests. `SUPABASE_DB_URL` is an external configuration prerequisite, not a completed deployment setting.
