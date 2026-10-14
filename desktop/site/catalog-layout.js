(() => {
 const grid = document.getElementById('cardsGrid');
 const buttons = [document.getElementById('catalogGrid'), document.getElementById('catalogList')];
 buttons.forEach((button, index) => button.addEventListener('click', () => {
  grid.classList.toggle('catalog-list', index === 1);
  buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
 }));
 document.getElementById('manualMenuLink').addEventListener('click', () => setView('match', true));
})();
