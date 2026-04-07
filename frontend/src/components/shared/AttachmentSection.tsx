import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Upload, Camera, Trash2, Download, FileText, Image, File } from 'lucide-react';

interface Attachment {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  created_at: string;
}

interface AttachmentSectionProps {
  refType: 'INSPECTION' | 'WORK_ORDER' | 'LOT' | 'SHIPMENT';
  refId: number;
  printMode?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/');
}

export function AttachmentSection({ refType, refId, printMode = false }: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = () => {
    api.get<{ data: Attachment[] }>(`/attachments?ref_type=${refType}&ref_id=${refId}`)
      .then((res) => setAttachments(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    if (refId) fetchAttachments();
  }, [refType, refId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ref_type', refType);
        formData.append('ref_id', String(refId));
        await fetch('/api/attachments', { method: 'POST', body: formData });
      }
      fetchAttachments();
    } catch {
      alert('파일 업로드 실패');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`"${attachment.file_name}" 파일을 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/attachments/${attachment.attachment_id}`);
      fetchAttachments();
    } catch {
      alert('삭제 실패');
    }
  };

  const imageAttachments = attachments.filter((a) => isImageFile(a.file_type));
  const otherAttachments = attachments.filter((a) => !isImageFile(a.file_type));

  // Print mode: show images only
  if (printMode) {
    if (imageAttachments.length === 0) return null;
    return (
      <div className="mt-6">
        <h3 className="text-sm font-bold mb-2">첨부 사진</h3>
        <div className="grid grid-cols-3 gap-2">
          {imageAttachments.map((a) => (
            <div key={a.attachment_id} className="border rounded overflow-hidden">
              <img src={a.file_url} alt={a.file_name} className="w-full h-32 object-cover" />
              <div className="px-2 py-1 text-xs text-gray-500 truncate">{a.file_name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-shop-sm font-medium text-gray-700">
          첨부파일 ({attachments.length})
        </h3>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Camera size={14} /> 촬영
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload size={14} /> {uploading ? '업로드 중...' : '파일 선택'}
          </button>
        </div>
      </div>

      {attachments.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-xs">
          첨부된 파일이 없습니다.
        </div>
      ) : (
        <>
          {/* Image thumbnails - grid layout */}
          {imageAttachments.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {imageAttachments.map((a) => (
                <div key={a.attachment_id} className="group relative border rounded overflow-hidden bg-gray-50">
                  <img src={a.file_url} alt={a.file_name} className="w-full h-24 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <a href={a.file_url} download={a.file_name}
                      className="p-1.5 bg-white rounded-full mr-1 hover:bg-gray-100">
                      <Download size={12} />
                    </a>
                    <button onClick={() => handleDelete(a)}
                      className="p-1.5 bg-white rounded-full hover:bg-red-50">
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  </div>
                  <div className="px-1.5 py-1 text-[10px] text-gray-500 truncate">{a.file_name}</div>
                  <div className="px-1.5 pb-1 text-[10px] text-gray-400">{formatFileSize(a.file_size)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Other files - list layout */}
          {otherAttachments.length > 0 && (
            <div className="space-y-1">
              {otherAttachments.map((a) => (
                <div key={a.attachment_id}
                  className="flex items-center justify-between px-3 py-2 border rounded hover:bg-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.file_type === 'application/pdf' ? (
                      <FileText size={16} className="text-red-500 flex-shrink-0" />
                    ) : (
                      <File size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs truncate">{a.file_name}</div>
                      <div className="text-[10px] text-gray-400">{formatFileSize(a.file_size)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <a href={a.file_url} download={a.file_name}
                      className="p-1.5 rounded hover:bg-gray-200">
                      <Download size={14} className="text-gray-500" />
                    </a>
                    <button onClick={() => handleDelete(a)}
                      className="p-1.5 rounded hover:bg-red-50">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
