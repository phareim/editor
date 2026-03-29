#!/usr/bin/env node

const blessed = require('blessed');
const fs = require('fs');

// Create a screen object.
const screen = blessed.screen({
  smartCSR: true,
  title: 'awesome-terminal-editor'
});

// Get filename from command line arguments
const filePath = process.argv[2];
let initialContent = '';

if (filePath) {
  try {
    initialContent = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    // File doesn't exist, so we'll create it on save.
    initialContent = '';
  }
}

// Create a box for the main content
const editor = blessed.textarea({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  style: {
    fg: 'white',
    bg: 'blue'
  },
  inputOnFocus: true
});

editor.setValue(initialContent);

// Let's try to add more advanced key bindings
editor.on('keypress', (ch, key) => {
  // blessed's textarea does not have a public API for cursor manipulation.
  // We have to rely on internal properties.
  // .cursor is the position index.
  // .select(start, end) can move the cursor.

  // NOTE: In many terminals, both Option/Alt and Command/Meta send the `meta`
  // key modifier. This makes it hard to distinguish between them.
  // We will use Meta for line/file jumps and Ctrl for word jumps for now
  // as it is a common and reliable convention.
  if (key.meta && !key.ctrl) { // For Command/Meta key.
    const currentValue = editor.getValue();
    const cursorPosition = editor.cursor;

    const lines = currentValue.split('\n');
    let lineIndex = 0;
    let positionInLine = 0;
    let currentPosition = 0;

    for (let i = 0; i < lines.length; i++) {
      if (cursorPosition <= currentPosition + lines[i].length) {
        lineIndex = i;
        positionInLine = cursorPosition - currentPosition;
        break;
      }
      currentPosition += lines[i].length + 1; // +1 for newline
    }

    switch (key.name) {
      case 'left':
        // command-left/right arrow jumps to start or end of line.
        editor.select(currentPosition, currentPosition);
        screen.render();
        break;
      case 'right':
        editor.select(currentPosition + lines[lineIndex].length, currentPosition + lines[lineIndex].length);
        screen.render();
        break;
      case 'up':
        // command-up/down arrow jumps to start/end of file.
        editor.select(0, 0);
        screen.render();
        break;
      case 'down':
        editor.select(currentValue.length, currentValue.length);
        screen.render();
        break;
    }
  } else if (key.ctrl && !key.meta) { // For Ctrl key.
    const currentValue = editor.getValue();
    let cursorPosition = editor.cursor;

    if (key.name === 'left') {
      let i = cursorPosition - 1;
      // move past whitespace
      while (i >= 0 && /\s/.test(currentValue[i])) {
          i--;
      }
      // move past word
      while (i >= 0 && /\w/.test(currentValue[i])) {
          i--;
      }
      editor.select(i + 1, i + 1);
      screen.render();
    } else if (key.name === 'right') {
      let i = cursorPosition;
      // if on a word, move past it
      while (i < currentValue.length && /\w/.test(currentValue[i])) {
          i++;
      }
      // move past whitespace
      while (i < currentValue.length && /\s/.test(currentValue[i])) {
          i++;
      }
      editor.select(i, i);
      screen.render();
    }
  }
});

const commandBar = blessed.textbox({
  parent: screen,
  bottom: 0,
  left: 0,
  height: 1,
  width: '100%',
  style: {
    bg: 'grey',
  },
  inputOnFocus: true,
});
commandBar.hide();

editor.key('escape', () => {
  commandBar.show();
  commandBar.focus();
  screen.render();
});

commandBar.on('submit', (text) => {
  const [command, ...args] = text.split(' ');
  switch (command) {
    case 's':
    case 'save':
      let savePath = args[0] || filePath;
      if (savePath) {
        fs.writeFileSync(savePath, editor.getValue());
      }
      break;
    case 'x':
    case 'exit':
      return process.exit(0);
  }
  commandBar.clearValue();
  commandBar.hide();
  editor.focus();
  screen.render();
});

commandBar.key('escape', () => {
  commandBar.clearValue();
  commandBar.hide();
  editor.focus();
  screen.render();
});

// Quit on Control-C.
screen.key(['C-c'], function(ch, key) {
  return process.exit(0);
});

// Focus our element.
editor.focus();

// Render the screen.
screen.render();
