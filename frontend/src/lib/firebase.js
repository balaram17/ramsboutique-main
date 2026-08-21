import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Log configuration variables to your console to debug values immediately
console.log("Firebase API Key Target:", process.env.REACT_APP_FIREBASE_API_KEY || import.meta.env?.VITE_FIREBASE_API_KEY);

const firebaseConfig = {
  // This syntax checks both Create-React-App and Vite engines automatically
  apiKey: "AIzaSyDvc6Zvqh92JfOESlF1hE3gfG_UoyxTLac",
  authDomain: "rams-boutique-auth.firebaseapp.com",
  projectId: "rams-boutique-auth",
  storageBucket: "rams-boutique-auth.firebasestorage.app",
  messagingSenderId: "473820888026",
  appId: "1:473820888026:web:6c1ba3a1898da249c51ee3"
};

// Fail-safe block to prevent app from crashing if configuration fails
let app;
let auth;

try {
  if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing! Please verify your local .env configuration mappings.");
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Firebase failed to initialize cleanly:", error);
}

export { auth };
