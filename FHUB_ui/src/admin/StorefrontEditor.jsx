import { useEffect, useState } from 'react';
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
  return <div className="storefront-editor"><div className="inventory-title"><div><span className="a-eyebrow">YOUR STORE. YOUR STORY.</span><h1>Make it feel like you.</h1><p>Change your images, messages and the stories behind your collections.</p></div><a href="/" target="_blank" rel="noreferrer" className="a-button secondary">View store <ArrowUpRight size={17} /></a></div><form onSubmit={save}><fieldset disabled={busy}><section className="cms-panel"><div className="cms-heading"><span>01</span><div><h2>The first impression</h2><p>Your store name and the message at the top of every visit.</p></div></div><div className="editor-grid">{textField('storeName')}{textField('announcement')}</div></section><section className="cms-panel"><div className="cms-heading"><span>02</span><div><h2>Collection showcase</h2><p>Three slides. One flowing story. Edit the image, left-side description and offer for each collection.</p></div></div><div className="cms-tabs">{settings.slides.map(s => <button key={s.id} type="button" aria-pressed={active === s.id} onClick={() => setActive(s.id)} className={active === s.id ? 'active' : ''}>{s.label}</button>)}</div><div className="cms-slide-layout"><div><CMSImage key={active} image={slide.image} file={files[active]} onFile={file => { setFiles(prev => ({ ...prev, [active]: file })); setError(''); }} onUrl={url => { slideField('image', { type: 'url', url }); setFiles(prev => ({ ...prev, [active]: null })); }} onError={setError} label={`${slide.label} showcase image`} /><p className="cms-image-note">Upload your own photograph or AI-generated image. Portrait images work best on both mobile and desktop.</p></div><div className="cms-slide-fields">{[['label', 'Collection name'], ['eyebrow', 'Small heading'], ['title', 'Main heading'], ['description', 'Left-side description'], ['badge', 'Image badge'], ['message', 'Offer or discount message'], ['buttonLabel', 'Button text']].map(([key, label]) => <label key={key}>{label}{key === 'description' ? <textarea rows={3} required maxLength={800} value={slide[key]} onChange={e => slideField(key, e.target.value)} /> : <input required maxLength={key === 'title' ? 100 : 120} value={slide[key]} onChange={e => slideField(key, e.target.value)} />}</label>)}<label>Featured article (optional)<select value={slide.articleId} onChange={e => slideField('articleId', e.target.value)}><option value="">Show collection offer only</option>{articles.filter(a => a.category === active).map(article => <option value={article.id} key={article.id}>{article.name}</option>)}</select><small>Shows the article name, price and discount on the image.</small></label></div></div></section><section className="cms-panel"><div className="cms-heading"><span>03</span><div><h2>Your collection & articles</h2><p>The introductions above your collection cards and live inventory.</p></div></div><div className="editor-grid">{textField('collectionHeading')}{textField('catalogueHeading')}{textField('collectionDescription', true)}{textField('catalogueDescription', true)}</div></section><section className="cms-panel"><div className="cms-heading"><span>04</span><div><h2>The story behind your store</h2><p>Add a familiar face, a favourite corner or your shopfront.</p></div></div><label className="cms-checkbox"><input type="checkbox" checked={settings.showStory} onChange={e => field('showStory', e.target.checked)} /> Show the story section</label><div className="cms-slide-layout"><CMSImage image={settings.storyImage} file={files.story} onFile={file => setFiles(prev => ({ ...prev, story: file }))} onUrl={url => { field('storyImage', { type: 'url', url }); setFiles(prev => ({ ...prev, story: null })); }} onError={setError} label="Store story image" /><div>{textField('storyHeading')}{textField('storyDescription', true)}</div></div></section><section className="cms-panel"><div className="cms-heading"><span>05</span><div><h2>A little closer to your customers</h2><p>Your contact details and the finishing touches.</p></div></div><div className="editor-grid">{textField('contactHeading')}{textField('phone')}{textField('contactDescription', true)}{textField('address', true)}{textField('hours')}{textField('footerTagline')}</div></section></fieldset><div className="cms-publish">{error && <div className="a-error" role="alert">{error}</div>}<div><span><Check size={15} /> Changes go live when you publish.</span><div><button type="button" className="a-button secondary" disabled={busy} onClick={() => { if (window.confirm('Reload the editor and discard unsaved changes?')) load(); }}><RefreshCw size={16} /> Reload</button><button className="a-button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{busy ? 'Publishing…' : 'Publish changes'}</button></div></div></div></form></div>;
}

function CMSImage({ image, file, onFile, onUrl, onError, label }) {
  const [preview, setPreview] = useState('');
  const [url, setUrl] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const value = URL.createObjectURL(file); setPreview(value); return () => URL.revokeObjectURL(value); }, [file]);
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
  return <div className="cms-image"><img src={preview || image.url} alt={label} /><label className="cms-upload"><ImagePlus size={17} /> {file ? 'Change selected image' : 'Upload image'}<input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label><div className="cms-url"><input aria-label={`${label} URL`} type="url" placeholder="Or paste an HTTPS image link" value={url} onChange={e => setUrl(e.target.value)} /><button type="button" onClick={useUrl} disabled={!url.trim()}>Use link</button></div></div>;
}
