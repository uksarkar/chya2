# Chya - A Lightweight DOM Manipulation Library

`Chya` is a powerful, lightweight, 4KB minified DOM manipulation library, designed to be as easy to use as Alpine.js but without relying on proxies. `Chya` makes DOM manipulation and reactivity simple with a clean syntax, providing essential features for managing states, event bindings, reactive properties, and more. It's easy to integrate and efficient, providing a small footprint without sacrificing functionality.

## Features

- **4KB minified**: A minimal library size, making it suitable for small projects or performance-sensitive environments.
- **No use of Proxy**: Unlike other libraries, `Chya` avoids the use of proxies for better performance and predictability.

## Syntax Overview

### 1. **App Declaration**

The root element of your application is defined using the `x-app` attribute.

```html
<div x-app="stateName">
  <!-- Your app content here -->
</div>
```

- `x-app` is the attribute used to declare your app, where its value corresponds to the state name.

### 2. **State Declaration (`x-state`)**

Declare your app's state inside the `x-app` element.

```html
<div x-app="stateName" x-state="{message: ''}">
  <p>{{ message }}</p>
</div>
```

- The `x-state` must be an object and is declared within the `x-app` element.
- It’s optional alternative is `Chya.app('stateName', () => ({message: ''}))` in a script tag.

### 3. **Reactive Bindings**

To bind DOM attributes reactively, use `x-bind:attrName`.

```html
<div x-bind:class="message.length ? 'p-10' : 'py-10'">Some text</div>
```

- You can bind any DOM attribute to a state property. `Chya` automatically updates the DOM when the state changes.

### 4. **Two-Way Binding (`x-model`)**

For two-way binding with input fields:

```html
<input x-model="message" />
```

- The input field will be linked to the state property, and updates to the input will reflect in the state and vice versa.

### 5. **Conditional Rendering (`x-if`)**

Toggle visibility of elements based on expressions.

```html
<div x-if="message">{{ message }}</div>
```

- Elements will be removed or added based on the truthiness of the expression.

### 6. **Event Bindings (`x-on:event.('stop' | 'prevent')`)**

Bind events to DOM elements.

```html
<button x-on:click="console.log('hello')">Click Me</button>
<button x-on:click.stop="console.log('stopped bubbling')">Click Me</button>
<button x-on:click.prevent="console.log('prevent default')">Click Me</button>
<button x-on:click="() => {event.preventDefault(); event.stopPropagation();}">
  Click Me
</button>
```

- Bind an event handler to DOM elements.

### 7. **Inner HTML Binding (`x-html`)**

Bind HTML content to elements.

```html
<div x-html="message"></div>
```

- The content inside the `x-html` element will be dynamically updated based on the value of `stateName.message`.

### 8. **Template Binding (`x-template`)**

Use template-based binding for inner HTML with full reactive capabilities.

```html
<div x-template="template"></div>
```

- The content is treated as a template and will support reactive bindings.

### 9. **Text Interpolation**

Use `{{ expr }}` to insert text dynamically.

```html
<p>{{ text }}</p>
```

- Directly interpolate state values into text content.

### 10. **Loop Syntax (`x-for`)**

Use the `x-for` directive for rendering lists.

```html
<ul>
  <li x-for="item, index in items">{{ item }}</li>
</ul>
```

- You can loop over arrays with optional index binding.

---

## Programmatic Usage

Chya provides a global accessor called `Chya` for managing state and reactivity programmatically.

### Declaring Application State

You can define the application state using `Chya.app`.

```javascript
Chya.app("stateName", () => ({
  text: "Hello",
  isDone: false
}));
```

- The state defined by `Chya.app` will be reactive and available in your DOM expressions.
- The first declared state will be the ultimate app state, so ensure you avoid multiple declarations for the same state.

### Reactivity with Signals

Chya utilizes signals for reactivity. You can create reactive signals using `Chya.createSignal()`.

```javascript
const [text, setText] = Chya.createSignal("");

Chya.app("todoForm", () => {
  const addTodo = () => {
    if (text().trim()) {
      const state = Chya.getState("todoList");
      state.todos.push(text());
      setText(""); // Reset input
    }
  };

  return { text, addTodo, isDone: false };
});
```

- Signals are reactive, meaning the DOM will update automatically when the signal's value changes.

### Accessing States

To access a defined state, use `Chya.getState()`.

```javascript
const state = Chya.getState("todoForm");
console.log(state.text); // Access the reactive state
```

### Effects on Signals

To create side effects when a signal changes, use `Chya.createEffect()`.

```javascript
Chya.createEffect(() => {
  const state = Chya.getState("todoForm");
  console.log(state?.text); // Log state whenever it changes
});
```

### Initialization

To initialize all app states in the document, call `Chya.init()`. Alternatively, you can render the app manually using `Chya.render()`.

```javascript
Chya.init(); // Automatically initialize
// or
Chya.render(document.getElementById("app")); // Manually render a specific element
```

---

## Getting Started

### Example Usage

Here’s a simple example of a Todo app:

```html
<div x-app="todoApp">
  <input x-model="text" />
  <button x-on:click="addTodo">Add Todo</button>
  <ul>
    <li x-for="item in todos">{{ item }}</li>
  </ul>
</div>

<script>
  Chya.app("todoApp", () => {
    const [text, setText] = Chya.createSignal("");
    const addTodo = () => {
      if (text().trim()) {
        const state = Chya.getState("todoList");
        state.todos.push(text());
        setText(""); // Reset the text input
      }
    };
    return { text, addTodo, todos: [] };
  });

  Chya.init();
</script>
```

---

## Conclusion

Chya is a small but powerful library that brings reactive state management and DOM manipulation to your projects with a minimal footprint. It’s designed to be easy to use, intuitive, and compatible with a variety of web projects.
