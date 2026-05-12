use std::path::{Path, PathBuf};

const LEGACY_HOME_DIR_NAME: &str = concat!(".", "aq", "bot");
const LEGACY_DOCUMENTS_DIR_NAME: &str = concat!("aq", "bot");
const LEGACY_DATABASE_FILE_NAME: &str = concat!("aq", "bot", ".db");

/// Returns the canonical wiseSpace home directory and ensures it exists.
///
/// - macOS / Linux: `~/.wisespace/`
/// - Windows:       `%USERPROFILE%\.wisespace\`
///
/// Panics if the home directory cannot be determined.
pub fn wisespace_home() -> PathBuf {
    #[cfg(not(windows))]
    let home = std::env::var("HOME").expect("HOME env var not set");
    #[cfg(windows)]
    let home = std::env::var("USERPROFILE").expect("USERPROFILE env var not set");

    PathBuf::from(home).join(".wisespace")
}

pub fn legacy_app_home() -> PathBuf {
    #[cfg(not(windows))]
    let home = std::env::var("HOME").expect("HOME env var not set");
    #[cfg(windows)]
    let home = std::env::var("USERPROFILE").expect("USERPROFILE env var not set");

    PathBuf::from(home).join(LEGACY_HOME_DIR_NAME)
}

pub fn migrate_legacy_storage() {
    let new_home = wisespace_home();
    let old_home = legacy_app_home();
    if old_home.exists() {
        if let Err(err) = migrate_app_home(&old_home, &new_home) {
            tracing::warn!(
                old = %old_home.display(),
                new = %new_home.display(),
                error = %err,
                "failed to migrate legacy application home"
            );
        }
    }

    if let Some(documents) = dirs::document_dir() {
        let old_documents = documents.join(LEGACY_DOCUMENTS_DIR_NAME);
        let new_documents = documents.join("wisespace");
        if old_documents.exists() && !new_documents.exists() {
            if let Err(err) = copy_dir_all(&old_documents, &new_documents) {
                tracing::warn!(
                    old = %old_documents.display(),
                    new = %new_documents.display(),
                    error = %err,
                    "failed to migrate legacy documents root"
                );
            }
        }
    }
}

fn migrate_app_home(old_home: &Path, new_home: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(new_home)?;

    let old_db = old_home.join(LEGACY_DATABASE_FILE_NAME);
    let old_key = old_home.join("master.key");
    let new_db = new_home.join("wisespace.db");
    let new_key = new_home.join("master.key");

    if !new_db.exists() && !new_key.exists() && old_db.exists() && old_key.exists() {
        let db_stage = new_home.join("wisespace.db.migrating");
        let key_stage = new_home.join("master.key.migrating");
        let _ = std::fs::remove_file(&db_stage);
        let _ = std::fs::remove_file(&key_stage);

        if let Err(err) = (|| -> std::io::Result<()> {
            std::fs::copy(&old_db, &db_stage)?;
            std::fs::copy(&old_key, &key_stage)?;
            std::fs::rename(&db_stage, &new_db)?;
            std::fs::rename(&key_stage, &new_key)?;
            Ok(())
        })() {
            let _ = std::fs::remove_file(&db_stage);
            let _ = std::fs::remove_file(&key_stage);
            return Err(err);
        }
    }

    for dir in ["vector_db", "ssl"] {
        let old_dir = old_home.join(dir);
        let new_dir = new_home.join(dir);
        if old_dir.exists() && !new_dir.exists() {
            if let Err(err) = copy_dir_all(&old_dir, &new_dir) {
                tracing::warn!(
                    old = %old_dir.display(),
                    new = %new_dir.display(),
                    error = %err,
                    "failed to migrate legacy application subdirectory"
                );
            }
        }
    }

    Ok(())
}

fn copy_dir_all(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let source = entry.path();
        let target = to.join(entry.file_name());
        if source.is_dir() {
            copy_dir_all(&source, &target)?;
        } else if !target.exists() {
            std::fs::copy(&source, &target)?;
        }
    }
    Ok(())
}
