# wiseSpace S3 Backup / Sync Plan

This document adds S3-compatible remote backup/sync as a formal product track.
It is intended to sit alongside the existing WebDAV path, not replace it.

## Goal

Add an S3-compatible remote backup/sync target for wiseSpace so users can store
and restore remote backups through object storage providers such as:

- AWS S3
- Cloudflare R2
- MinIO
- other S3-compatible endpoints

The first version should feel structurally similar to the current WebDAV flow:

- configure connection
- test connection
- backup now
- list remote backups
- restore a selected backup
- delete a selected backup
- enable periodic auto-sync

## Why This Matters

WebDAV is simple and already useful, but S3 is a stronger long-term storage
substrate for:

- object-style backup retention
- better compatibility with cloud backup platforms
- future lifecycle policies
- easier multi-device restore paths
- clearer growth toward incremental or manifest-driven sync

## Current State

The current codebase has:

- local backup support
- WebDAV backup/sync support
- a type-level `s3` placeholder in frontend backup target definitions

The current codebase does not yet have:

- S3 backend client implementation
- S3 commands in `src-tauri`
- S3 settings UI
- S3 auto-sync scheduler
- S3 restore/delete/list flow

## Product Principles

1. S3 should be a parallel remote target, not a replacement for WebDAV.
2. The first version should reuse the current backup ZIP format and restore path
   where practical.
3. S3 setup should support common S3-compatible providers, not only AWS.
4. Connection checks must validate real object operations, not only bucket
   existence.
5. Product UX should stay aligned with the current WebDAV mental model.

## MVP Scope

### Included

- S3 connection configuration UI
- manual connection test
- remote backup upload
- remote backup list
- remote backup delete
- remote backup restore
- auto-sync scheduling
- retention cleanup per device
- support for `fast` and `full` sync modes
- optional documents include
- optional workspace include

### Not Included

- incremental delta sync
- multipart upload optimization
- object version browsing
- lifecycle policy management UI
- simultaneous multi-target sync orchestration

## Configuration Model

The S3 configuration should support:

- endpoint
- region
- bucket
- access key id
- secret access key
- optional session token
- optional object prefix
- path-style toggle
- accept invalid certs toggle only if we explicitly choose to support local/self-hosted TLS exceptions

Recommended provider examples:

- AWS S3
- Cloudflare R2
- MinIO

## UX Surface

The backup center should evolve from:

- `local`
- `webdav`

to:

- `local`
- `webdav`
- `s3`

The S3 page should mirror the current WebDAV interaction structure:

- config card
- test connection
- backup now
- sync settings
- remote backup table
- restore/delete actions

## Backend Design

### New core module

Add an S3 module parallel to the current WebDAV implementation, likely under:

- `src-tauri/crates/core/src/s3.rs`

Responsibilities:

- config struct
- client construction
- list objects
- upload object
- download object
- delete object
- connection validation
- helper methods for backup filename/object key handling

### New command module

Add:

- `src-tauri/src/commands/s3.rs`

Expected command family:

- `get_s3_config`
- `save_s3_config`
- `s3_check_connection`
- `s3_backup`
- `s3_list_backups`
- `s3_restore`
- `s3_delete_backup`
- `get_s3_sync_status`
- `restart_s3_sync`

### Scheduler

Mirror the WebDAV scheduler model with a separate task handle for S3 sync so the
product can manage it independently.

## Data / Settings Additions

Add settings fields parallel to WebDAV:

- `s3_endpoint`
- `s3_region`
- `s3_bucket`
- `s3_access_key_id`
- `s3_secret_access_key` stored encrypted
- `s3_session_token` stored encrypted if used
- `s3_prefix`
- `s3_path_style`
- `s3_accept_invalid_certs` if supported
- `s3_sync_enabled`
- `s3_sync_interval_minutes`
- `s3_max_remote_backups`
- `s3_sync_mode`
- `s3_include_documents`
- `s3_include_workspace`

Frontend types should be extended to reflect the same fields.

## Connection Validation Requirements

Avoid false-positive â€œconnection successfulâ€?checks.

The check flow should validate at least:

- bucket accessibility
- prefix list capability
- object put capability
- object get capability
- object delete capability

The safest test is:

1. write a temporary object under the configured prefix
2. list it
3. optionally read it back
4. delete it

## Object Naming Rules

Only wiseSpace backup objects should be managed by the backup center.

Server-side validation should reject non-backup object names for:

- restore
- delete
- direct object fetch

Recommended object naming pattern:

- `aqbot-backup-*.zip` style if inherited from upstream logic
- or a wiseSpace-specific backup filename pattern if already standardized

The key rule is consistency and server-side validation, not UI-only filtering.

## Restore Strategy

The first S3 restore path should reuse the current ZIP restore logic wherever
possible:

1. download object to local backup temp path
2. extract ZIP
3. verify checksum
4. stage database restore
5. restore optional documents/workspace/skills/vector DB/ssl if present

This should stay aligned with current local/WebDAV restore semantics.

## Proposed Execution Order

1. Add settings schema and encrypted config storage
2. Add core S3 client module
3. Add `s3_check_connection`
4. Add `s3_backup` upload path
5. Add remote backup list/delete
6. Add restore path
7. Add auto-sync scheduler
8. Add Backup Center S3 UI
9. Add quick backup entry if desired
10. Add regression tests and provider-specific compatibility checks

## Acceptance Criteria

- User can configure an S3-compatible remote target from Settings
- User can test connection successfully only when real object operations work
- User can upload a backup to S3
- User can list remote backups
- User can restore a selected backup
- User can delete a selected backup
- User can enable periodic S3 sync
- Existing local backup and WebDAV flows remain unaffected

## Risks

- S3-compatible vendors differ in path-style and endpoint behavior
- bucket-level access may succeed while object operations fail
- retention cleanup must avoid deleting non-backup objects
- restore flow must keep parity with current backup safety semantics

## Recommended Next Step

When implementation starts, turn this plan into an executable issue set:

- backend client and settings
- command surface
- scheduler
- Backup Center UI
- regression and compatibility tests

