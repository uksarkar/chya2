import { User } from "firebase/auth";
import { auth, signIn } from "../services/firebase";

const [user, setUser] = Chya.createSignal<User | null>(null);
const [isLoading, setIsLoading] = Chya.createSignal(false);
const isLoggedIn = Chya.computed(() => !!user());

auth.onAuthStateChanged(response => {
  setUser(response);
});

const login = () => {
  setIsLoading(true);
  signIn()
    .then(response => {
      console.log(response.user);
    })
    .catch(console.error)
    .finally(() => {
      setIsLoading(false);
    });
};

export { user, isLoading, isLoggedIn, login };
