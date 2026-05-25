use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
#[allow(dead_code)]
enum AgentTasks {
    Table,
    ParentRunId,
    ParentTaskId,
    AssigneeKind,
    AssigneeLabel,
    DelegationDepth,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        for (column_name, sql) in [
            (
                "parent_run_id",
                "ALTER TABLE agent_tasks ADD COLUMN parent_run_id TEXT NULL",
            ),
            (
                "parent_task_id",
                "ALTER TABLE agent_tasks ADD COLUMN parent_task_id TEXT NULL",
            ),
            (
                "assignee_kind",
                "ALTER TABLE agent_tasks ADD COLUMN assignee_kind TEXT NOT NULL DEFAULT 'external_agent'",
            ),
            (
                "assignee_label",
                "ALTER TABLE agent_tasks ADD COLUMN assignee_label TEXT NULL",
            ),
            (
                "delegation_depth",
                "ALTER TABLE agent_tasks ADD COLUMN delegation_depth INTEGER NOT NULL DEFAULT 0",
            ),
        ] {
            if !manager.has_column("agent_tasks", column_name).await? {
                manager
                    .get_connection()
                    .execute_unprepared(sql)
                    .await?;
            }
        }

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_tasks_parent_run")
                    .table(AgentTasks::Table)
                    .col(AgentTasks::ParentRunId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_tasks_parent_task")
                    .table(AgentTasks::Table)
                    .col(AgentTasks::ParentTaskId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        for index_name in ["idx_agent_tasks_parent_task", "idx_agent_tasks_parent_run"] {
            manager
                .drop_index(
                    Index::drop()
                        .if_exists()
                        .name(index_name)
                        .table(AgentTasks::Table)
                        .to_owned(),
                )
                .await?;
        }

        Ok(())
    }
}
