import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA2884RH2sOARsRAqChEQ0XzFS5VRXIFJQ",
  authDomain: "cineflix-aaa32.firebaseapp.com",
  databaseURL: "https://cineflix-aaa32-default-rtdb.firebaseio.com",
  projectId: "cineflix-aaa32",
  storageBucket: "cineflix-aaa32.firebasestorage.app",
  messagingSenderId: "1079426419467",
  appId: "1:1079426419467:web:caeaf7ab3f3edeb4a8b00e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
