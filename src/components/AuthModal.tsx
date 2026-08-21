import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { X, User, LogOut } from 'lucide-react';

export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const { user, signInWithGoogle, logout } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName, photoURL });
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      let errorMsg = 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      if (error.code === 'auth/invalid-credential') {
        errorMsg = 'Email hoặc mật khẩu không chính xác.';
      } else if (error.code === 'auth/user-not-found') {
        errorMsg = 'Tài khoản không tồn tại.';
      } else if (error.code === 'auth/wrong-password') {
        errorMsg = 'Mật khẩu không chính xác.';
      }
      alert(errorMsg + '\nChi tiết: ' + (error.message || error));
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      onClose();
    } catch (error) {
      // Error is handled in signInWithGoogle
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleUpdateProfile = async () => {
    if (user) {
      await updateProfile(user, { displayName, photoURL });
      alert('Profile updated');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[#141414] p-8 rounded-xl w-full max-w-md border border-gray-800 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full">
          <X size={20} />
        </button>
        {user ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border-2 border-[#E50914]">
                {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover"/> : <User size={40} className="text-gray-400" />}
              </div>
              <h2 className="text-xl font-bold">{user.displayName || 'Người dùng'}</h2>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Tên hiển thị"
                className="w-full p-3 bg-white/5 border border-gray-700 rounded-lg focus:border-[#E50914] outline-none transition"
                value={displayName || user.displayName || ''}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Ảnh đại diện URL"
                className="w-full p-3 bg-white/5 border border-gray-700 rounded-lg focus:border-[#E50914] outline-none transition"
                value={photoURL || user.photoURL || ''}
                onChange={(e) => setPhotoURL(e.target.value)}
              />
              <button onClick={handleUpdateProfile} className="w-full bg-[#E50914] hover:bg-red-700 p-3 rounded-lg font-bold transition">
                Cập nhật hồ sơ
              </button>
              <button onClick={handleLogout} className="w-full p-3 rounded-lg font-bold bg-white/5 hover:bg-white/10 transition">
                Đăng xuất
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center">{isLogin ? 'Đăng nhập' : 'Đăng ký'}</h2>
            <button 
              onClick={handleGoogleSignIn}
              className="w-full mb-6 flex items-center justify-center gap-3 bg-white text-black p-3 rounded-lg font-bold hover:bg-gray-200 transition"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Tiếp tục với Google
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#141414] px-2 text-gray-500">Hoặc</span></div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 bg-white/5 border border-gray-700 rounded-lg focus:border-[#E50914] outline-none transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Mật khẩu"
                className="w-full p-3 bg-white/5 border border-gray-700 rounded-lg focus:border-[#E50914] outline-none transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {!isLogin && (
                <>
                  <input
                    type="text"
                    placeholder="Tên hiển thị"
                    className="w-full p-3 bg-white/5 border border-gray-700 rounded-lg focus:border-[#E50914] outline-none transition"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Ảnh đại diện URL"
                    className="w-full p-3 bg-white/5 border border-gray-700 rounded-lg focus:border-[#E50914] outline-none transition"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                  />
                </>
              )}
              <button type="submit" className="w-full bg-[#E50914] hover:bg-red-700 p-3 rounded-lg font-bold transition">
                {isLogin ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            </form>
            <button className="mt-4 text-sm text-gray-400 text-center w-full hover:text-white" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
