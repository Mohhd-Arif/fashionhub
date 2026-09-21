import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ImagePlus, LoaderCircle, RefreshCw, Save } from 'lucide-react';
import { api } from './api';

const labels = { storeName: 'Store name', announcement: 'Announcement bar', collectionHeading: 'Collections heading', collectionDescription: 'Collections introduction', catalogueHeading: 'Articles heading', catalogueDescription: 'Articles introduction', storyHeading: 'Our story heading', storyDescription: 'Our story text', contactHeading: 'Contact heading', contactDescription: 'Contact introduction', address: 'Store address', phone: 'Phone number', hours: 'Opening hours', footerTagline: 'Footer tagline' };

export default function StorefrontEditor({ onExpired, notify }) {
  const [settings, setSettings] = useState(null);
  const [articles, setArticles] = useState([]);
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('kids');
  async function load() {
    setLoading(true); setError('');
    try {
      const data = await api('/admin/storefront');
      setSettings(data.storefront); setFiles({});
      const list = await api('/admin/articles?limit=100');
      const all = [...list.articles];
      // The featured-article selector includes the entire inventory, not only its first page.
      for (let page = 2; page <= list.pages; page++) all.push(...(await api(`/admin/articles?limit=100&page=${page}`)).articles);
      setArticles(all);
    } catch (e) { if (!onExpired(e)) setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function field(key, value) { setSettings(s => ({ ...s, [key]: value })); }
  function slideField(key, value) { setSettings(s => ({ ...s, slides: s.slides.map(slide => slide.id === active ? { ...slide, [key]: value } : slide) })); }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    const data = new FormData();
    data.append('storefront', JSON.stringify(settings));
    Object.entries(files).forEach(([key, file]) => file && data.append(key, file));
    try { const result = await api('/admin/storefront', { method: 'PATCH', body: data }); setSettings(result.storefront); setFiles({}); notify('Storefront published. Your changes are now live.'); }
    catch (e) { if (!onExpired(e)) setError(e.message); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="inventory-empty"><LoaderCircle className="spin" /><p>Opening your storefront editor…</p></div>;
  if (!settings) return <div className="inventory-empty" role="alert"><p>{error}</p><button className="a-button secondary" onClick={load}>Try again</button></div>;
  const slide = settings.slides.find(s => s.id === active);
  function textField(key, multiline = false) {
    const props = { value: settings[key], onChange: e => field(key, e.target.value), required: !['address', 'phone', 'hours'].includes(key), maxLength: multiline ? 1500 : key === 'storeName' ? 60 : ['address', 'hours'].includes(key) ? 300 : key === 'phone' ? 25 : 200 };
    return <label key={key}>{labels[key]}{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}</label>;
  }
  return <div className="storefront-editor"><div className="inventory-title"><div><span className="a-eyebrow">YOUR STORE. YOUR STORY.</span><h1>Make it feel like you.</h1><p>Change your images, messages and the stories behind your collections.</p></div><a href="/" target="_blank" rel="noreferrer" className="a-button secondary">View store <ArrowUpRight size={17} /></a></div><form onSubmit={save}><fieldset disabled={busy}><section className="cms-panel"><div className="cms-heading"><span>01</span><div><h2>The first impression</h2><p>Your store name and the message at the top of every visit.</p></div></div><div className="editor-grid">{textField('storeName')}{textField('announcement')}</div></section><section className="cms-panel"><div className="cms-heading"><span>02</span><div><h2>Collection showcase</h2><p>Three slides. One flowing story. Edit the image, left-side description and offer for each collection.</p></div></div><div className="cms-tabs">{settings.slides.map(s => <button key={s.id} type="button" aria-pressed={active === s.id} onClick={() => setActive(s.id)} className={active === s.id ? 'active' : ''}>{s.label}</button>)}</div><div className="cms-slide-layout"><div><CMSImage key={active} image={slide.image} crop={slide.imageCrop} onCrop={value => slideField('imageCrop', value)} file={files[active]} onFile={file => { setFiles(prev => ({ ...prev, [active]: file })); setError(''); }} onUrl={url => { slideField('image', { type: 'url', url }); setFiles(prev => ({ ...prev, [active]: null })); }} onError={setError} label={`${slide.label} showcase image`} /><p className="cms-image-note">Green crop box ko move/resize karke exact portion select karo. Storefront aur mobile dono me wahi selected portion show hoga.</p></div><div className="cms-slide-fields">{[['label', 'Collection name'], ['eyebrow', 'Small heading'], ['title', 'Main heading'], ['description', 'Left-side description'], ['badge', 'Image badge'], ['message', 'Offer or discount message'], ['buttonLabel', 'Button text']].map(([key, label]) => <label key={key}>{label}{key === 'description' ? <textarea rows={3} required maxLength={800} value={slide[key]} onChange={e => slideField(key, e.target.value)} /> : <input required maxLength={key === 'title' ? 100 : 120} value={slide[key]} onChange={e => slideField(key, e.target.value)} />}</label>)}<label>Featured article (optional)<select value={slide.articleId} onChange={e => slideField('articleId', e.target.value)}><option value="">Show collection offer only</option>{articles.filter(a => a.category === active).map(article => <option value={article.id} key={article.id}>{article.name}</option>)}</select><small>Shows the article name, price and discount on the image.</small></label></div></div></section><section className="cms-panel"><div className="cms-heading"><span>03</span><div><h2>Your collection & articles</h2><p>The introductions above your collection cards and live inventory.</p></div></div><div className="editor-grid">{textField('collectionHeading')}{textField('catalogueHeading')}{textField('collectionDescription', true)}{textField('catalogueDescription', true)}</div></section><section className="cms-panel"><div className="cms-heading"><span>04</span><div><h2>The story behind your store</h2><p>Add a familiar face, a favourite corner or your shopfront.</p></div></div><label className="cms-checkbox"><input type="checkbox" checked={settings.showStory} onChange={e => field('showStory', e.target.checked)} /> Show the story section</label><div className="cms-slide-layout"><div><CMSImage image={settings.storyImage} crop={settings.storyCrop} onCrop={value => field('storyCrop', value)} file={files.story} onFile={file => setFiles(prev => ({ ...prev, story: file }))} onUrl={url => { field('storyImage', { type: 'url', url }); setFiles(prev => ({ ...prev, story: null })); }} onError={setError} label="Store story image" /></div><div>{textField('storyHeading')}{textField('storyDescription', true)}</div></div></section><section className="cms-panel"><div className="cms-heading"><span>05</span><div><h2>A little closer to your customers</h2><p>Your contact details and the finishing touches.</p></div></div><div className="editor-grid">{textField('contactHeading')}{textField('phone')}{textField('contactDescription', true)}{textField('address', true)}{textField('hours')}{textField('footerTagline')}</div></section></fieldset><div className="cms-publish">{error && <div className="a-error" role="alert">{error}</div>}<div><span><Check size={15} /> Changes go live when you publish.</span><div><button type="button" className="a-button secondary" disabled={busy} onClick={() => { if (window.confirm('Reload the editor and discard unsaved changes?')) load(); }}><RefreshCw size={16} /> Reload</button><button className="a-button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{busy ? 'Publishing…' : 'Publish changes'}</button></div></div></div></form></div>;
}

const defaultCrop = { x: 8, y: 8, width: 84, height: 76 };
function cleanCrop(value, fallback = defaultCrop) {
  const source = value && typeof value === 'object' ? value : fallback;
  const width = Math.min(100, Math.max(12, Number(source.width) || fallback.width));
  const height = Math.min(100, Math.max(12, Number(source.height) || fallback.height));
  const x = Math.min(100 - width, Math.max(0, Number(source.x) || 0));
  const y = Math.min(100 - height, Math.max(0, Number(source.y) || 0));
  return { x, y, width, height };
}
function editableCrop(value) {
  const item = cleanCrop(value, { x: 0, y: 0, width: 100, height: 100 });
  return item.width >= 99.9 && item.height >= 99.9 ? defaultCrop : item;
}

function CMSImage({ image, crop, onCrop, file, onFile, onUrl, onError, label }) {
  const [preview, setPreview] = useState('');
  const [url, setUrl] = useState('');
  const [frame, setFrame] = useState(null);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const current = editableCrop(crop);
  const source = preview || image.url;
  function measureFrame() {
    const stage = stageRef.current, img = imgRef.current;
    if (!stage || !img || !img.naturalWidth || !img.naturalHeight) return;
    const rect = stage.getBoundingClientRect();
    const imageRatio = img.naturalWidth / img.naturalHeight;
    const stageRatio = rect.width / rect.height;
    let width = rect.width, height = rect.height, left = 0, top = 0;
    if (imageRatio > stageRatio) { height = rect.width / imageRatio; top = (rect.height - height) / 2; }
    else { width = rect.height * imageRatio; left = (rect.width - width) / 2; }
    setFrame({ left, top, width, height });
  }
  useEffect(() => { if (!file) { setPreview(''); return; } const value = URL.createObjectURL(file); setPreview(value); return () => URL.revokeObjectURL(value); }, [file]);
  useEffect(() => {
    measureFrame();
    const observer = new ResizeObserver(measureFrame);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [source]);
  function upload(e) {
    const item = e.target.files[0]; e.target.value = '';
    if (!item) return;
    if (item.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(item.type)) { onError('Upload a JPEG, PNG or WebP image up to 5 MB.'); return; }
    onFile(item);
  }
  function useUrl() {
    try { const value = new URL(url); if (value.protocol !== 'https:' || value.username || value.password) throw new Error(); onUrl(value.href); setUrl(''); onError(''); }
    catch { onError('Enter a valid HTTPS image link.'); }
  }
  function updateCrop(next) { onCrop?.(cleanCrop(next)); }
  function cropPointer(event, action) {
    if (!onCrop || !frame) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, crop: current };
    const move = item => {
      const dx = ((item.clientX - start.x) / frame.width) * 100;
      const dy = ((item.clientY - start.y) / frame.height) * 100;
      const next = { ...start.crop };
      if (action === 'move') { next.x += dx; next.y += dy; }
      if (action.includes('w')) { next.x += dx; next.width -= dx; }
      if (action.includes('e')) next.width += dx;
      if (action.includes('n')) { next.y += dy; next.height -= dy; }
      if (action.includes('s')) next.height += dy;
      updateCrop(next);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }
  function placeBox(event) {
    if (!onCrop || !frame || event.target.closest('.crop-box')) return;
    const rect = stageRef.current.getBoundingClientRect();
    const px = event.clientX - rect.left - frame.left;
    const py = event.clientY - rect.top - frame.top;
    if (px < 0 || py < 0 || px > frame.width || py > frame.height) return;
    const x = (px / frame.width) * 100;
    const y = (py / frame.height) * 100;
    updateCrop({ ...current, x: x - current.width / 2, y: y - current.height / 2 });
  }
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  return <div className="cms-image"><div className="crop-selector" ref={stageRef} role="application" aria-label={`${label} crop selector`} onPointerDown={placeBox}><img ref={imgRef} src={source} alt={label} draggable="false" onLoad={measureFrame} />{frame && <span className="crop-layer" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}><span className="crop-shade crop-shade-top" style={{ height: `${current.y}%` }} /><span className="crop-shade crop-shade-right" style={{ left: `${current.x + current.width}%`, top: `${current.y}%`, bottom: `${100 - current.y - current.height}%` }} /><span className="crop-shade crop-shade-bottom" style={{ top: `${current.y + current.height}%` }} /><span className="crop-shade crop-shade-left" style={{ width: `${current.x}%`, top: `${current.y}%`, bottom: `${100 - current.y - current.height}%` }} /><span className="crop-box" style={{ left: `${current.x}%`, top: `${current.y}%`, width: `${current.width}%`, height: `${current.height}%` }} onPointerDown={event => cropPointer(event, 'move')}>{handles.map(handle => <b key={handle} className={`crop-handle crop-handle-${handle}`} onPointerDown={event => cropPointer(event, handle)} />)}</span></span>}<span className="crop-hint">Full image visible hai. Box drag karo, edges resize karo.</span></div><label className="cms-upload"><ImagePlus size={17} /> {file ? 'Change selected image' : 'Upload image'}<input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label><div className="cms-url"><input aria-label={`${label} URL`} type="url" placeholder="Or paste an HTTPS image link" value={url} onChange={e => setUrl(e.target.value)} /><button type="button" onClick={useUrl} disabled={!url.trim()}>Use link</button></div></div>;
}

