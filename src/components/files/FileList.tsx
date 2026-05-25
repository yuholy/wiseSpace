/** FileList renders file rows in an antd Table with built-in multi-column sorting. */

import { useEffect, useState } from 'react';
import { Button, Empty, Image, Popconfirm, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExternalLink, FolderOpen, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@/lib/invoke';
import type { FileCategory, FileRow } from '@/types';

interface FileListProps {
  rows?: FileRow[];
  category?: FileCategory;
  selectedRowKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  onOpen?: (path: string) => void;
  onReveal?: (path: string) => void;
  onDelete?: (id: string) => void;
}

function formatSize(bytes?: number): string {
  if (bytes == null) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function useThumbnailSrc(storagePath: string | undefined, missing: boolean | undefined): string | undefined {
  const [src, setSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!storagePath || missing) return;
    let cancelled = false;
    invoke<string>('read_attachment_preview', { filePath: storagePath })
      .then((dataUrl) => { if (!cancelled) setSrc(dataUrl); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storagePath, missing]);
  return src;
}

function ImageThumbnail({ record }: { record: FileRow }) {
  const { token } = theme.useToken();
  const src = useThumbnailSrc(record.storagePath, record.missing);
  return (
    <div
      className="h-10 w-10 overflow-hidden rounded-md border flex items-center justify-center"
      style={{
        borderColor: token.colorBorderSecondary,
        backgroundColor: src ? token.colorBgContainer : token.colorFillQuaternary,
      }}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={40}
          height={40}
          style={{ objectFit: 'cover' }}
          preview={{ mask: { blur: true }, scaleStep: 0.5 }}
        />
      ) : (
        <ImageIcon size={16} style={{ color: token.colorTextSecondary }} />
      )}
    </div>
  );
}

function sourceKindLabel(
  sourceKind: string | undefined,
  labels: { attachment: string; backup: string },
) {
  switch (sourceKind) {
    case 'backup_manifest':
      return labels.backup;
    case 'attachment':
    default:
      return labels.attachment;
  }
}

export function FileList({
  rows = [],
  category,
  selectedRowKeys = [],
  onSelectionChange,
  onOpen,
  onReveal,
  onDelete,
}: FileListProps) {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const showThumbnails = category === 'images';
  const tableMinWidth = showThumbnails ? 1180 : 1120;
  const sourceLabels = {
    attachment: t('files.sourceAttachment', 'Attachment'),
    backup: t('files.sourceBackup', 'Backup'),
  };

  const columns: ColumnsType<FileRow> = [];

  if (showThumbnails) {
    columns.push({
      title: '',
      key: 'thumbnail',
      width: 56,
      render: (_: unknown, record: FileRow) => <ImageThumbnail record={record} />,
    });
  }

  columns.push(
    {
      title: t('files.columnName'),
      dataIndex: 'name',
      key: 'name',
      width: 260,
      sorter: { compare: (a, b) => a.name.localeCompare(b.name), multiple: 1 },
      ellipsis: true,
      render: (name: string) => (
        <span className="text-sm font-medium" title={name}>{name}</span>
      ),
    },
    {
      title: t('files.columnWorkspace', 'Workspace'),
      dataIndex: 'workspaceName',
      key: 'workspaceName',
      width: 220,
      sorter: { compare: (a, b) => (a.workspaceName ?? '').localeCompare(b.workspaceName ?? ''), multiple: 2 },
      render: (workspaceName: string | undefined | null) => (
        workspaceName ? (
          <Tooltip title={workspaceName}>
            <div style={{ minWidth: 0 }}>
              <Typography.Text
                ellipsis={{ tooltip: false }}
                style={{
                  display: 'inline-block',
                  maxWidth: '100%',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: token.colorFillSecondary,
                  color: token.colorText,
                  fontSize: 12,
                  lineHeight: '20px',
                }}
              >
                {workspaceName}
              </Typography.Text>
            </div>
          </Tooltip>
        ) : <span style={{ color: token.colorTextQuaternary }}>-</span>
      ),
    },
    {
      title: t('files.columnSize'),
      dataIndex: 'size',
      key: 'size',
      width: 100,
      sorter: { compare: (a, b) => (a.size ?? 0) - (b.size ?? 0), multiple: 3 },
      render: (size: number | undefined) => (
        <span className="text-xs" style={{ color: token.colorTextSecondary }}>{formatSize(size)}</span>
      ),
    },
    {
      title: t('files.columnCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: { compare: (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''), multiple: 4 },
      defaultSortOrder: 'descend',
      render: (date: string | undefined) => (
        <span className="text-xs" style={{ color: token.colorTextSecondary }}>{date ?? '-'}</span>
      ),
    },
    {
      title: t('files.columnSource', 'Source'),
      dataIndex: 'sourceKind',
      key: 'sourceKind',
      width: 96,
      render: (sourceKind: string | undefined) => (
        <Tag bordered={false}>{sourceKindLabel(sourceKind, sourceLabels)}</Tag>
      ),
    },
    {
      title: t('files.columnActions'),
      key: 'actions',
      width: 132,
      fixed: 'right',
      render: (_: unknown, record: FileRow) => {
        if (record.missing) {
          return (
            <span className="flex items-center gap-1">
              {onDelete && (
                <Popconfirm
                  title={t('files.deleteConfirm')}
                  onConfirm={() => onDelete(record.id)}
                  okText={t('files.confirmYes')}
                  cancelText={t('files.confirmNo')}
                >
                  <Tooltip title={t('files.delete')}>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      aria-label={`${t('files.delete')} ${record.name}`}
                    />
                  </Tooltip>
                </Popconfirm>
              )}
              <Tag color="error" bordered={false}>{t('files.missing')}</Tag>
            </span>
          );
        }
        return (
          <span className="flex items-center gap-0.5">
            {onOpen && record.path && (
              <Tooltip title={t('files.open')}>
                <Button
                  type="text"
                  size="small"
                  icon={<ExternalLink size={14} />}
                  onClick={() => onOpen(record.path)}
                  aria-label={`${t('files.open')} ${record.name}`}
                />
              </Tooltip>
            )}
            {onReveal && record.path && (
              <Tooltip title={t('files.openOriginalDirectory', 'Open folder')}>
                <Button
                  type="text"
                  size="small"
                  icon={<FolderOpen size={14} />}
                  onClick={() => onReveal(record.path)}
                  aria-label={`${t('files.openOriginalDirectory', 'Open folder')} ${record.name}`}
                />
              </Tooltip>
            )}
            {onDelete && (
              <Popconfirm
                title={t('files.deleteConfirm')}
                onConfirm={() => onDelete(record.id)}
                okText={t('files.confirmYes')}
                cancelText={t('files.confirmNo')}
              >
                <Tooltip title={t('files.delete')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    aria-label={`${t('files.delete')} ${record.name}`}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </span>
        );
      },
    },
  );

  return (
    <Table<FileRow>
      data-testid="file-list"
      dataSource={rows}
      columns={columns}
      rowKey="id"
      size="small"
      scroll={{ x: tableMinWidth }}
      rowSelection={{
        selectedRowKeys,
        onChange: (keys) => onSelectionChange?.(keys as string[]),
      }}
      pagination={{
        defaultPageSize: 15,
        showSizeChanger: true,
        pageSizeOptions: ['15', '30', '50'],
        showTotal: (total) => t('files.totalItems', { total }),
      }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('files.empty')} /> }}
    />
  );
}
