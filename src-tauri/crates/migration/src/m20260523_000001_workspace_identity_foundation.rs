use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Workspaces {
    Table,
    Id,
    Slug,
    Name,
    RootPath,
    Source,
    Description,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Conversations {
    Table,
    WorkspaceId,
}

#[derive(DeriveIden)]
enum AgentProfiles {
    Table,
    WorkspaceId,
}

#[derive(DeriveIden)]
enum AgentRuns {
    Table,
    WorkspaceId,
}

#[derive(DeriveIden)]
enum AgentSessions {
    Table,
    WorkspaceId,
}

#[derive(DeriveIden)]
enum AgentTasks {
    Table,
    WorkspaceId,
}

#[derive(DeriveIden)]
enum StoredFiles {
    Table,
    WorkspaceId,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Workspaces::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Workspaces::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Workspaces::Slug).string().not_null())
                    .col(ColumnDef::new(Workspaces::Name).string().not_null())
                    .col(ColumnDef::new(Workspaces::RootPath).string().not_null())
                    .col(
                        ColumnDef::new(Workspaces::Source)
                            .string()
                            .not_null()
                            .default("conversation_backfill"),
                    )
                    .col(ColumnDef::new(Workspaces::Description).text().null())
                    .col(ColumnDef::new(Workspaces::CreatedAt).string().not_null())
                    .col(ColumnDef::new(Workspaces::UpdatedAt).string().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_workspaces_slug")
                    .table(Workspaces::Table)
                    .col(Workspaces::Slug)
                    .unique()
                    .to_owned(),
            )
            .await?;

        if !manager
            .has_column(Conversations::Table.to_string(), Conversations::WorkspaceId.to_string())
            .await?
        {
            manager
                .alter_table(
                    Table::alter()
                        .table(Conversations::Table)
                        .add_column(ColumnDef::new(Conversations::WorkspaceId).string().null())
                        .to_owned(),
                )
                .await?;
        }

        if !manager
            .has_column(AgentProfiles::Table.to_string(), AgentProfiles::WorkspaceId.to_string())
            .await?
        {
            manager
                .alter_table(
                    Table::alter()
                        .table(AgentProfiles::Table)
                        .add_column(ColumnDef::new(AgentProfiles::WorkspaceId).string().null())
                        .to_owned(),
                )
                .await?;
        }

        if !manager
            .has_column(AgentRuns::Table.to_string(), AgentRuns::WorkspaceId.to_string())
            .await?
        {
            manager
                .alter_table(
                    Table::alter()
                        .table(AgentRuns::Table)
                        .add_column(ColumnDef::new(AgentRuns::WorkspaceId).string().null())
                        .to_owned(),
                )
                .await?;
        }

        if !manager
            .has_column(AgentSessions::Table.to_string(), AgentSessions::WorkspaceId.to_string())
            .await?
        {
            manager
                .alter_table(
                    Table::alter()
                        .table(AgentSessions::Table)
                        .add_column(ColumnDef::new(AgentSessions::WorkspaceId).string().null())
                        .to_owned(),
                )
                .await?;
        }

        if !manager
            .has_column(AgentTasks::Table.to_string(), AgentTasks::WorkspaceId.to_string())
            .await?
        {
            manager
                .alter_table(
                    Table::alter()
                        .table(AgentTasks::Table)
                        .add_column(ColumnDef::new(AgentTasks::WorkspaceId).string().null())
                        .to_owned(),
                )
                .await?;
        }

        if !manager
            .has_column(StoredFiles::Table.to_string(), StoredFiles::WorkspaceId.to_string())
            .await?
        {
            manager
                .alter_table(
                    Table::alter()
                        .table(StoredFiles::Table)
                        .add_column(ColumnDef::new(StoredFiles::WorkspaceId).string().null())
                        .to_owned(),
                )
                .await?;
        }

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_conversations_workspace_id")
                    .table(Conversations::Table)
                    .col(Conversations::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_profiles_workspace_id")
                    .table(AgentProfiles::Table)
                    .col(AgentProfiles::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_runs_workspace_id")
                    .table(AgentRuns::Table)
                    .col(AgentRuns::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_sessions_workspace_id")
                    .table(AgentSessions::Table)
                    .col(AgentSessions::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_tasks_workspace_id")
                    .table(AgentTasks::Table)
                    .col(AgentTasks::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_stored_files_workspace_id")
                    .table(StoredFiles::Table)
                    .col(StoredFiles::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        for (table, index_name) in [
            (StoredFiles::Table.to_string(), "idx_stored_files_workspace_id"),
            (AgentTasks::Table.to_string(), "idx_agent_tasks_workspace_id"),
            (
                AgentSessions::Table.to_string(),
                "idx_agent_sessions_workspace_id",
            ),
            (AgentRuns::Table.to_string(), "idx_agent_runs_workspace_id"),
            (
                AgentProfiles::Table.to_string(),
                "idx_agent_profiles_workspace_id",
            ),
            (
                Conversations::Table.to_string(),
                "idx_conversations_workspace_id",
            ),
        ] {
            manager
                .drop_index(
                    Index::drop()
                        .if_exists()
                        .name(index_name)
                        .table(Alias::new(table))
                        .to_owned(),
                )
                .await?;
        }

        for (table, column) in [
            (StoredFiles::Table.to_string(), StoredFiles::WorkspaceId.to_string()),
            (AgentTasks::Table.to_string(), AgentTasks::WorkspaceId.to_string()),
            (
                AgentSessions::Table.to_string(),
                AgentSessions::WorkspaceId.to_string(),
            ),
            (AgentRuns::Table.to_string(), AgentRuns::WorkspaceId.to_string()),
            (
                AgentProfiles::Table.to_string(),
                AgentProfiles::WorkspaceId.to_string(),
            ),
            (
                Conversations::Table.to_string(),
                Conversations::WorkspaceId.to_string(),
            ),
        ] {
            if manager.has_column(&table, &column).await? {
                manager
                    .alter_table(
                        Table::alter()
                            .table(Alias::new(table))
                            .drop_column(Alias::new(column))
                            .to_owned(),
                    )
                    .await?;
            }
        }

        manager
            .drop_index(
                Index::drop()
                    .if_exists()
                    .name("idx_workspaces_slug")
                    .table(Workspaces::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(Workspaces::Table).to_owned())
            .await?;

        Ok(())
    }
}
