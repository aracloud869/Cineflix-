import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Comment } from '../types';

export const saveSubtitle = async (movieId: string, name: string, fileUrl: string, userId: string, fileContent?: string) => {
  try {
    await addDoc(collection(db, 'subtitles'), {
      movieId,
      name,
      fileUrl,
      fileContent,
      addedBy: userId,
      addedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    console.error("Lỗi Firestore saveSubtitle:", error);
    throw error;
  }
};

export const getSubtitles = async (movieId: string) => {
  try {
    const q = query(collection(db, 'subtitles'), where('movieId', '==', movieId));
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Manual sort instead of Firestore sort to avoid Index requirement
    return results.sort((a: any, b: any) => {
      const dateA = a.addedAt?.seconds ? a.addedAt.seconds : (a.addedAt instanceof Date ? a.addedAt.getTime() : 0);
      const dateB = b.addedAt?.seconds ? b.addedAt.seconds : (b.addedAt instanceof Date ? b.addedAt.getTime() : 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting subtitles:", error);
    return [];
  }
};

export const saveComment = async (movieId: string, userId: string, userName: string, userAvatar: string, text: string) => {
  try {
    await addDoc(collection(db, 'comments'), {
      movieId,
      userId,
      userName,
      userAvatar,
      text,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error("Error saving comment:", error);
  }
};

export const getComments = async (movieId: string): Promise<Comment[]> => {
  try {
    const q = query(collection(db, 'comments'), where('movieId', '==', movieId));
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
    // Manual sort instead of Firestore sort to avoid Index requirement
    return results.sort((a, b) => {
      const dateA = (a as any).createdAt?.seconds ? (a as any).createdAt.seconds : (a.createdAt || 0);
      const dateB = (b as any).createdAt?.seconds ? (b as any).createdAt.seconds : (b.createdAt || 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting comments:", error);
    return [];
  }
};

export const saveWatchedMovie = async (userId: string, movie: any) => {
  const userRef = doc(db, 'users', userId);
  
  // Sanitize: remove undefined values
  const cleanMovie = Object.fromEntries(
    Object.entries(movie).filter(([_, v]) => v !== undefined)
  );

  try {
    // Using setDoc with merge: true is a more robust "upsert" pattern
    // It creates the document if it doesn't exist, and merges if it does.
    await setDoc(userRef, {
      watched: arrayUnion(cleanMovie)
    }, { merge: true });
  } catch (error) {
    console.error("Error saving watched movie:", error);
  }
};

export const getWatchedMovies = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data().watched || [];
    }
    return [];
  } catch (error: any) {
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      console.warn("Firestore is offline, returning empty list.");
    } else {
      console.error("Error getting watched movies:", error);
    }
    return [];
  }
};
