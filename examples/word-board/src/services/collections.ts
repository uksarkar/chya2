import {
  addDoc,
  collection,
  doc,
  query,
  updateDoc,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
  CollectionReference
} from "firebase/firestore";
import { db } from "./firebase";
import { endOfDay, startOfDay } from "date-fns";
import { user } from "../hooks/auth";

// ---------------------------------------------
// TYPES
// ---------------------------------------------
export interface Word {
  id?: string;
  word: string;
  userId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Prediction {
  id?: string;
  word_id: string;
  count: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  userId?: string;
  userName?: string;
}

export interface Vote {
  id?: string;
  prediction_id: string;
  value: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  userId?: string;
}

export interface Participant {
  id: string;
  displayName: string;
}

// ---------------------------------------------
// COLLECTION REFERENCES
// ---------------------------------------------
const collectionWords = collection(db, "words") as CollectionReference<Word>;
const collectionPredictions = collection(
  db,
  "predictions"
) as CollectionReference<Prediction>;
const collectionVotes = collection(db, "votes") as CollectionReference<Vote>;

// ---------------------------------------------
// WORDS
// ---------------------------------------------

// Add a new word
export const addWord = async (word: string): Promise<void> => {
  try {
    const q = query(collectionWords, where("word", "==", word));
    const querySnapshot = await getDocs(q);

    // Check if the word is unique
    if (!querySnapshot.empty) {
      throw new Error("Word already exists!");
    }

    await addDoc(collectionWords, {
      word,
      createdAt: Timestamp.now(),
      userId: user()?.uid
    });
  } catch (error) {
    console.error("Error adding word:", (error as Error).message);
    throw error;
  }
};

// Edit an existing word
export const editWord = async (id: string, word: string): Promise<void> => {
  try {
    const wordDoc = doc(db, "words", id);
    await updateDoc(wordDoc, {
      word,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error editing word:", (error as Error).message);
    throw error;
  }
};

// Get all words (Real-time Listener)
export const getWords = (callback: (words: Word[]) => void) => {
  const q = query(collectionWords);
  return onSnapshot(q, snapshot => {
    const words = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(words);
  });
};

// ---------------------------------------------
// PREDICTIONS
// ---------------------------------------------

// Add multiple predictions
export const addPredictions = async (
  predictions: Omit<Prediction, "id" | "createdAt" | "userId">[]
): Promise<void> => {
  try {
    const promises = predictions.map(prediction =>
      addDoc(collectionPredictions, {
        ...prediction,
        createdAt: Timestamp.now(),
        userId: user()?.uid,
        userName: user()?.displayName!
      })
    );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error adding predictions:", (error as Error).message);
    throw error;
  }
};

// Update multiple predictions
export const updatePredictions = async (
  predictions: Omit<Prediction, "createdAt" | "userId">[]
): Promise<void> => {
  try {
    const promises = predictions.map(({ id, ...prediction }) =>
      updateDoc(doc(db, "predictions", id!), {
        ...prediction,
        updatedAt: Timestamp.now()
      })
    );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error updating predictions:", (error as Error).message);
    throw error;
  }
};

// Get today's predictions (Real-time Listener)
export const getPredictions = (
  callback: (predictions: Prediction[]) => void
) => {
  const q = query(
    collectionPredictions,
    where("createdAt", ">=", startOfDay(new Date())),
    where("createdAt", "<=", endOfDay(new Date()))
  );

  return onSnapshot(q, snapshot => {
    const predictions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(predictions);
  });
};

// ---------------------------------------------
// VOTES
// ---------------------------------------------

// Add single vote
export const updateVote = (id: string, value: number) => {
  return updateDoc(doc(db, "votes", id!), {
    value,
    updatedAt: Timestamp.now()
  });
};

// Add multiple votes
export const addVotes = async (
  votes: Omit<Vote, "id" | "createdAt" | "userId">[]
): Promise<void> => {
  try {
    const promises = votes.map(vote =>
      addDoc(collectionVotes, {
        ...vote,
        createdAt: Timestamp.now(),
        userId: user()?.uid
      })
    );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error adding votes:", (error as Error).message);
    throw error;
  }
};

// Update multiple votes
export const updateVotes = async (
  votes: Omit<Vote, "createdAt" | "userId">[]
): Promise<void> => {
  try {
    const promises = votes.map(({ id, ...vote }) =>
      updateDoc(doc(db, "votes", id!), {
        ...vote,
        updatedAt: Timestamp.now()
      })
    );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error updating votes:", (error as Error).message);
    throw error;
  }
};

// Get today's votes (Real-time Listener)
export const getVotes = (callback: (votes: Vote[]) => void) => {
  const q = query(
    collectionVotes,
    where("createdAt", ">=", startOfDay(new Date())),
    where("createdAt", "<=", endOfDay(new Date()))
  );

  return onSnapshot(q, snapshot => {
    const votes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(votes);
  });
};
