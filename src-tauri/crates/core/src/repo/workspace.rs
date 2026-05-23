use sea_orm::*;

use crate::entity::{conversations, workspaces};
use crate::error::{Result, WiseSpaceError};
use crate::types::Workspace;
use crate::utils::{gen_id, now_ts};

fn workspace_from_model(model: workspaces::Model) -> Workspace {
    Workspace {
        id: model.id,
        slug: model.slug,
        name: model.name,
        root_path: model.root_path,
        source: model.source,
        description: model.description,
        created_at: model.created_at,
        updated_at: model.updated_at,
    }
}

fn workspace_name_from_title(title: &str) -> String {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        "Untitled Workspace".to_string()
    } else {
        trimmed.to_string()
    }
}

fn managed_workspace_root_path(title: &str, conversation_id: &str) -> String {
    let path = if title.trim().is_empty() {
        crate::storage_paths::conversation_workspace_dir(conversation_id)
    } else {
        crate::storage_paths::titled_conversation_workspace_dir(title, conversation_id)
    };
    path.to_string_lossy().to_string()
}

pub async fn get_workspace(db: &DatabaseConnection, id: &str) -> Result<Workspace> {
    let model = workspaces::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Workspace {}", id)))?;
    Ok(workspace_from_model(model))
}

pub async fn list_workspaces(db: &DatabaseConnection) -> Result<Vec<Workspace>> {
    let rows = workspaces::Entity::find()
        .order_by_desc(workspaces::Column::UpdatedAt)
        .all(db)
        .await?;
    Ok(rows.into_iter().map(workspace_from_model).collect())
}

pub async fn get_workspace_by_conversation_id(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Option<Workspace>> {
    let Some(conversation) = conversations::Entity::find_by_id(conversation_id).one(db).await? else {
        return Ok(None);
    };

    let Some(workspace_id) = conversation.workspace_id else {
        return Ok(None);
    };

    let workspace = workspaces::Entity::find_by_id(workspace_id).one(db).await?;
    Ok(workspace.map(workspace_from_model))
}

pub async fn ensure_canonical_workspace_for_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Workspace> {
    let conversation = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    if let Some(workspace_id) = conversation.workspace_id.clone() {
        if let Some(existing) = workspaces::Entity::find_by_id(&workspace_id).one(db).await? {
            return Ok(workspace_from_model(existing));
        }
    }

    let name = workspace_name_from_title(&conversation.title);
    let slug = crate::storage_paths::workspace_dir_name_from_title(&name, conversation_id);
    let root_path = managed_workspace_root_path(&conversation.title, conversation_id);
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let workspace_id = gen_id();

    let workspace = workspaces::ActiveModel {
        id: Set(workspace_id.clone()),
        slug: Set(slug),
        name: Set(name),
        root_path: Set(root_path),
        source: Set("conversation".to_string()),
        description: Set(None),
        created_at: Set(now.clone()),
        updated_at: Set(now.clone()),
    }
    .insert(db)
    .await?;

    let mut conversation_am: conversations::ActiveModel = conversation.into();
    conversation_am.workspace_id = Set(Some(workspace_id));
    conversation_am.updated_at = Set(now_ts());
    conversation_am.update(db).await?;

    Ok(workspace_from_model(workspace))
}

pub async fn sync_workspace_metadata_from_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Option<Workspace>> {
    let workspace = ensure_canonical_workspace_for_conversation(db, conversation_id).await?;
    let conversation = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    let next_name = workspace_name_from_title(&conversation.title);
    let next_slug = crate::storage_paths::workspace_dir_name_from_title(&next_name, conversation_id);
    let next_root_path = managed_workspace_root_path(&conversation.title, conversation_id);

    let mut am: workspaces::ActiveModel = workspaces::Entity::find_by_id(&workspace.id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Workspace {}", workspace.id)))?
        .into();
    am.name = Set(next_name);
    am.slug = Set(next_slug);
    am.root_path = Set(next_root_path);
    am.updated_at = Set(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());
    let updated = am.update(db).await?;
    Ok(Some(workspace_from_model(updated)))
}
