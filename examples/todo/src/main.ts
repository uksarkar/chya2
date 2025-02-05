import "chya";
import "./style.css";

Chya.app("todoForm", () => {
  const [text, setText] = Chya.createSignal("");

  const addTodo = () => {
    if (text().trim().length) {
      const state = Chya.getState("todoList");
      state.todos = [...state.todos, text()];
      setText("");
    }
  };

  Chya.createEffect(() => {
    const state = Chya.getState("todoList");
    console.log(state?.done)
  })

  return { text, addTodo, isDone: false };
});

Chya.init();
