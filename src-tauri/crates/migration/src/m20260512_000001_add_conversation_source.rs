use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Conversations {
    Table,
    Source,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        if !manager.has_column("conversations", "source").await? {
            manager
                .alter_table(
                    Table::alter()
                        .table(Conversations::Table)
                        .add_column(
                            ColumnDef::new(Conversations::Source)
                                .string()
                                .not_null()
                                .default("chat"),
                        )
                        .to_owned(),
                )
                .await?;
        }
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        if manager.has_column("conversations", "source").await? {
            manager
                .alter_table(
                    Table::alter()
                        .table(Conversations::Table)
                        .drop_column(Conversations::Source)
                        .to_owned(),
                )
                .await?;
        }
        Ok(())
    }
}
