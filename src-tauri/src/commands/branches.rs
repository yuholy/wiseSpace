use crate::AppState;
use tauri::State;
use wisespace_core::types::*;

#[tauri::command]
pub async fn list_branches(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<ConversationBranch>, String> {
    wisespace_core::repo::conversation_branch::list_branches(&state.sea_db, &conversation_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fork_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
    message_id: String,
) -> Result<ConversationBranch, String> {
    wisespace_core::repo::conversation_branch::create_branch(
        &state.sea_db,
        &conversation_id,
        &message_id,
        "Branch",
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compare_branches(
    _state: State<'_, AppState>,
    branch_a: String,
    branch_b: String,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "branch_a": branch_a,
        "branch_b": branch_b,
        "differences": []
    }))
}

#[tauri::command]
pub async fn get_workspace_snapshot(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<ConversationWorkspaceSnapshot, String> {
    wisespace_core::repo::conversation::get_workspace_snapshot(&state.sea_db, &conversation_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_workspace_snapshot(
    state: State<'_, AppState>,
    conversation_id: String,
    input: UpdateConversationWorkspaceSnapshotInput,
) -> Result<ConversationWorkspaceSnapshot, String> {
    wisespace_core::repo::conversation::update_workspace_snapshot(
        &state.sea_db,
        &conversation_id,
        input,
    )
    .await
    .map_err(|e| e.to_string())
}
