// Game State Manager
class WordleHelper {
  constructor() {
    this.dictionary = [];
    this.currentAttempt = {
      letters: ['', '', '', '', ''],
      states: ['empty', 'empty', 'empty', 'empty', 'empty']
    };
    this.attempts = [];
    this.constraints = {
      exact: new Map(),
      present: new Map(),
      absent: new Set()
    };
    this.selectedCell = null;
    this.loadDictionary();
    this.loadState();
    this.init();
  }

  async loadDictionary() {
    try {
      const response = await fetch('dictionary.json');
      this.dictionary = await response.json();
    } catch (error) {
      console.error('Failed to load dictionary:', error);
    }
  }

  init() {
    this.renderLetterGrid();
    this.renderKeyboard();
    this.bindEvents();
    this.updateDisplay();
  }

  renderLetterGrid() {
    const grid = document.getElementById('letter-grid');
    grid.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
      const cell = document.createElement('div');
      cell.className = 'letter-cell empty';
      cell.dataset.index = i;
      grid.appendChild(cell);
    }
  }

  renderKeyboard() {
    const keys = document.querySelectorAll('.key[data-key]');
    keys.forEach(key => {
      key.addEventListener('click', () => {
        this.inputLetter(key.dataset.key);
      });
    });

    document.getElementById('backspace').addEventListener('click', () => {
      this.backspace();
    });

    document.getElementById('submit').addEventListener('click', () => {
      this.submitAttempt();
    });

    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key >= 'а' && key <= 'я' || key === 'ё') {
        this.inputLetter(key);
      } else if (key === 'backspace') {
        this.backspace();
      } else if (key === 'enter') {
        this.submitAttempt();
      }
    });
  }

  bindEvents() {
    const grid = document.getElementById('letter-grid');
    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.letter-cell');
      if (cell && cell.dataset.index) {
        this.selectCell(parseInt(cell.dataset.index));
      }
    });

    document.getElementById('add-attempt').addEventListener('click', () => {
      this.submitAttempt();
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
      if (confirm('Вы уверены, что хотите сбросить все данные?')) {
        this.reset();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.letter-cell') && !e.target.closest('.position-picker-container')) {
        this.deselectCell();
      }
    });
  }

  inputLetter(letter) {
    const emptyIndex = this.currentAttempt.letters.findIndex(l => l === '');
    if (emptyIndex !== -1) {
      this.currentAttempt.letters[emptyIndex] = letter;
      this.currentAttempt.states[emptyIndex] = 'absent';
      this.updateCell(emptyIndex);
      this.updateSubmitButton();
    }
  }

  backspace() {
    const lastIndex = this.currentAttempt.letters.findIndex(l => l === '') - 1;
    const index = lastIndex >= 0 ? lastIndex : 4;
    
    if (this.currentAttempt.letters[index] !== '') {
      this.currentAttempt.letters[index] = '';
      this.currentAttempt.states[index] = 'empty';
      this.updateCell(index);
      this.updateSubmitButton();
    }
  }

  selectCell(index) {
    if (this.currentAttempt.letters[index] === '') return;
    
    this.deselectCell();
    this.selectedCell = index;
    const cell = document.querySelector(`[data-index="${index}"]`);
    cell.classList.add('selected');
    
    this.cycleState(index);
    this.showPositionPicker(index);
    
    const states = {
      'empty': 'серая (буквы нет)',
      'present': 'жёлтая (есть, но не здесь)',
      'correct': 'зелёная (правильная позиция)'
    };
    console.log(`Буква '${this.currentAttempt.letters[index]}' теперь ${states[this.currentAttempt.states[index]]}`);
  }

  deselectCell() {
    if (this.selectedCell !== null) {
      const cell = document.querySelector(`[data-index="${this.selectedCell}"]`);
      if (cell) {
        cell.classList.remove('selected');
      }
      this.selectedCell = null;
    }
    this.hidePositionPicker();
  }

  cycleState(index) {
    const states = ['absent', 'present', 'correct'];
    const currentState = this.currentAttempt.states[index];
    const currentIndex = states.indexOf(currentState);
    const nextIndex = (currentIndex + 1) % states.length;
    
    this.currentAttempt.states[index] = states[nextIndex];
    this.updateCell(index);
    
    console.log(`Буква '${this.currentAttempt.letters[index]}' на позиции ${index + 1}: ${currentState} → ${states[nextIndex]}`);
  }

  showPositionPicker(index) {
    const letter = this.currentAttempt.letters[index];
    const state = this.currentAttempt.states[index];
    
    if (state !== 'present') {
      this.hidePositionPicker();
      return;
    }

    const container = document.getElementById('position-picker-container');
    const selectedLetter = document.getElementById('selected-letter');
    const chipsContainer = document.getElementById('position-chips');
    
    selectedLetter.textContent = letter.toUpperCase();
    chipsContainer.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
      const chip = document.createElement('div');
      chip.className = 'position-chip';
      chip.textContent = i + 1;
      chip.dataset.position = i;
      
      if (i === index) {
        chip.classList.add('current-position');
      } else {
        const excludedPositions = this.getExcludedPositions(letter);
        if (excludedPositions.has(i)) {
          chip.classList.add('selected');
        }
        
        chip.addEventListener('click', () => {
          this.toggleExcludedPosition(letter, i);
          chip.classList.toggle('selected');
          this.updateFilteredWords();
        });
      }
      
      chipsContainer.appendChild(chip);
    }
    
    container.hidden = false;
  }

  hidePositionPicker() {
    document.getElementById('position-picker-container').hidden = true;
  }

  getExcludedPositions(letter) {
    const attempt = this.attempts.find(a => a.positions && a.positions[letter]);
    return attempt ? new Set(attempt.positions[letter]) : new Set();
  }

  toggleExcludedPosition(letter, position) {
    let attempt = this.attempts.find(a => a.word === this.currentAttempt.letters.join(''));
    if (!attempt) {
      attempt = {
        word: this.currentAttempt.letters.join(''),
        states: [...this.currentAttempt.states],
        positions: {}
      };
      this.attempts.push(attempt);
    }
    
    if (!attempt.positions[letter]) {
      attempt.positions[letter] = [];
    }
    
    const index = attempt.positions[letter].indexOf(position);
    if (index === -1) {
      attempt.positions[letter].push(position);
    } else {
      attempt.positions[letter].splice(index, 1);
      if (attempt.positions[letter].length === 0) {
        delete attempt.positions[letter];
      }
    }
    
    this.saveState();
  }

  updateCell(index) {
    const cell = document.querySelector(`[data-index="${index}"]`);
    const letter = this.currentAttempt.letters[index];
    const state = this.currentAttempt.states[index];
    
    cell.classList.add('changing-state');
    setTimeout(() => cell.classList.remove('changing-state'), 300);
    
    cell.textContent = letter.toUpperCase();
    cell.className = `letter-cell ${state}`;
    
    if (letter) {
      cell.title = `Кликните для смены состояния (серая/желтая/зеленая)`;
    } else {
      cell.title = '';
    }
    
    if (state === 'present' && this.selectedCell === index) {
      const letterKey = letter;
      const excludedPositions = this.getExcludedPositions(letterKey);
      
      if (excludedPositions.size > 0) {
        const indicators = document.createElement('div');
        indicators.className = 'mini-indicators';
        
        for (let i = 0; i < 5; i++) {
          const indicator = document.createElement('div');
          indicator.className = 'mini-indicator';
          if (!excludedPositions.has(i) && i !== index) {
            indicator.style.opacity = '0.3';
          }
          indicators.appendChild(indicator);
        }
        
        cell.appendChild(indicators);
      }
    }
  }

  updateSubmitButton() {
    const button = document.getElementById('add-attempt');
    const submitKey = document.getElementById('submit');
    const isComplete = this.currentAttempt.letters.every(l => l !== '');
    
    button.disabled = !isComplete;
    submitKey.disabled = !isComplete;
  }

  submitAttempt() {
    if (!this.currentAttempt.letters.every(l => l !== '')) return;
    
    // Convert empty states to absent (user didn't click = gray)
    const finalStates = this.currentAttempt.states.map(state => state === 'empty' ? 'absent' : state);
    
    const attempt = {
      word: this.currentAttempt.letters.join(''),
      states: finalStates,
      positions: {}
    };
    
    console.log('=== Добавляем попытку ===');
    console.log('Слово:', attempt.word);
    console.log('Состояния (final):', attempt.states);
    
    console.log('=== Добавляем попытку ===');
    console.log('Слово:', attempt.word);
    console.log('Состояния:', attempt.states);
    
    this.attempts.push(attempt);
    this.addToHistory(attempt);
    this.updateConstraints();
    this.updateFilteredWords();
    this.updateKeyboard();
    this.resetCurrentAttempt();
    this.saveState();
  }

  addToHistory(attempt) {
    const container = document.getElementById('attempts-container');
    const attemptDiv = document.createElement('div');
    attemptDiv.className = 'attempt';
    
    for (let i = 0; i < 5; i++) {
      const cell = document.createElement('div');
      cell.className = `letter-cell ${attempt.states[i]}`;
      cell.textContent = attempt.word[i].toUpperCase();
      attemptDiv.appendChild(cell);
    }
    
    container.appendChild(attemptDiv);
  }

  updateConstraints() {
    this.constraints = {
      exact: new Map(),
      present: new Map(),
      absent: new Set()
    };
    
    console.log('=== Обновляем ограничения ===');
    
    for (const attempt of this.attempts) {
      for (let i = 0; i < 5; i++) {
        const letter = attempt.word[i];
        const state = attempt.states[i];
        
        if (state === 'correct') {
          console.log(`  ✅ Зелёная: '${letter}' на позиции ${i+1}`);
          this.constraints.exact.set(i, letter);
          this.constraints.absent.delete(letter);
        } else if (state === 'present') {
          console.log(`  🟨 Жёлтая: '${letter}' есть, но не на ${i+1}`);
          if (!this.constraints.present.has(letter)) {
            this.constraints.present.set(letter, new Set());
          }
          this.constraints.present.get(letter).add(i);
          this.constraints.absent.delete(letter);
        }
      }
    }
    
    for (const attempt of this.attempts) {
      for (let i = 0; i < 5; i++) {
        const letter = attempt.word[i];
        const state = attempt.states[i];
        
        if (state === 'absent') {
          let shouldBeAbsent = true;
          
          const exactLetters = Array.from(this.constraints.exact.values());
          if (exactLetters.includes(letter)) {
            console.log(`  ❗ Буква '${letter}' в exact, пропускаем absent`);
            shouldBeAbsent = false;
          }
          
          if (this.constraints.present.has(letter)) {
            console.log(`  ❗ Буква '${letter}' в present, пропускаем absent`);
            shouldBeAbsent = false;
          }
          
          if (shouldBeAbsent) {
            console.log(`  ⬜ Серая: '${letter}' добавляем в absent`);
            this.constraints.absent.add(letter);
          }
        }
      }
      
      if (attempt.positions) {
        for (const [letter, positions] of Object.entries(attempt.positions)) {
          if (this.constraints.present.has(letter)) {
            for (const pos of positions) {
              this.constraints.present.get(letter).add(pos);
            }
          }
        }
      }
    }
    
    console.log('Итоговые ограничения:', {
      exact: Array.from(this.constraints.exact.entries()),
      present: Array.from(this.constraints.present.entries()),
      absent: Array.from(this.constraints.absent)
    });
  }

  updateFilteredWords() {
    if (this.attempts.length === 0) {
      this.displayWords([]);
      return;
    }
    
    console.log('=== Фильтрация ===');
    console.log('Ограничения:', {
      exact: Array.from(this.constraints.exact.entries()),
      present: Array.from(this.constraints.present.entries()).map(([l, p]) => [l, Array.from(p)]),
      absent: Array.from(this.constraints.absent)
    });
    
    const filtered = this.filterWords(this.dictionary, this.constraints);
    console.log(`Найдено ${filtered.length} слов`);
    if (filtered.length <= 10) {
      console.log('Слова:', filtered);
    }
    
    this.displayWords(filtered);
  }

  filterWords(words, constraints) {
    return words.filter(word => {
      const letters = word.split('');
      
      for (const [pos, letter] of constraints.exact) {
        if (letters[pos] !== letter) return false;
      }
      
      for (const [letter, excludedPositions] of constraints.present) {
        if (!letters.includes(letter)) return false;
        for (const pos of excludedPositions) {
          if (letters[pos] === letter) return false;
        }
      }
      
      for (const letter of constraints.absent) {
        if (letters.includes(letter)) return false;
      }
      
      return true;
    });
  }

  displayWords(words) {
    const container = document.getElementById('word-list');
    const count = document.getElementById('word-count');
    
    if (words.length === 0) {
      container.innerHTML = this.attempts.length === 0 
        ? '<p class="empty-state">Введите первую попытку, чтобы увидеть подходящие слова</p>'
        : '<p class="empty-state">Нет подходящих слов. Проверьте ограничения.</p>';
      count.textContent = '0';
      return;
    }
    
    count.textContent = words.length;
    
    const grid = document.createElement('div');
    grid.className = 'word-grid';
    
    const displayWords = words.slice(0, 100);
    
    for (const word of displayWords) {
      const item = document.createElement('div');
      item.className = 'word-item';
      item.textContent = word.toUpperCase();
      item.title = word;
      grid.appendChild(item);
    }
    
    if (words.length > 100) {
      const more = document.createElement('div');
      more.className = 'word-item';
      more.textContent = `+${words.length - 100} ещё`;
      more.style.background = 'var(--gray-light)';
      grid.appendChild(more);
    }
    
    container.innerHTML = '';
    container.appendChild(grid);
  }

  updateKeyboard() {
    const letterStates = new Map();
    
    for (const attempt of this.attempts) {
      for (let i = 0; i < 5; i++) {
        const letter = attempt.word[i];
        const state = attempt.states[i];
        const current = letterStates.get(letter);
        
        if (!current || (state === 'correct' && current !== 'correct') || 
            (state === 'present' && current === 'absent')) {
          letterStates.set(letter, state);
        }
      }
    }
    
    document.querySelectorAll('.key[data-key]').forEach(key => {
      const letter = key.dataset.key;
      const state = letterStates.get(letter);
      
      key.classList.remove('correct', 'present', 'absent');
      if (state) {
        key.classList.add(state);
      }
    });
  }

  resetCurrentAttempt() {
    this.currentAttempt = {
      letters: ['', '', '', '', ''],
      states: ['empty', 'empty', 'empty', 'empty', 'empty']
    };
    
    for (let i = 0; i < 5; i++) {
      this.updateCell(i);
    }
    
    this.updateSubmitButton();
    this.deselectCell();
  }

  updateDisplay() {
    document.getElementById('attempts-container').innerHTML = '';
    this.attempts.forEach(attempt => this.addToHistory(attempt));
    this.updateConstraints();
    this.updateFilteredWords();
    this.updateKeyboard();
  }

  reset() {
    this.attempts = [];
    this.resetCurrentAttempt();
    this.updateDisplay();
    localStorage.removeItem('wordle-helper-state');
  }

  saveState() {
    const state = {
      attempts: this.attempts,
      currentAttempt: this.currentAttempt
    };
    localStorage.setItem('wordle-helper-state', JSON.stringify(state));
  }

  loadState() {
    const saved = localStorage.getItem('wordle-helper-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.attempts = state.attempts || [];
        this.currentAttempt = state.currentAttempt || {
          letters: ['', '', '', '', ''],
          states: ['empty', 'empty', 'empty', 'empty', 'empty']
        };
      } catch (e) {
        console.error('Failed to load state:', e);
      }
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WordleHelper();
});