import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Comment } from '../types';

export const saveSubtitle = async (movieId: string, name: string, fileUrl: string) => {
  await addDoc(collection(db, 'subtitles'), {
    movieId,
    name,
    fileUrl,
    addedAt: new Date()
  });
};

export const getSubtitles = async (movieId: string) => {
  const q = query(collection(db, 'subtitles'), where('movieId', '==', movieId), orderBy('addedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const q = query(collection(db, 'comments'), where('movieId', '==', movieId), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
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
    await updateDoc(userRef, {
      watched: arrayUnion(cleanMovie)
    });
  } catch (error) {
    console.error("Error updating watched movie, attempting setDoc:", error);
    await setDoc(userRef, { watched: [cleanMovie] }, { merge: true });
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
