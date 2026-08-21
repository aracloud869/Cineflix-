import React, { useState } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const AdminPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [movieId, setMovieId] = useState('');
  const [subtitleName, setSubtitleName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleAddSubtitle = async () => {
    if (!movieId || !subtitleName || !file) return;

    if (file.size > 7 * 1024 * 1024) {
      alert('File quá lớn! Vui lòng chọn file dưới 7MB.');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `subtitles/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'subtitles'), {
        movieId,
        name: subtitleName,
        fileUrl,
        addedAt: new Date()
      });
      alert('Subtitle added!');
      onClose();
    } catch (error) {
      console.error('Error uploading subtitle:', error);
      alert('Có lỗi xảy ra khi upload.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#141414] p-8 rounded-lg w-full max-w-md border border-gray-800">
        <h2 className="text-2xl font-bold mb-4">Admin: Thêm Subtitle</h2>
        <input placeholder="Movie ID" className="p-3 bg-white/10 rounded w-full mb-2" value={movieId} onChange={(e) => setMovieId(e.target.value)} />
        <input placeholder="Subtitle Name" className="p-3 bg-white/10 rounded w-full mb-2" value={subtitleName} onChange={(e) => setSubtitleName(e.target.value)} />
        <input type="file" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="p-3 bg-white/10 rounded w-full mb-4" accept=".vtt,.srt" />
        <button onClick={handleAddSubtitle} disabled={uploading} className="bg-[#E50914] p-3 rounded font-bold w-full disabled:opacity-50">
          {uploading ? 'Đang tải lên...' : 'Thêm'}
        </button>
        <button onClick={onClose} className="mt-2 text-gray-400">Đóng</button>
      </div>
    </div>
  );
};
