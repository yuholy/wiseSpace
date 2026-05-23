use crate::AppState;
use tauri::State;
use wisespace_core::types::Workspace;

#[tauri::command]
pub async fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<Workspace>, String> {
    wisespace_core::repo::workspace::ensure_workspace_identity_backfilled(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;
    wisespace_core::repo::workspace::list_workspaces(&state.sea_db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workspace(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<Workspace, String> {
    wisespace_core::repo::workspace::get_workspace(&state.sea_db, &workspace_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workspace_by_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Option<Workspace>, String> {
    let _ = wisespace_core::repo::workspace::ensure_workspace_identity_for_conversation(
        &state.sea_db,
        &conversation_id,
    )
    .await
    .map_err(|e| e.to_string())?;

    wisespace_core::repo::workspace::get_workspace_by_conversation_id(
        &state.sea_db,
        &conversation_id,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_workspace(
    state: State<'_, AppState>,
    workspace_id: String,
    name: String,
) -> Result<Workspace, String> {
    wisespace_core::repo::workspace::rename_workspace(&state.sea_db, &workspace_id, &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn attach_conversation_to_workspace(
    state: State<'_, AppState>,
    conversation_id: String,
    workspace_id: String,
) -> Result<Workspace, String> {
    wisespace_core::repo::workspace::attach_conversation_to_workspace(
        &state.sea_db,
        &conversation_id,
        &workspace_id,
    )
    .await
    .map_err(|e| e.to_string())
}
