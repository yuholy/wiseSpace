use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
#[allow(dead_code)]
enum WorkspaceMcpBindings {
    Table,
    Id,
    WorkspaceId,
    ServerId,
    Enabled,
    SortOrder,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
#[allow(dead_code)]
enum WorkspaceKnowledgeBindings {
    Table,
    Id,
    WorkspaceId,
    KnowledgeBaseId,
    Enabled,
    SortOrder,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
#[allow(dead_code)]
enum WorkspaceMemoryBindings {
    Table,
    Id,
    WorkspaceId,
    MemoryNamespaceId,
    Enabled,
    SortOrder,
    CreatedAt,
    UpdatedAt,
}

fn binding_table_create(
    table: impl Iden + 'static,
    id: impl Iden + 'static,
    workspace_id: impl Iden + 'static,
    target_id: impl Iden + 'static,
) -> TableCreateStatement {
    Table::create()
        .table(table)
        .if_not_exists()
        .col(ColumnDef::new(id).string().not_null().primary_key())
        .col(ColumnDef::new(workspace_id).string().not_null())
        .col(ColumnDef::new(target_id).string().not_null())
        .col(ColumnDef::new(Alias::new("enabled")).integer().not_null().default(1))
        .col(
            ColumnDef::new(Alias::new("sort_order"))
                .integer()
                .not_null()
                .default(0),
        )
        .col(ColumnDef::new(Alias::new("created_at")).string().not_null())
        .col(ColumnDef::new(Alias::new("updated_at")).string().not_null())
        .to_owned()
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(binding_table_create(
                WorkspaceMcpBindings::Table,
                WorkspaceMcpBindings::Id,
                WorkspaceMcpBindings::WorkspaceId,
                WorkspaceMcpBindings::ServerId,
            ))
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_workspace_mcp_bindings_workspace_id")
                    .table(WorkspaceMcpBindings::Table)
                    .col(WorkspaceMcpBindings::WorkspaceId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("uq_workspace_mcp_bindings_workspace_server")
                    .table(WorkspaceMcpBindings::Table)
                    .col(WorkspaceMcpBindings::WorkspaceId)
                    .col(WorkspaceMcpBindings::ServerId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(binding_table_create(
                WorkspaceKnowledgeBindings::Table,
                WorkspaceKnowledgeBindings::Id,
                WorkspaceKnowledgeBindings::WorkspaceId,
                WorkspaceKnowledgeBindings::KnowledgeBaseId,
            ))
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_workspace_knowledge_bindings_workspace_id")
                    .table(WorkspaceKnowledgeBindings::Table)
                    .col(WorkspaceKnowledgeBindings::WorkspaceId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("uq_workspace_knowledge_bindings_workspace_knowledge")
                    .table(WorkspaceKnowledgeBindings::Table)
                    .col(WorkspaceKnowledgeBindings::WorkspaceId)
                    .col(WorkspaceKnowledgeBindings::KnowledgeBaseId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(binding_table_create(
                WorkspaceMemoryBindings::Table,
                WorkspaceMemoryBindings::Id,
                WorkspaceMemoryBindings::WorkspaceId,
                WorkspaceMemoryBindings::MemoryNamespaceId,
            ))
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_workspace_memory_bindings_workspace_id")
                    .table(WorkspaceMemoryBindings::Table)
                    .col(WorkspaceMemoryBindings::WorkspaceId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("uq_workspace_memory_bindings_workspace_memory")
                    .table(WorkspaceMemoryBindings::Table)
                    .col(WorkspaceMemoryBindings::WorkspaceId)
                    .col(WorkspaceMemoryBindings::MemoryNamespaceId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        for (table, indexes) in [
            (
                WorkspaceMemoryBindings::Table.to_string(),
                vec![
                    "idx_workspace_memory_bindings_workspace_id",
                    "uq_workspace_memory_bindings_workspace_memory",
                ],
            ),
            (
                WorkspaceKnowledgeBindings::Table.to_string(),
                vec![
                    "idx_workspace_knowledge_bindings_workspace_id",
                    "uq_workspace_knowledge_bindings_workspace_knowledge",
                ],
            ),
            (
                WorkspaceMcpBindings::Table.to_string(),
                vec![
                    "idx_workspace_mcp_bindings_workspace_id",
                    "uq_workspace_mcp_bindings_workspace_server",
                ],
            ),
        ] {
            for index_name in indexes {
                manager
                    .drop_index(
                        Index::drop()
                            .if_exists()
                            .name(index_name)
                            .table(Alias::new(table.clone()))
                            .to_owned(),
                    )
                    .await?;
            }

            manager
                .drop_table(Table::drop().table(Alias::new(table)).to_owned())
                .await?;
        }

        Ok(())
    }
}
