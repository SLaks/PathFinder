import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { firebaseConfig } from "./credentials";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and sign in anonymously
export const auth = getAuth(app);

// Keep track of the initialization promise so we can wait for auth before making API calls
export const ensureAuthenticated = async () => {
  if (auth.currentUser) return auth.currentUser;
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error("Anonymous sign-in failed:", error);
    throw error;
  }
};

// Initialize the AI service using Vertex AI backend
export const ai = getAI(app, {
  backend: new GoogleAIBackend(),
});
