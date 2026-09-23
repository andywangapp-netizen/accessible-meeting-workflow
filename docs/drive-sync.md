# Transcript sync to Google Drive

The local `transcripts/*.json` files are combined into one
[zoom-transcripts.json](https://drive.google.com/file/d/1ZuFUhpNjHCu6oINxXloEm3mdsu7dxd2d/view)
in My Drive. The former Zoom Transcripts folder was moved to Trash.
The bundle is `{ "schema_version": 1, "transcripts": [ ...original objects... ] }`.
Objects are ordered by source filename and their fields and dialogue are preserved.

The sync script rebuilds the bundle, compares its checksum to the existing Drive
file, and updates that same file ID when content changes. It verifies the remote
checksum after writing. Additions and deletions in the source directory are
reflected in the array. Empty or invalid source sets fail before upload. The
script never creates replacement Drive files or deletes Drive content.

## Authentication (one-time setup)

Install `python -m pip install '.[drive-sync]'` in your Python environment.
Use Google Application Default Credentials with Drive access, or set
`GOOGLE_DRIVE_CREDENTIALS_JSON` to a Google authorized-user credential JSON
(with refresh token) obtained through your own OAuth client. A service account
credential also works for updating accessible files, but creation requires
appropriate shared-drive storage/access; service accounts have no personal
Drive storage quota. Do not commit credentials or paste them into chat.

The script uses the Drive scope because these existing files were created by
a different connector application. The authenticated account must have edit
access to the existing bundle file. The chat connector's
credentials cannot be reused by this standalone script. `.env` is not loaded
automatically; export variables in your shell or use ADC.

## Local edits

```sh
python scripts/sync_transcripts_to_drive.py --build-only .tmp/zoom-transcripts.json
python scripts/sync_transcripts_to_drive.py --dry-run
python scripts/sync_transcripts_to_drive.py
python scripts/sync_transcripts_to_drive.py --watch
```

Watch mode checks content every five seconds, syncs on startup and after local
changes, and retries validation/upload failures on subsequent passes. Keep the
process running while editing. It does not install a background service.
Run only one watcher/sync writer for this file at a time.

## Automatic sync after pushing changes

Add the credential JSON as the repository Actions secret
`GOOGLE_DRIVE_CREDENTIALS_JSON`, then publish the workflow and script.
`.github/workflows/sync-transcripts.yml` syncs when transcript files change on
`main`; it also supports manual workflow dispatch. Concurrent Actions runs are
serialized. Before those files are published and the secret is configured,
automatic GitHub syncing is not active.

## Zoom integration

Select the single `zoom-transcripts.json` file through Zoom's Google Drive
integration. Folders are not supported by this integration. The node must read
the full selected object from its `transcripts` array, matched by `id` or title,
then ask which participant the user is. Do not merge dialogue across entries.
Keep the Drive file link in workflow configuration, not in the generic skill.
Updating Drive does not update old direct-upload Resources; replace those with
the Drive-backed bundle. Runtime retrieval in Zoom still needs verification.

Implementation references: [Drive upload/update API](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
and [Drive file checksums](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).
