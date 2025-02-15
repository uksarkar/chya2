import {
  getPredictions,
  getVotes,
  getWords,
  Prediction,
  Vote,
  Word
} from "../services/collections";

const [words, setWords] = Chya.createSignal<Word[]>([]);
const [votes, setVotes] = Chya.createSignal<Vote[]>([]);
const [predictions, setPredictions] = Chya.createSignal<Prediction[]>([]);

// listeners
getVotes(setVotes);
getPredictions(setPredictions);
getWords(setWords);

export { votes, predictions, words };
