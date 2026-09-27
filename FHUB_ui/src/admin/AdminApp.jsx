import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, ChevronLeft, ChevronRight, CircleAlert, Eye, EyeOff, ImagePlus, LayoutDashboard, LoaderCircle, LogOut, Package, Pencil, Pin, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Shirt, Trash2, Users, X } from 'lucide-react';
import { api } from './api';
import StorefrontEditor from './StorefrontEditor';
import './admin.css';

const currency = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
const formatDate = d => { if (!d) return '-'; try { return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)); } catch { return '-'; } };
const newArticle = { name: '', quantity: 0, size: 'M', gender: 'male', category: 'kids', price: '', discount: 0, images: [] };
const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free size'];

function Brand() { return <a className="wordmark admin-brand-pill" href="/" aria-label="Fashion Hub storefront"><span className="admin-logo-mark"><img src="/images/fhub-logo.jpeg" alt="" /></span><span className="admin-brand-name">Fashion<span>Hub</span></span></a>; }

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [message, setMessage] = useState('');
  function routeUser(account) {
    if (account.usertype !== 'admin') { window.location.replace('/'); return; }
    if (window.location.pathname !== '/admin') { window.location.replace('/admin'); return; }
    setUser(account);
  }
  async function checkSession() {
    setChecking(true); setSessionError('');
    try { routeUser((await api('/auth/me')).user); }
    catch (e) { if (e.status !== 401) setSessionError(e.message); }
    finally { setChecking(false); }
  }
  useEffect(() => { checkSession(); }, []);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(timer); }, [message]);
  async function signOut() {
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); }
    catch (e) { setMessage(e.message); }
  }
  function expired(error) {
    if (error.status === 401) { setUser(null); setMessage('Your session expired. Please sign in again.'); return true; }
    return false;
  }
  return <div className="admin-app">
    {checking ? <div className="admin-loading"><LoaderCircle className="spin" /><p>Getting your workspace ready...</p></div> : sessionError ? <div className="admin-loading"><CircleAlert /><p>{sessionError}</p><button className="a-button primary" onClick={checkSession}>Try again</button><a href="/">Back to store</a></div> : !user ? <Login onLogin={routeUser} /> : user.usertype !== 'admin' ? <div className="account-page"><Brand /><div className="account-card"><ShieldCheck size={34} /><h1>You're signed in.</h1><p>{user.email}</p><p>Your customer account is ready. Inventory management is available to store administrators.</p><a className="a-button primary" href="/">Explore the store <ArrowUpRight size={18} /></a><button className="a-button secondary" onClick={signOut}>Sign out</button></div></div> : <Inventory user={user} onLogout={signOut} onExpired={expired} notify={setMessage} />}
    {message && <div className="admin-toast" role="status"><Check size={18} />{message}<button aria-label="Dismiss notification" onClick={() => setMessage('')}><X size={16} /></button></div>}
  </div>;
}

function Login({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { onLogin((await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: { email, password } })).user); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><section className="login-story"><Brand /><div className="login-story-copy"><span className="a-eyebrow">A LITTLE LOCAL. A LOT TO LOVE.</span><h1>Behind every<br />great outfit,<br /><em>a thoughtful store.</em></h1><p>Your styles, your stock, your next chapter.<br />A little more organised. A lot more you.</p><span className="login-flower">FH</span></div><div className="login-caption"><span>THE FASHION HUB WORKSPACE</span><span>Made for your everyday.</span></div></section><section className="login-form-side"><a href="/" className="a-back"><ArrowLeft size={16} /> Back to the store</a><form className="login-form" onSubmit={submit}><div className="login-icon"><Shirt size={26} /></div><span className="a-eyebrow">{register ? 'MAKE YOURSELF AT HOME' : 'YOUR STORE, IN GOOD HANDS'}</span><h2>{register ? 'Join Fashion Hub.' : 'Welcome back.'}</h2><p>{register ? 'Create your customer account and find your favourites.' : 'Sign in to your Fashion Hub account.'}</p>{error && <div role="alert" className="a-error"><CircleAlert size={17} />{error}</div>}<label>Email address<input autoComplete="email" type="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label><label>Password<div className="password-field"><input autoComplete={register ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} required minLength={register ? 8 : undefined} maxLength={256} placeholder={register ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><button disabled={busy} className="a-button primary login-submit">{busy ? <><LoaderCircle className="spin" size={18} /> Please wait...</> : <>{register ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></>}</button><div className="login-switch">{register ? 'Already have an account?' : 'New to Fashion Hub?'} <button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setPassword(''); }}>{register ? 'Sign in' : 'Create an account'}</button></div><div className="login-secure"><ShieldCheck size={15} /> A secure space for your account.</div></form><small className="login-copyright">Copyright {new Date().getFullYear()} Fashion Hub</small></section></div>;
}

function Inventory({ user, onLogout, onExpired, notify }) {
  const [view, setView] = useState('inventory');
  const [articles, setArticles] = useState([]);
  const [summary, setSummary] = useState({ articles: 0, units: 0, lowStock: 0, outOfStock: 0, deleted: 0 });
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [stock, setStock] = useState('');
  const [topOnly, setTopOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [paging, setPaging] = useState({ total: 0, pages: 1 });
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [pinBusyId, setPinBusyId] = useState(null);
  const quietReload = useRef(false);
  const reload = () => setRefresh(v => v + 1);
  const reloadQuietly = () => { quietReload.current = true; reload(); };

  useEffect(() => {
    const controller = new AbortController();
    if (quietReload.current) quietReload.current = false;
    else setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ search, category: gender, stock, status, top: topOnly ? 'only' : '', page: String(page), limit: '12' });
        const [data, stats] = await Promise.all([api(`/admin/articles?${query}`, { signal: controller.signal }), api('/admin/articles/summary', { signal: controller.signal })]);
        if (controller.signal.aborted) return;
        if (page > data.pages) { quietReload.current = true; setPage(Math.max(1, data.pages)); return; }
        setArticles(data.articles); setPaging({ total: data.total, pages: data.pages }); setSummary(stats.summary);
      } catch (e) { if (!controller.signal.aborted && !onExpired(e)) setError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, gender, stock, status, topOnly, page, refresh]);

  async function deleteArticle() {
    setDeleteBusy(true); setDeleteError('');
    try {
      await api(`/admin/articles/${deleting.id}`, { method: 'DELETE', body: { version: deleting.version } });
      setDeleting(null);
      notify('Article marked as deleted. It can be viewed or restored from the Deleted tab.');
      reload();
    } catch (e) { if (!onExpired(e)) setDeleteError(e.message); }
    finally { setDeleteBusy(false); }
  }

  async function restoreArticle(article) {
    setRestoringId(article.id);
    try {
      await api(`/admin/articles/${article.id}/restore`, { method: 'POST' });
      notify(`"${article.name}" has been restored to your storefront.`);
      reload();
    } catch (e) { if (!onExpired(e)) notify(e.message); }
    finally { setRestoringId(null); }
  }

  async function toggleTop(article) {
    setPinBusyId(article.id);
    try {
      const result = await api(`/admin/articles/${article.id}/top`, { method: 'PATCH', body: { position: article.topPosition ? null : 999999 } });
      setArticles(current => current
        .filter(item => !(topOnly && article.topPosition && item.id === article.id))
        .map(item => ({ ...item, topPosition: item.id === article.id ? result.position : article.topPosition && item.topPosition > article.topPosition ? item.topPosition - 1 : item.topPosition })));
      if (topOnly && article.topPosition) setPaging(current => ({ ...current, total: Math.max(0, current.total - 1), pages: Math.max(1, Math.ceil((current.total - 1) / 12)) }));
      if (topOnly && article.topPosition && page > 1 && paging.total - 1 <= (page - 1) * 12) setPage(page - 1);
      notify(article.topPosition ? 'Article removed from top. Positions updated.' : `Article added at #${result.position}.`);
      reloadQuietly();
    } catch (e) { if (!onExpired(e)) notify(e.message); }
    finally { setPinBusyId(null); }
  }

  return <div className="admin-layout"><aside className="admin-sidebar"><Brand /><span className="workspace-label">STORE WORKSPACE</span><nav aria-label="Admin navigation"><button aria-label="Articles" title="Articles" onClick={() => setView('inventory')} className={view === 'inventory' ? 'sidebar-active' : ''}><LayoutDashboard size={19} /> Articles <span>{summary.articles}</span></button><button aria-label="Storefront" title="Storefront" onClick={() => setView('storefront')} className={view === 'storefront' ? 'sidebar-active' : ''}><ImagePlus size={19} /> Storefront</button><a href="/"><ArrowUpRight size={19} /> View storefront</a></nav><div className="sidebar-note"><span>FH</span><h3>Room for your next<br />great collection.</h3><p>A few good pieces.<br />Endless possibilities.</p></div><div className="sidebar-user"><span className="avatar">{user.email[0].toUpperCase()}</span><div><strong>Store administrator</strong><small title={user.email}>{user.email}</small></div><button aria-label="Sign out" onClick={onLogout}><LogOut size={18} /></button></div></aside><div className="admin-main"><header className="admin-topbar"><span>Workspace <span>/</span> <b>{view === 'inventory' ? 'Articles' : 'Storefront'}</b></span><div><span className="admin-role"><ShieldCheck size={13} /> Admin access</span><button className="mobile-signout" aria-label="Sign out" onClick={onLogout}><LogOut size={18} /></button></div></header><main className="inventory-main">{view === 'storefront' ? <StorefrontEditor onExpired={onExpired} notify={notify} /> : <><div className="inventory-title"><div><span className="a-eyebrow">A GOOD DAY TO GROW YOUR STORE</span><h1>Your collection, at a glance<span>.</span></h1><p>A little organisation. A lot of possibilities.</p></div><button className="a-button primary" onClick={() => setEditor({ ...newArticle })}><Plus size={18} /> Add article</button></div><div className="inventory-stats">{[{ label: 'Total articles', value: summary.articles, sub: 'Styles in your collection', icon: Shirt }, { label: 'Units in stock', value: summary.units, sub: 'Ready for their next chapter', icon: Package }, { label: 'Low stock', value: summary.lowStock, sub: '5 or fewer units left', icon: CircleAlert }, { label: 'Out of stock', value: summary.outOfStock, sub: 'A little restock reminder', icon: Box }].map(({ label, value, sub, icon: Icon }, i) => <div className={`stat-card stat-${i}`} key={label}><div><span>{label}</span><Icon size={19} /></div><strong>{loading && !articles.length ? '-' : value.toLocaleString('en-IN')}</strong><small>{sub}</small></div>)}</div><section className="inventory-panel"><div className="inventory-panel-heading"><div><h2>{status === 'deleted' ? 'Deleted articles' : status === 'all' ? 'All records' : topOnly ? 'Top articles' : 'All articles'} <span>{paging.total}</span></h2><p>{status === 'deleted' ? 'Archived articles hidden from the storefront. You can restore them anytime.' : topOnly ? 'In storefront priority order. Edit an article to swap its position.' : 'The pieces that make your store, yours.'}</p></div><div className="panel-actions-wrapper"><div className="status-tabs" role="tablist"><button type="button" role="tab" aria-selected={status === 'active'} className={`status-tab ${status === 'active' ? 'active' : ''}`} onClick={() => { setStatus('active'); setPage(1); }}>Active <span>{summary.articles || 0}</span></button><button type="button" role="tab" aria-selected={status === 'deleted'} className={`status-tab ${status === 'deleted' ? 'active' : ''}`} onClick={() => { setStatus('deleted'); setTopOnly(false); setPage(1); }}>Deleted <span>{summary.deleted || 0}</span></button><button type="button" role="tab" aria-selected={status === 'all'} className={`status-tab ${status === 'all' ? 'active' : ''}`} onClick={() => { setStatus('all'); setTopOnly(false); setPage(1); }}>All</button></div><button className="a-icon" aria-label="Refresh inventory" disabled={loading} onClick={reload}><RefreshCw size={18} className={loading ? 'spin' : ''} /></button></div></div><div className="inventory-filters"><div className="inventory-search"><Search size={17} /><input aria-label="Search articles" placeholder="Find an article by name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />{search && <button aria-label="Clear search" onClick={() => { setSearch(''); setPage(1); }}><X size={15} /></button>}</div><select aria-label="Filter by collection" value={gender} onChange={e => { setGender(e.target.value); setPage(1); }}><option value="">All collections</option><option value="kids">Kids</option><option value="gents">Gents</option><option value="ladies">Ladies</option><option value="accessories">Accessories</option></select><select aria-label="Filter by priority" value={topOnly ? "only" : ""} onChange={e => { setTopOnly(e.target.value === "only"); if (e.target.value === "only") setStatus("active"); setPage(1); }}><option value="">All articles</option><option value="only">Top articles</option></select><select aria-label="Filter by stock" value={stock} onChange={e => { setStock(e.target.value); setPage(1); }}><option value="">All stock levels</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div>{error ? <div className="inventory-empty" role="alert"><CircleAlert /><h3>We couldn't load your inventory.</h3><p>{error}</p><button className="a-button secondary" onClick={reload}>Try again</button></div> : loading ? <div className="inventory-empty" role="status"><LoaderCircle className="spin" /><p>Finding your collection...</p></div> : articles.length ? <><div className="inventory-table-scroll"><table className="inventory-table"><thead><tr><th>Article</th><th>Collection</th><th>Size</th><th>Stock</th><th>Added on</th><th>Price</th><th>Discount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{articles.map(article => <tr key={article.id} className={article.isDeleted ? 'row-deleted' : ''}><td className="col-article"><div className="article-cell">{article.images[0] ? <img src={article.images[0].url} alt="" /> : <span className="article-placeholder"><Shirt size={21} /></span>}<div><strong>{article.name}</strong><small>#{article.id.slice(-8).toUpperCase()}</small></div></div></td><td className="col-collection">{{ kids: 'Kids', gents: 'Gents', ladies: 'Ladies', accessories: 'Accessories' }[article.category] || article.category}</td><td className="col-size"><span className="size-tag">{article.size}</span></td><td className="col-stock">{article.isDeleted ? <span className="stock-tag deleted"><i />Marked Deleted</span> : <span className={`stock-tag ${article.quantity === 0 ? 'out' : article.quantity <= 5 ? 'low' : ''}`}><i />{article.quantity === 0 ? 'Out of stock' : `${article.quantity} in stock`}</span>}</td><td className="col-date"><span className="table-date">{formatDate(article.createdAt)}</span></td><td className="col-price"><strong className="table-price">{currency(article.price)}</strong></td><td className={`col-discount ${Number(article.discount) > 0 ? '' : 'no-discount'}`}>{Number(article.discount) > 0 ? <span className="discount-tag">{Number(article.discount)}% off</span> : null}</td><td className="col-actions">{article.isDeleted ? <div className="row-actions"><button type="button" className="restore-btn" disabled={restoringId === article.id} aria-label={`Restore ${article.name}`} title="Restore article to storefront" onClick={() => restoreArticle(article)}><RotateCcw size={15} className={restoringId === article.id ? 'spin' : ''} /><span>Restore</span></button></div> : <div className="row-actions"><button type="button" className={article.topPosition ? "top-pin active" : "top-pin"} disabled={pinBusyId === article.id} aria-label={`${article.topPosition ? `Remove #${article.topPosition} ${article.name} from top` : `Add ${article.name} to top articles`}`} title={article.topPosition ? `Top #${article.topPosition}` : "Add to top"} onClick={() => toggleTop(article)}><Pin size={16} />{article.topPosition && <span>#{article.topPosition}</span>}</button><button aria-label={`Edit ${article.name}`} onClick={() => setEditor(article)}><Pencil size={16} /></button><button aria-label={`Delete ${article.name}`} onClick={() => { setDeleting(article); setDeleteError(''); }}><Trash2 size={16} /></button></div>}</td></tr>)}</tbody></table></div><div className="inventory-pagination"><span>Showing {(page - 1) * 12 + 1}-{Math.min(page * 12, paging.total)} of {paging.total} articles</span><div><button aria-label="Previous page" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><span>Page {page} of {paging.pages}</span><button aria-label="Next page" disabled={page >= paging.pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div></> : <div className="inventory-empty"><div className="empty-shirt"><Shirt size={30} /></div><h3>{status === 'deleted' ? 'No deleted articles.' : search || gender || stock || topOnly ? 'No matching articles.' : 'Your next chapter starts here.'}</h3><p>{status === 'deleted' ? 'Deleted articles will appear here so you can review or restore them.' : search || gender || stock || topOnly ? 'Try a different search or clear your filters.' : 'Add your first article and bring your collection together.'}</p>{status !== 'deleted' && <button className="a-button primary" onClick={() => { if (search || gender || stock || topOnly) { setSearch(''); setGender(''); setStock(''); setTopOnly(false); setPage(1); } else setEditor({ ...newArticle }); }}>{search || gender || stock || topOnly ? 'Clear filters' : 'Add your first article'} <Plus size={16} /></button>}</div>}</section><div className="inventory-bottom"><span>Thoughtfully picked. Beautifully organised.</span><span>Fashion Hub <span>FH</span></span></div></>}</main></div>{editor && <ArticleEditor article={editor} onClose={() => setEditor(null)} onExpired={onExpired} onRankChanged={reloadQuietly} onSaved={() => { setEditor(null); reload(); notify(editor.id ? 'Article updated successfully.' : 'New article added to your collection.'); }} />}{deleting && <Modal title="Mark article as deleted?" onClose={() => !deleteBusy && setDeleting(null)} compact><div className="delete-dialog"><div className="delete-symbol"><Trash2 size={25} /></div><p><strong>{deleting.name}</strong> will be marked as deleted and hidden from the storefront. You can view or restore it anytime from the "Deleted" tab.</p>{deleteError && <div className="a-error" role="alert">{deleteError}</div>}<div className="delete-actions"><button className="a-button secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep article</button><button className="a-button danger" disabled={deleteBusy} onClick={deleteArticle}>{deleteBusy ? 'Marking deleted...' : 'Mark as deleted'}</button></div></div></Modal>}</div>;
}

function Modal({ title, onClose, children, compact = false }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('button')?.focus();
    function onKey(e) {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab') return;
      const elements = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(el => el.offsetParent !== null);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className={`admin-overlay ${compact ? 'compact-overlay' : ''}`} onClick={onClose}><section ref={ref} className={`admin-dialog ${compact ? 'compact-dialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" onClick={e => e.stopPropagation()}><div className="editor-heading"><div><span className="a-eyebrow">YOUR COLLECTION</span><h2 id="admin-dialog-title">{title}</h2></div><button className="a-icon" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div>{children}</section></div>;
}

function ArticleEditor({ article, onClose, onSaved, onExpired, onRankChanged }) {
  const [form, setForm] = useState({ ...article });
  const [topPosition, setTopPosition] = useState(article.topPosition || '');
  const [savedTopPosition, setSavedTopPosition] = useState(article.topPosition || '');
  const [rankBusy, setRankBusy] = useState(false);
  const [existing, setExisting] = useState(article.images || []);
  const [files, setFiles] = useState([]);
  const [urls, setUrls] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const totalImages = existing.length + files.length + urls.length;
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach(item => URL.revokeObjectURL(item.preview)), []);
  function field(e) { const { name, value } = e.target; setForm(prev => name === 'category' ? ({ ...prev, category: value, gender: value === 'ladies' ? 'female' : value === 'accessories' ? 'unisex' : 'male' }) : ({ ...prev, [name]: value })); }
  function addFiles(e) {
    const additions = [...e.target.files]; e.target.value = '';
    if (totalImages + additions.length > 6) { setError('You can add up to 6 images.'); return; }
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/pjpeg', 'image/x-png'];
    const validExt = /\.(jpe?g|png|webp)$/i;
    if (additions.some(file => file.size > 5 * 1024 * 1024 || (!validMimes.includes(file.type?.toLowerCase()) && !validExt.test(file.name)))) {
      setError('Choose JPEG, PNG or WebP images up to 5 MB each.'); return;
    }
    setFiles(prev => [...prev, ...additions.map(file => ({ file, preview: URL.createObjectURL(file), id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID?.() || Date.now()}` }))]); setError('');
  }
  function addUrl() {
    try { const url = new URL(urlInput); if (url.protocol !== 'https:' || url.username || url.password || urlInput.length > 2048) throw new Error();
      if (totalImages >= 6) { setError('You can add up to 6 images.'); return; }
      setUrls(prev => [...prev, url.href]); setUrlInput(''); setError('');
    } catch { setError('Enter a valid HTTPS image URL without credentials.'); }
  }
  async function updateTopPosition() {
    setRankBusy(true); setError('');
    try {
      const data = await api(`/admin/articles/${article.id}/top`, { method: 'PATCH', body: { position: topPosition === '' ? null : Number(topPosition) } });
      setTopPosition(data.position || '');
      setSavedTopPosition(data.position || '');
      onRankChanged();
    } catch (e) { if (!onExpired(e)) setError(e.message); }
    finally { setRankBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); setError('');
    if (urlInput.trim()) { setError('Add the image link with the + button, or clear it before saving.'); return; }
    setBusy(true);
    const data = new FormData();
    const payload = {
      name: form.name,
      quantity: Number(form.quantity),
      size: form.size,
      gender: form.gender,
      category: form.category || (form.gender === 'male' ? 'gents' : 'ladies'),
      price: form.price,
      discount: (form.discount === '' || form.discount === null || form.discount === undefined) ? 0 : form.discount,
      ...(article.id ? { version: article.version } : {}),
      images: [...existing, ...urls.map(url => ({ type: 'url', url }))]
    };
    data.append('article', JSON.stringify(payload));
    files.forEach(item => data.append('images', item.file));
    try { await api(`/admin/articles${article.id ? `/${article.id}` : ''}`, { method: article.id ? 'PATCH' : 'POST', body: data }); onSaved(); }
    catch (e) { if (!onExpired(e)) setError(e.message); }
    finally { setBusy(false); }
  }
  const finalPrice = Number(form.price || 0) * (1 - Number(form.discount || 0) / 100);
  return <Modal title={article.id ? 'Edit article' : 'A new favourite.'} onClose={() => !busy && onClose()}><form className="article-editor" onSubmit={submit}><fieldset disabled={busy}><p className="editor-intro">The details that make this piece yours.</p>{error && <div className="a-error" role="alert"><CircleAlert size={17} />{error}</div>}<label>Article name <span>*</span><input autoComplete="off" name="name" placeholder="e.g. Everyday linen shirt - Sage" required maxLength={120} value={form.name} onChange={field} /><small>Give each article a unique, memorable name.</small></label><div className="editor-grid"><label>Collection <span>*</span><select name="category" value={form.category || (form.gender === 'male' ? 'gents' : 'ladies')} onChange={field}><option value="kids">Kids</option><option value="gents">Gents</option><option value="ladies">Ladies</option><option value="accessories">Accessories</option></select></label><label className="size-custom-field">Size <span>*</span><div className="size-chip-grid">{sizeOptions.map(s => <button type="button" key={s} className={form.size === s ? 'active' : ''} onClick={() => setForm(prev => ({ ...prev, size: s }))}>{s}</button>)}</div><input name="size" required maxLength={40} placeholder="Or type custom size" value={form.size} onChange={field} /><small>Tap a size above or type your own custom size.</small></label></div><label>Gender<select name="gender" value={form.gender} onChange={field}><option value="female">Female</option><option value="male">Male</option><option value="unisex">Unisex</option></select><small>Auto-selected from collection: Gents/Kids = Male, Ladies = Female, Accessories = Unisex.</small></label><div className="editor-grid"><label>Quantity <span>*</span><input name="quantity" type="number" min="0" max="1000000" step="1" required value={form.quantity} onChange={field} /></label><label>Price (Rs.) <span>*</span><input name="price" type="number" min="0" max="9999999.99" step="0.01" required placeholder="0.00" value={form.price} onChange={field} /></label></div><div className="editor-grid"><label>Discount (%)<input name="discount" type="number" min="0" max="100" step="0.01" required value={form.discount} onChange={field} /></label><div className="sale-price"><span>Price after discount</span><strong>{currency(Math.max(0, finalPrice))}</strong></div></div>{article.id && <div className="editor-top-rank"><label>Top article position<input type="number" min="1" step="1" inputMode="numeric" placeholder="Not in top articles" value={topPosition} onChange={e => setTopPosition(e.target.value)} /><small>Enter a position to move this article there. Clear it to remove the article. Other positions adjust automatically.</small></label><button type="button" className="a-button secondary" disabled={rankBusy || busy || String(topPosition) === String(savedTopPosition)} onClick={updateTopPosition}>{rankBusy ? "Updating..." : "Update top position"}</button></div>}<div className="editor-divider" /><div className="image-section-title"><h3>Article images</h3><span>{totalImages} / 6 images</span></div><p className="image-help">Let the details do the talking. The first image is your cover.</p><div className="editor-images">{existing.map((image, i) => <ImagePreview key={`existing-${i}`} url={image.url} label={`Remove existing image ${i + 1}`} onRemove={() => setExisting(items => items.filter((_, j) => i !== j))} />)}{urls.map((url, i) => <ImagePreview key={`url-${i}`} url={url} label={`Remove image link ${i + 1}`} onRemove={() => setUrls(items => items.filter((_, j) => i !== j))} />)}{files.map((item, i) => <ImagePreview key={item.id} url={item.preview} label={`Remove new image ${i + 1}`} onRemove={() => setFiles(items => { URL.revokeObjectURL(items[i].preview); return items.filter((_, j) => i !== j); })} />)}</div>{totalImages < 6 && <label className="image-upload"><ImagePlus size={25} /><strong>Choose your images</strong><span>JPEG, PNG or WebP - up to 5 MB each</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload article images" onChange={addFiles} /></label>}<label className="image-url-label">Or add an image link<div className="image-url-input"><input type="url" placeholder="https://your-image-url.com/photo.jpg" value={urlInput} onChange={e => setUrlInput(e.target.value)} disabled={totalImages >= 6} /><button type="button" aria-label="Add image link" disabled={totalImages >= 6 || !urlInput.trim()} onClick={addUrl}><Plus size={18} /></button></div></label></fieldset><div className="editor-actions"><button type="button" disabled={busy} className="a-button secondary" onClick={onClose}>Cancel</button><button disabled={busy} className="a-button primary">{busy ? <><LoaderCircle className="spin" size={17} /> Saving...</> : <>{article.id ? 'Save changes' : 'Add article'} <Check size={17} /></>}</button></div></form></Modal>;
}

function ImagePreview({ url, label, onRemove }) {
  return <div className="editor-image"><img src={url} alt="Article preview" /><button type="button" aria-label={label} onClick={onRemove}><X size={13} /></button></div>;
}
