import { useEffect, useState, useCallback } from 'react';
import { Alert, Button, Input, App, Popconfirm, Select, Space } from 'antd';
import { Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FILE_CATEGORIES, type FileCategory } from './fileCategories';
import { FileList } from './FileList';
import { useFileStore } from '@/stores/fileStore';

interface FilesContentProps {
  activeCategory: FileCategory;
}

export function FilesContent({ activeCategory }: FilesContentProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const meta = FILE_CATEGORIES.find((c) => c.id === activeCategory);
  if (!meta) {
    throw new Error(`Unhandled file category: ${activeCategory}`);
  }

  const {
    search,
    error,
    loadCategory,
    setSearch,
    setSortKey,
    clearError,
    openEntry,
    revealEntry,
    cleanupMissingEntry,
    workspaceFilter,
    setWorkspaceFilter,
    getWorkspaceOptions,
    getVisibleRows,
  } =
    useFileStore();

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  useEffect(() => {
    setSearch('');
    setSortKey('createdAt');
    setSelectedRowKeys([]);
    setWorkspaceFilter('all');
    void loadCategory(activeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    void loadCategory(activeCategory);
  };

  const handleBatchDelete = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      for (const key of selectedRowKeys) {
        await cleanupMissingEntry(key);
      }
      setSelectedRowKeys([]);
      message.success(t('files.batchDeleteSuccess', { count: selectedRowKeys.length }));
      void loadCategory(activeCategory);
    } catch (e) {
      message.error(String(e));
    }
  }, [selectedRowKeys, activeCategory, loadCategory, cleanupMissingEntry, message, t]);

  const handleDeleteEntry = useCallback(async (id: string) => {
    try {
      await cleanupMissingEntry(id);
      setSelectedRowKeys((prev) => prev.filter((k) => k !== id));
      message.success(t('files.deleteSuccess'));
      void loadCategory(activeCategory);
    } catch (e) {
      message.error(String(e));
    }
  }, [activeCategory, loadCategory, cleanupMissingEntry, message, t]);

  const workspaceOptions = getWorkspaceOptions();
  const filteredRows = getVisibleRows();

  return (
    <div
      data-testid="files-content"
      data-category={activeCategory}
      className="h-full px-2 pt-0 pb-4 flex flex-col gap-3"
    >
      {error !== null && (
        <Alert
          data-testid="files-error-alert"
          type="error"
          message={error}
          closable
          onClose={clearError}
        />
      )}

      {/* Toolbar: batch delete (left) + search (right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Space>
          <Popconfirm
            title={t('files.batchDeleteConfirm', { count: selectedRowKeys.length })}
            onConfirm={() => void handleBatchDelete()}
            okText={t('files.confirmYes')}
            cancelText={t('files.confirmNo')}
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              danger
              icon={<Trash2 size={14} />}
              disabled={selectedRowKeys.length === 0}
            >
              {t('files.batchDelete', { count: selectedRowKeys.length })}
            </Button>
          </Popconfirm>
        </Space>
        <Space wrap>
          <Select
            value={workspaceFilter}
            onChange={setWorkspaceFilter}
            style={{ minWidth: 180 }}
            options={[
              { value: 'all', label: t('files.allWorkspaces', { defaultValue: 'All workspaces' }) },
              ...workspaceOptions,
            ]}
            disabled={workspaceOptions.length === 0}
          />
          <div data-testid="category-search" data-category={activeCategory} style={{ maxWidth: 300 }}>
            <Input
              prefix={<Search size={14} />}
              placeholder={t('files.searchPlaceholder', { category: t(meta.labelKey) })}
              value={search}
              onChange={(e) => {
                handleSearchChange(e.target.value);
              }}
              allowClear
            />
          </div>
        </Space>
      </div>

      <FileList
        rows={filteredRows}
        category={activeCategory}
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={setSelectedRowKeys}
        onOpen={(path) => void openEntry(path)}
        onReveal={(path) => void revealEntry(path)}
        onDelete={(id) => void handleDeleteEntry(id)}
      />
    </div>
  );
}
