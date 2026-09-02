import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyBn_zDrhmWeIJ4UfAaTpkPIHKqjyBwpRj0",
  authDomain: "janarty-s.firebaseapp.com",
  projectId: "janarty-s",
  storageBucket: "janarty-s.firebasestorage.app",
  messagingSenderId: "716339529146",
  appId: "1:716339529146:web:8f7715a3d84f5837df8983",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
