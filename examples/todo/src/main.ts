import "Chya";
import "./style.css";

Chya.setup("todoForm", () => {
  const [text, setText] = Chya.createSignal("");

  const addTodo = () => {
    if (text().trim().length) {
      const state = Chya.getState("todoList");
      state.todos = [...state.todos, text];
      setText("");
    }
  };

  return { text, addTodo };
});

Chya.init();
