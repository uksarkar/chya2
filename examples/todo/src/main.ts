import "chya";
import "./style.css";

Chya.app("todoList", () => {
  Chya.createEffect(() => {
    const state = Chya.getState("todoForm");
    console.log(state?.text);
  });

  return { todos: [] };
});

Chya.app("todoForm", () => {
  const [text, setText] = Chya.createSignal("");

  const addTodo = () => {
    if (text().trim().length) {
      const state = Chya.getState("todoList");
      state.todos = [...state.todos, text()];
      setText("");
    }
  };

  return { text, addTodo, isDone: false };
});

Chya.init();
