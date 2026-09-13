const $ = (query) => document.querySelector(query);
let library;
let selectedFile;
let renamePlan;
const status = (message) => { $('#status').textContent = message; };
async function request(url, data) {
  const response = await fetch(url, data ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Averia-Token': library.token }, body: JSON.stringify(data) } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
function render() {
  $('#library').replaceChildren();
  const query = $('#search').value.trim().toLowerCase();
  const files = library.files.filter((file) => file.relative_path.toLowerCase().includes(query));
  for (const file of files) {
    const card = document.createElement('button'); card.className = 'card';
    const poster = document.createElement('div'); poster.className = 'poster'; poster.textContent = file.available ? (file.position_seconds > 0 ? '继续' : '▷') : '离线';
    const caption = document.createElement('div'); caption.className = 'caption'; caption.textContent = file.work?.title || file.relative_path;
    const size = document.createElement('small'); size.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    const details = document.createElement('small'); details.textContent = file.work ? `${file.work.primary_code} · ${file.relative_path}` : '未匹配作品';
    caption.append(details, size); card.append(poster, caption); card.disabled = !file.available;
    card.onclick = () => { selectedFile = file; renamePlan = null; $('#confirmRename').hidden = true; $('#renamePreview').textContent = ''; $('#filename').value = file.relative_path.split(/[\\/]/).at(-1); $('#title').textContent = file.work ? `${file.work.primary_code} · ${file.work.title}` : file.relative_path; $('#playError').textContent = ''; $('video').src = `/stream/${file.id}`; $('#player').showModal(); };
    $('#library').append(card);
  }
  status(files.length ? `${files.length} 个媒体文件` : '暂无匹配媒体。添加目录并扫描，或调整搜索条件。');
  $('#roots').replaceChildren();
  for (const root of library.roots) {
    const row = document.createElement('div'); row.className = 'root';
    const label = document.createElement('span'); label.textContent = root.path;
    const button = document.createElement('button'); button.textContent = '扫描目录';
    button.onclick = async () => {
      button.disabled = true; status('正在扫描目录…');
      try { await request('/api/scan', { id: root.id }); await load(); } catch (error) { status(error.message); } finally { button.disabled = false; }
    };
    row.append(label, button); $('#roots').append(row);
  }
}
async function load() { library = await request('/api/library'); render(); }
$('#choose').onclick = async () => {
  $('#choose').disabled = true; status('请在打开的窗口中选择媒体目录…');
  try {
    const result = await request('/api/pick-directory', {});
    if (result.path) { $('#directory').value = result.path; $('#addRoot').disabled = false; status(`已选择：${result.path}`); }
    else { $('#directory').value = ''; $('#addRoot').disabled = true; status('已取消选择目录。'); }
  } catch (error) { status(error.message); } finally { $('#choose').disabled = false; }
};
$('#add').onsubmit = async (event) => {
  event.preventDefault(); $('#addRoot').disabled = true;
  try { await request('/api/roots', { path: $('#directory').value }); $('#directory').value = ''; await load(); }
  catch (error) { status(error.message); $('#addRoot').disabled = false; }
};
$('#search').oninput = render;
$('#rename').onsubmit = async (event) => {
  event.preventDefault(); $('#confirmRename').hidden = true;
  try { renamePlan = await request('/api/rename/preview', { id: selectedFile.id, name: $('#filename').value }); $('#renamePreview').textContent = `${renamePlan.from} → ${renamePlan.to}`; $('#confirmRename').hidden = false; } catch (error) { $('#renamePreview').textContent = error.message; }
};
$('#filename').oninput = () => { renamePlan = null; $('#confirmRename').hidden = true; };
$('#confirmRename').onclick = async () => {
  $('#confirmRename').hidden = true;
  $('video').pause(); $('video').removeAttribute('src'); $('video').load();
  try { await request('/api/rename/apply', { planId: renamePlan.planId }); $('#player').close(); await load(); } catch (error) { $('#renamePreview').textContent = error.message; }
};
$('#close').onclick = () => $('#player').close();
$('#player').addEventListener('close', () => { $('video').pause(); $('video').removeAttribute('src'); $('video').load(); });
$('video').onerror = () => { $('#playError').textContent = '无法直接播放此文件：浏览器可能不支持其编码，或文件已离线。当前版本尚未接入转码。'; };
$('video').onloadedmetadata = () => { if (selectedFile?.position_seconds > 0 && selectedFile.position_seconds < $('video').duration) $('video').currentTime = selectedFile.position_seconds; };
let lastProgressSave = 0;
$('video').ontimeupdate = () => {
  const now = Date.now();
  if (!selectedFile || !$('video').duration || now - lastProgressSave < 5000) return;
  lastProgressSave = now;
  request('/api/playback', { id: selectedFile.id, position: $('video').currentTime, duration: $('video').duration }).catch(() => {});
};
$('video').onended = () => { if (selectedFile && $('video').duration) request('/api/playback', { id: selectedFile.id, position: $('video').duration, duration: $('video').duration }).catch(() => {}); };
$('#theme').onclick = () => document.documentElement.classList.toggle('light');
load().catch((error) => status(error.message));
