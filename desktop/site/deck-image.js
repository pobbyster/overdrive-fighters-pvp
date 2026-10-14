(() => {
 'use strict';
 const button = $('exportDeckImage'), dialog = $('deckImageDialog');
 let busy = false, previewURL = null, file = null;
 const width = 1800, padding = 60, gap = 24, columns = 6;
 const cardWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
 const cardHeight = Math.round(cardWidth * 1048 / 751), rowHeight = cardHeight + 66;

 function loadArt(id) {
  return new Promise((resolve, reject) => {
   const image = new Image(), timeout = setTimeout(() => { image.src = ''; reject(Error('O carregamento das artes demorou demais. Tente novamente.')); }, 20000);
   image.onload = () => { clearTimeout(timeout); resolve(image); };
   image.onerror = () => { clearTimeout(timeout); reject(Error('Não foi possível carregar todas as artes. Tente novamente.')); };
   image.src = imageURL(id);
  });
 }
 function lines(ctx, text, maxWidth) {
  const result = []; let line = '';
  // Character wrapping also handles names without spaces, without truncating them.
  for (const character of String(text)) {
   if (line && ctx.measureText(line + character).width > maxWidth) { result.push(line.trim()); line = ''; }
   line += character;
  }
  if (line.trim()) result.push(line.trim());
  return result;
 }
 function entries(d, zone) {
  return Object.entries(d[zone]).sort(([a], [b]) => get(a).number - get(b).number);
 }
 async function render(d) {
  const main = entries(d, 'main'), extra = entries(d, 'extra');
  const ids = [...new Set([d.fighter, ...main.map(([id]) => id), ...extra.map(([id]) => id)])];
  const arts = new Map(await Promise.all(ids.map(async id => [id, await loadArt(id)])));
  const canvas = document.createElement('canvas'); canvas.width = width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Seu navegador não conseguiu gerar a imagem.');
  ctx.font = 'bold 60px Arial';
  const title = lines(ctx, d.name.trim() || 'Meu baralho', width - padding * 2);
  const fighterTop = 160 + title.length * 74, fighterHeight = 370;
  const sectionHeight = list => 116 + (list.length ? Math.ceil(list.length / columns) * rowHeight : 80);
  canvas.height = fighterTop + fighterHeight + 60 + sectionHeight(main) + sectionHeight(extra) + 90;
  ctx.fillStyle = '#0c0b12'; ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = '#ff4b92'; ctx.fillRect(0, 0, width, 12);
  ctx.font = 'bold 28px Arial'; ctx.fillText('OVERDRIVE FIGHTERS  /  FIRST DRIVE', padding, 75);
  ctx.font = 'bold 60px Arial'; ctx.fillStyle = '#ffffff';
  title.forEach((line, i) => ctx.fillText(line, padding, 155 + i * 74));
  const fighterWidth = fighterHeight * 751 / 1048;
  ctx.drawImage(arts.get(d.fighter), padding, fighterTop, fighterWidth, fighterHeight);
  const infoX = padding + fighterWidth + 48;
  ctx.fillStyle = '#ff4b92'; ctx.font = 'bold 28px Arial'; ctx.fillText('LUTADOR', infoX, fighterTop + 45);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 46px Arial';
  lines(ctx, get(d.fighter).name, width - infoX - padding).forEach((line, i) => ctx.fillText(line, infoX, fighterTop + 112 + i * 56));
  ctx.font = '30px Arial'; ctx.fillStyle = '#c3bdcf';
  ctx.fillText(`${count(d.main)} cartas no principal  •  ${count(d.extra)} no adicional`, infoX, fighterTop + 245);
  const complete = count(d.main) === 40 && [0, 15].includes(count(d.extra));
  if (!complete) { ctx.fillStyle = '#ffcc72'; ctx.fillText('RASCUNHO • baralho em construção', infoX, fighterTop + 350); }
  let y = fighterTop + fighterHeight + 60;
  function section(label, list, total) {
   ctx.fillStyle = '#292230'; ctx.fillRect(padding, y, width - padding * 2, 2);
   ctx.font = 'bold 34px Arial'; ctx.fillStyle = '#ffffff'; ctx.fillText(label, padding, y + 61);
   ctx.font = '28px Arial'; ctx.fillStyle = '#c3bdcf'; ctx.textAlign = 'right';
   const quantities = { Golpe: 0, Guarda: 0, Truque: 0 };
   for (const [id, copies] of list) quantities[get(id).type] += copies;
   ctx.fillText(`${total} cartas • ${quantities.Golpe} Golpes • ${quantities.Guarda} Guardas • ${quantities.Truque} Truques`, width - padding, y + 61); ctx.textAlign = 'left';
   const top = y + 96;
   if (!list.length) { ctx.font = '28px Arial'; ctx.fillText('Nenhuma carta nesta seção.', padding, top + 30); }
   list.forEach(([id, quantity], i) => {
    const x = padding + (i % columns) * (cardWidth + gap), cardY = top + Math.floor(i / columns) * rowHeight;
    ctx.drawImage(arts.get(id), x, cardY, cardWidth, cardHeight);
    ctx.fillStyle = COLORS[get(id).color] || '#c3bdcf'; ctx.fillRect(x, cardY + cardHeight + 8, cardWidth, 38);
    ctx.font = 'bold 25px Arial'; ctx.fillStyle = '#0c0b12'; ctx.textAlign = 'center';
    ctx.fillText(`${quantity} ${quantity === 1 ? 'cópia' : 'cópias'}`, x + cardWidth / 2, cardY + cardHeight + 35); ctx.textAlign = 'left';
   });
   y += sectionHeight(list);
  }
  section('BARALHO PRINCIPAL', main, count(d.main));
  section('BARALHO ADICIONAL', extra, count(d.extra));
  ctx.fillStyle = '#c3bdcf'; ctx.font = '24px Arial';
  ctx.fillText('Overdrive Fighters • Artes originais do jogo', padding, canvas.height - 40);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw Error('Não foi possível gerar o PNG. Tente novamente.');
  return blob;
 }
 function clearPreview() {
  $('deckImagePreview').removeAttribute('src'); $('downloadDeckImage').removeAttribute('href');
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = null; file = null;
 }
 button.onclick = async () => {
  if (busy) return;
  let current;
  try { current = snapshot(validate(deck)); if (!current.fighter) throw Error('Escolha um lutador para exportar a imagem.'); }
  catch (error) { notify(error.message); return; }
  busy = true; button.disabled = true; button.textContent = 'Gerando imagem…'; button.setAttribute('aria-busy', 'true');
  try {
   const blob = await render(current);
   clearPreview(); previewURL = URL.createObjectURL(blob);
   const filename = (current.name.trim() || 'Meu baralho').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) + '-Overdrive.png';
   file = new File([blob], filename, { type: 'image/png' });
   $('deckImagePreview').src = previewURL;
   $('deckImagePreview').alt = `${current.name}: lutador ${get(current.fighter).name}, ${count(current.main)} cartas no principal e ${count(current.extra)} no adicional.`;
   $('downloadDeckImage').href = previewURL; $('downloadDeckImage').download = filename;
   $('shareDeckImage').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
   $('deckImageStatus').textContent = 'Imagem pronta. Baixe o PNG para enviar ou publicar onde quiser.';
   dialog.showModal();
  } catch (error) { clearPreview(); notify(error.message || 'Não foi possível exportar a imagem. Tente novamente.'); }
  finally { busy = false; button.disabled = !deck.fighter; button.textContent = 'Exportar imagem'; button.removeAttribute('aria-busy'); }
 };
 $('closeDeckImage').onclick = () => dialog.close();
 dialog.addEventListener('close', clearPreview);
 $('shareDeckImage').onclick = async () => {
  if (!file) return;
  try { await navigator.share({ files: [file] }); }
  catch (error) { if (error.name !== 'AbortError') $('deckImageStatus').textContent = 'Não foi possível compartilhar diretamente. Use Baixar PNG.'; }
 };
})();
