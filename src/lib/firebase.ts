import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function initializeFirebase() {
  try {
    // Check if we have valid credentials or if it's still placeholders
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('TODO')) {
      console.error('Firebase Error: Invalid API Key in firebase-applet-config.json. Please provide your real Firebase credentials.');
      // return nulls or dummy objects to prevent total crash
      return { app: null, db: null as any, auth: null as any };
    }
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    const auth = getAuth(app);
    return { app, db, auth };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return { app: null, db: null as any, auth: null as any };
  }
}

const { db, auth } = initializeFirebase();
export { db, auth };
