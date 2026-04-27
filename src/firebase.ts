import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_wHfYp597ba__EfWRfedubYsPtSEVPLs",
  authDomain: "fire-joan-toni.firebaseapp.com",
  projectId: "fire-joan-toni",
  storageBucket: "fire-joan-toni.firebasestorage.app",
  messagingSenderId: "946433827275",
  appId: "1:946433827275:web:b053e518388f678024564e"
};

// Inicializamos la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Exportamos la base de datos (Firestore) para poder usarla en nuestra web
export const db = getFirestore(app);