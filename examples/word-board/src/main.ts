import "./style.css";
import "chya";import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  ChartItem
} from "chart.js";
import { produce } from "immer";
import { format } from "date-fns";
import { predictions, votes, words } from "./stores/chart";
import { isLoggedIn, login, user } from "./hooks/auth";
import {
  addPredictions,
  addVotes,
  addWord,
  Prediction,
  updatePredictions,
  updateVote
} from "./services/collections";
import { signOut } from "./services/firebase";
import { isTyping, messageInput, messages, sendMessage } from "./stores/chats";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

const datasets = Chya.computed(() => {
  // Store the data once to avoid multiple function calls
  const allPredictions = predictions();
  const allVotes = votes();

  // Get unique participants who have made predictions today
  const participants = allPredictions.reduce(
    (acc, prediction) => {
      // Check if the user is already added
      if (!acc.some(u => u.id === prediction.userId)) {
        acc.push({
          id: prediction.userId!,
          name: prediction.userName || "Unknown"
        });
      }
      return acc;
    },
    [] as { id: string; name: string }[]
  );

  // Prepare datasets for predictions and votes
  return participants
    .map(user => {
      // Get predictions and votes for the current user
      const userPredictions = allPredictions
        .filter(p => p.userId === user.id)
        .map(p => p.count);
      const userVotes = allVotes
        .filter(v => v.userId === user.id)
        .map(v => v.value);

      return [
        {
          label: `Prediction of ${user.name}`,
          data: userPredictions,
          borderWidth: 1
        },
        {
          label: `Votes of ${user.name}`,
          data: userVotes,
          borderWidth: 1
        }
      ];
    })
    .flat();
});

Chya.app("chart", () => {
  const ctx = document.getElementById("wordCharts") as ChartItem;
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: words().map(w => w.word),
      datasets: datasets()
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        tooltip: {
          enabled: true,
          position: "nearest"
        }
      },
      hover: {
        mode: "index",
        intersect: false
      },
      scales: {
        x: {
          grid: { display: true }
        },
        y: {
          grid: { display: true }
        }
      }
    }
  });

  // effects
  Chya.createEffect(() => {
    chart.data.labels = words().map(w => w.word);
    chart.data.datasets = datasets();
    chart.update("resize");
  });

  const addVote = (word_id: string) => {
    const prediction = predictions().find(p => p.word_id === word_id);
    if (!prediction) return;

    const vote = votes().find(v => v.prediction_id === prediction.id);
    if (vote) {
      updateVote(vote.id!, vote.value + 1);
    } else {
      addVotes([{ value: 1, prediction_id: prediction.id! }]);
    }
  };

  return {
    addVote,
    words,
    today: format(new Date(), "dd-MMM-yyyy"),
    signOut,
    newWord: addWord,
    user,
    messages,
    messageInput,
    isTyping,
    sendMessage
  };
});

Chya.app("initialForm", () => {
  const [init, setInit] = Chya.createSignal(false);
  const [show, setShow] = Chya.createSignal(
    () => !isLoggedIn() && !predictions().length
  );
  const [data, setData] = Chya.createSignal<Record<string, number>>({});

  const updateCount = (word_id: string, count: number) => {
    setData(prev =>
      produce(prev, draft => {
        draft[word_id] = count;
      })
    );
  };

  const proceed = () => {
    setShow(false);
    setInit(true);

    const obj = data();
    const keys = Object.keys(obj);
    const u = user();
    const predictionItems = predictions().filter(p => p.userId === u?.uid);

    const [existing, newItems] = keys.reduce(
      (tuple, key) => {
        const exists = predictionItems.find(p => p.word_id === key);
        if (!exists) {
          tuple[1].push({
            count: obj[key],
            word_id: key
          });
        } else {
          tuple[0].push({
            count: obj[key],
            word_id: key,
            id: exists.id
          });
        }

        return tuple;
      },
      [[], []] as [
        Omit<Prediction, "createdAt" | "userId">[],
        Omit<Prediction, "id" | "createdAt" | "userId">[]
      ]
    );

    if (newItems.length) {
      addPredictions(newItems);
    }

    if (existing.length) {
      updatePredictions(existing);
    }
  };

  Chya.createEffect(() => {
    if (!init() && isLoggedIn() && show() && predictions().length) {
      setShow(false);
      setInit(true);
    }
  });

  Chya.createEffect(() => {
    const u = user();
    if (show()) {
      setData(() =>
        Object.fromEntries(
          predictions()
            .filter(p => p.userId === u?.uid)
            .map(p => [p.word_id, p.count])
        )
      );
    }
  });

  Chya.createEffect(() => {
    if (!isLoggedIn()) {
      setShow(true);
    }
  });

  return {
    words,
    updateCount,
    proceed,
    data,
    show,
    isLoggedIn,
    login,
    init
  };
});

const element = document.getElementById("chatBox") as HTMLDivElement;

Chya.createEffect(() => {
  messages();
  if (element) {
    setTimeout(() => {
      element.scroll({
        behavior: "smooth",
        top: element.scrollHeight
      });
    }, 50);
  }
});

Chya.init();
