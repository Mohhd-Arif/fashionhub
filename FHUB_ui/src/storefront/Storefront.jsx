import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Heart, Home, Image, Leaf, LoaderCircle, LogOut, MapPin, Menu, Minus, Package, Phone, Plus, Search, Shirt, ShoppingBag, SlidersHorizontal, Sparkles, User, X } from 'lucide-react';
import { api } from '../admin/api';
import './storefront.css';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
const salePrice = article => Number(article.price) * (1 - Number(article.discount) / 100);
const readList = key => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };

export default function Storefront() {
  const [settings, setSettings] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [catalogue, setCatalogue] = useState({ articles: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState('');
  const [saved, setSaved] = useState(() => readList('fhub-saved').filter(id => typeof id === 'string'));
  const [savedOnly, setSavedOnly] = useState(false);
  const [bag, setBag] = useState(() => readList('fhub-bag').filter(item => typeof item?.id === 'string' && Number.isInteger(item.qty) && item.qty > 0));
  const [bagOpen, setBagOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [savedItems, setSavedItems] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api('/storefront', { signal: controller.signal }).then(data => { setSettings(data.storefront); setFeatured(data.featured); document.title = `${data.storefront.storeName} — Everyday style`; }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    api('/auth/me', { signal: controller.signal }).then(data => setUser(data.user)).catch(() => {});
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setCatalogueError('');
    const timeout = setTimeout(async () => {
      try {
        if (savedOnly) {
          const result = await Promise.all(saved.map(id => api(`/articles/${id}`, { signal: controller.signal }).then(data => data.article).catch(e => { if (e.status === 404) return null; throw e; })));
          if (!controller.signal.aborted) setSavedItems(result.filter(Boolean));
        } else {
          const query = new URLSearchParams({ category, search, sort, page: String(page) });
          const data = await api(`/articles?${query}`, { signal: controller.signal });
          if (!controller.signal.aborted) { if (page > data.pages) setPage(data.pages); else setCatalogue(data); }
        }
      } catch (e) { if (!controller.signal.aborted) setCatalogueError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [category, search, sort, page, savedOnly, saved, reload]);
  useEffect(() => { try { localStorage.setItem('fhub-saved', JSON.stringify(saved)); } catch {} }, [saved]);
  useEffect(() => { try { localStorage.setItem('fhub-bag', JSON.stringify(bag)); } catch {} }, [bag]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);

  function browse(nextCategory = '') {
    setCategory(nextCategory); setPage(1); setSavedOnly(false); setSearch(''); setMenu(false);
    document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
  }
  function showSaved() { setSavedOnly(true); setMenu(false); document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' }); }
  async function viewArticle(article) {
    try { setSelected((await api(`/articles/${article.id}`)).article); }
    catch (e) { setNotice(e.message); }
  }
  async function addToBag(article, qty) {
    try {
      const current = (await api(`/articles/${article.id}`)).article;
      const existing = bag.find(item => item.id === current.id)?.qty || 0;
      if (current.quantity < existing + qty) { setNotice(`Only ${current.quantity} available. You already have ${existing} in your bag.`); return; }
      setBag(items => items.some(item => item.id === current.id) ? items.map(item => item.id === current.id ? { ...current, qty: item.qty + qty } : item) : [...items, { ...current, qty }]);
      setSelected(null); setNotice('A new favourite added to your bag.');
    } catch (e) { setNotice(e.message); }
  }
  async function signOut() {
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); setAccount(false); setNotice('You have signed out.'); }
    catch (e) { setNotice(e.message); }
  }
  if (!settings) return <div className="shop-loading">{error ? <><Shirt size={35} /><h1>We'll be right with you.</h1><p>{error}</p><button className="s-button" onClick={() => setReload(v => v + 1)}>Try again</button><a href="/login">Sign in</a></> : <><LoaderCircle className="spin" /><p>A little style, on its way…</p></>}</div>;
  const articles = savedOnly ? savedItems : catalogue.articles;
  const total = bag.reduce((sum, item) => sum + item.qty, 0);
  return <div className="shop-app"><div className="shop-announcement"><Sparkles size={13} /><span>{settings.announcement}</span><ArrowUpRight size={13} /></div><header className="shop-header"><a href="/" className="shop-brand">{settings.storeName}<span>✳</span></a><nav aria-label="Shop navigation"><button onClick={() => browse()}>Discover</button>{settings.slides.map(slide => <button key={slide.id} onClick={() => browse(slide.id)}>{slide.label}</button>)}<a href="#story">Our story <ArrowUpRight size={12} /></a></nav><div className="shop-actions"><button aria-label="Search articles" onClick={() => setSearchOpen(!searchOpen)}><Search size={20} /></button><button aria-label="Your wishlist" className="desktop-action" onClick={showSaved}><Heart size={20} />{saved.length > 0 && <small>{saved.length}</small>}</button><button aria-label="Your account" className="account-button" onClick={() => user ? setAccount(!account) : window.location.assign('/login')}><User size={20} /></button><button aria-label={`Shopping bag, ${total} items`} className="shop-bag-button" onClick={() => setBagOpen(true)}><ShoppingBag size={19} /><span className="desktop-action">Bag</span><b>{total}</b></button><button aria-label="Toggle navigation" aria-expanded={menu} className="shop-menu-button" onClick={() => setMenu(!menu)}>{menu ? <X size={21} /> : <Menu size={21} />}</button></div>{account && user && <div className="account-popover"><strong>Welcome back</strong><span>{user.email}</span>{user.usertype === 'admin' && <a href="/admin">Manage your store <ArrowUpRight size={15} /></a>}<button onClick={signOut}><LogOut size={15} /> Sign out</button></div>}</header>{menu && <nav className="shop-mobile-menu" aria-label="Mobile collections">{settings.slides.map(slide => <button key={slide.id} onClick={() => browse(slide.id)}>{slide.label}<ArrowUpRight size={16} /></button>)}<a href="/login">My account <User size={16} /></a></nav>}{searchOpen && <form className="shop-search" onSubmit={e => { e.preventDefault(); document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' }); }}><Search size={18} /><input autoFocus aria-label="Find clothing" placeholder="Find your next favourite…" maxLength={120} value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSavedOnly(false); setCategory(''); }} /><button type="submit">Find <ArrowRight size={16} /></button><button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setSearch(''); }}><X size={18} /></button></form>}<main><Hero settings={settings} featured={featured} onBrowse={browse} onArticle={viewArticle} /><div className="shop-values"><span><Leaf size={17} /> Feel-good everyday fits</span><i /><span><Sparkles size={17} /> A style for every you</span><i /><span><Shirt size={17} /> Kids. Gents. Ladies.</span></div><FeaturedArticles settings={settings} onBrowse={browse} onArticle={viewArticle} /><section className="shop-section collections-section" id="collections"><div className="shop-section-heading"><div><span className="s-eyebrow">THREE COLLECTIONS. ENDLESS POSSIBILITIES.</span><h2>{settings.collectionHeading}</h2></div><p>{settings.collectionDescription}</p></div><div className="shop-collections">{settings.slides.map((slide, i) => <button key={slide.id} className={`shop-collection collection-${slide.id}`} onClick={() => browse(slide.id)}><img src={slide.image.url} alt={`${slide.label} collection`} loading="lazy" /><span className="collection-no">0{i + 1}</span><span className="shop-collection-caption"><span><small>{slide.eyebrow}</small><strong>{slide.label}</strong></span><span><ArrowUpRight size={23} /></span></span></button>)}</div></section><section className="shop-section catalogue-section" id="catalogue"><div className="shop-section-heading"><div><span className="s-eyebrow">THE ONES YOU'LL REACH FOR</span><h2>{savedOnly ? 'Saved for a little later.' : settings.catalogueHeading}</h2></div><p>{settings.catalogueDescription}</p></div><div className="catalogue-toolbar"><div className="shop-tabs"><button className={!category && !savedOnly ? 'active' : ''} onClick={() => browse()}>All styles</button>{settings.slides.map(slide => <button className={category === slide.id && !savedOnly ? 'active' : ''} key={slide.id} onClick={() => browse(slide.id)}>{slide.label}</button>)}</div>{!savedOnly && <label className="shop-sort"><SlidersHorizontal size={14} /><select aria-label="Sort articles" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="newest">Newest arrivals</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>}</div>{loading ? <div className="shop-empty" role="status"><LoaderCircle className="spin" /><p>Finding your favourites…</p></div> : catalogueError ? <div className="shop-empty" role="alert"><p>{catalogueError}</p><button className="s-button" onClick={() => setReload(v => v + 1)}>Try again</button></div> : articles.length ? <><div className="shop-products">{articles.map(article => <article className="shop-product" key={article.id}><div className="shop-product-image"><button onClick={() => viewArticle(article)} aria-label={`View ${article.name}`}><ProductImage article={article} /></button>{Number(article.discount) > 0 && <span className="shop-discount">{Number(article.discount)}% OFF</span>}<button className={`shop-heart ${saved.includes(article.id) ? 'is-saved' : ''}`} aria-label={`${saved.includes(article.id) ? 'Unsave' : 'Save'} ${article.name}`} aria-pressed={saved.includes(article.id)} onClick={() => setSaved(items => items.includes(article.id) ? items.filter(id => id !== article.id) : [...items, article.id])}><Heart size={18} /></button><button className="shop-quickview" onClick={() => viewArticle(article)}>Take a closer look <Plus size={15} /></button></div><div className="shop-product-details"><div className="product-collection-name">{settings.slides.find(s => s.id === article.category)?.label} <span>Size {article.size}</span></div><h3><button onClick={() => viewArticle(article)}>{article.name}</button></h3><div><strong>{money(salePrice(article))}</strong>{Number(article.discount) > 0 && <del>{money(article.price)}</del>}{article.quantity === 0 ? <span className="product-stock-out">Sold out</span> : article.quantity <= 5 && <span className="product-stock-low">Only {article.quantity} left</span>}</div></div></article>)}</div>{!savedOnly && catalogue.pages > 1 && <div className="shop-pagination"><button aria-label="Previous articles" disabled={page === 1} onClick={() => setPage(v => v - 1)}><ChevronLeft size={20} /></button><span>{page} / {catalogue.pages}</span><button aria-label="Next articles" disabled={page >= catalogue.pages} onClick={() => setPage(v => v + 1)}><ChevronRight size={20} /></button></div>}</> : <div className="shop-empty"><span className="shop-empty-icon"><Shirt size={30} /></span><h3>{savedOnly ? 'A little room for your favourites.' : search ? 'No matches just yet.' : 'Fresh favourites are on their way.'}</h3><p>{savedOnly ? 'Tap the heart on a piece you love to save it here.' : search ? 'Try a different name or explore another collection.' : 'Come back soon for new pieces picked for your everyday.'}</p>{(category || search || savedOnly) && <button className="s-button light" onClick={() => browse()}>Explore all styles <ArrowRight size={17} /></button>}{user?.usertype === 'admin' && <a className="s-text-link" href="/admin">Add your first article <Plus size={16} /></a>}</div>}<div className="catalogue-footnote"><span>✳</span> Thoughtfully picked. Made to be worn on repeat.</div></section>{settings.showStory && <section className="shop-section shop-story" id="story"><div><img src={settings.storyImage.url} alt={settings.storyHeading} loading="lazy" /><span className="shop-story-sticker">A LITTLE LOCAL.<strong>A lot to love.</strong><Heart size={20} /></span></div><div><span className="s-eyebrow">THE STORY BEHIND YOUR STYLE</span><h2>{settings.storyHeading}</h2><p>{settings.storyDescription}</p><a className="s-text-link" href="#contact">Come say hello <ArrowUpRight size={17} /></a><span className="story-signoff">{settings.storeName} <span>✳</span></span></div></section>}<section className="shop-section shop-contact" id="contact"><span className="contact-spark">✳</span><div><span className="s-eyebrow">YOUR NEIGHBOURHOOD. YOUR FASHION HUB.</span><h2>{settings.contactHeading}</h2><p>{settings.contactDescription}</p></div><div className="contact-details">{settings.address && <span><MapPin size={17} />{settings.address}</span>}{settings.hours && <small>{settings.hours}</small>}{settings.phone && <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`} className="s-button light"><Phone size={16} /> {settings.phone}</a>}</div></section></main><footer className="shop-footer"><div><a href="/" className="shop-brand">{settings.storeName}<span>✳</span></a><p>{settings.footerTagline}</p></div><div className="shop-footer-links"><a href="#featured">Top styles</a><a href="#contact">Visit us</a><a href="/login">{user ? 'My account' : 'Sign in'}</a><a href="/admin">Store admin <ArrowUpRight size={13} /></a></div><small>© {new Date().getFullYear()} {settings.storeName}. Made for your everyday.</small></footer><nav className="shop-bottom-nav" aria-label="Mobile shopping"><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Home size={20} /><span>Home</span></button><button onClick={() => browse()}><Shirt size={20} /><span>Explore</span></button><button onClick={showSaved}><Heart size={20} /><span>Saved</span></button><button onClick={() => setBagOpen(true)}><ShoppingBag size={20} /><span>Bag {total > 0 ? `(${total})` : ''}</span></button><button onClick={() => user ? setAccount(!account) : window.location.assign('/login')}><User size={20} /><span>Account</span></button></nav>{selected && <ProductDialog article={selected} onClose={() => setSelected(null)} onAdd={addToBag} />}{bagOpen && <Bag items={bag} setItems={setBag} onClose={() => setBagOpen(false)} onBrowse={() => { setBagOpen(false); browse(); }} phone={settings.phone} />}{notice && <div className="shop-toast" role="status"><Check size={17} /><span>{notice}</span></div>}</div>;
}

function Hero({ settings, featured, onBrowse, onArticle }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hovered, setHovered] = useState(false);
  const startX = useRef(null);
  const slide = settings.slides[index];
  const article = featured.find(item => item.id === slide.articleId);
  const heroPrice = article ? `${Number(article.discount) > 0 ? `${Number(article.discount)}% off. ` : ``}${money(salePrice(article))}` : `A little more you, every day.`;
  const advance = delta => { setIndex(i => (i + delta + settings.slides.length) % settings.slides.length); if (window.matchMedia(`(prefers-reduced-motion: reduce)`).matches) setPlaying(false); };
  useEffect(() => {
    if (!playing || hovered) return;
    const timer = setInterval(() => { if (!document.hidden) setIndex(i => (i + 1) % settings.slides.length); }, 5200);
    return () => clearInterval(timer);
  }, [playing, hovered, settings.slides.length]);
  return <section className={`shop-hero hero-${slide.id}`} aria-roledescription="carousel" aria-label="Kids, gents and ladies showcase" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => {}} onKeyDown={e => { if (e.key === `ArrowLeft`) advance(-1); if (e.key === `ArrowRight`) advance(1); }}><div className="shop-hero-copy" aria-live={playing ? `off` : `polite`}><span className="s-eyebrow"><i />{slide.eyebrow}</span><h1>{slide.title}</h1><p>{slide.description}</p><div className="shop-hero-buttons"><button className="s-button" onClick={() => onBrowse(slide.id)}>{slide.buttonLabel}<ArrowUpRight size={20} /></button>{article && <button className="s-text-link hero-featured-link" onClick={() => onArticle(article)}>{article.name}<ArrowRight size={16} /></button>}</div><div className="hero-bottom-note"><span>*</span><p>{slide.message}<br /><strong>{heroPrice}</strong></p></div></div><div className="shop-hero-picture" onTouchStart={e => { startX.current = e.touches[0].clientX; }} onTouchEnd={e => { if (startX.current === null) return; const delta = e.changedTouches[0].clientX - startX.current; if (Math.abs(delta) > 60) advance(delta < 0 ? 1 : -1); startX.current = null; }}><div className="hero-carousel-strip" style={{ transform: `translateX(-${index * 100}%)` }}>{settings.slides.map(item => <img key={item.id} src={item.image.url} alt={`${item.label} collection`} fetchPriority={item.id === slide.id ? `high` : `auto`} />)}</div></div></section>; 
}
function FeaturedArticles({ settings, onBrowse, onArticle }) {
  const [tab, setTab] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tabs = [{ id: '', label: 'All styles' }, ...settings.slides.map(slide => ({ id: slide.id, label: slide.label }))];
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams({ category: tab, search: '', sort: 'newest', page: '1' });
    api(`/articles?${query}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems((data.articles || []).slice(0, 5)); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab]);
  return <section className="shop-section featured-section" id="featured"><div className="featured-heading"><div><span className="s-eyebrow">HANDPICKED FROM THE SHOP</span><h2>Top articles for you.</h2><p>Fresh pieces selected from the inventory. Pick a section and see the first five.</p></div><button className="s-text-link" onClick={() => onBrowse(tab)}>Show all <ArrowRight size={16} /></button></div><div className="shop-tabs featured-tabs">{tabs.map(item => <button key={item.id || `all`} className={tab === item.id ? `active` : ``} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>{loading ? <div className="shop-empty compact-empty" role="status"><LoaderCircle className="spin" /><p>Loading top articles...</p></div> : error ? <div className="shop-empty compact-empty" role="alert"><p>{error}</p></div> : items.length ? <><div className="shop-products featured-products">{items.map(article => <article className="shop-product" key={article.id}><div className="shop-product-image"><button onClick={() => onArticle(article)} aria-label={`View ${article.name}`}><ProductImage article={article} /></button>{Number(article.discount) > 0 && <span className="shop-discount">{Number(article.discount)}% OFF</span>}<button className="shop-quickview" onClick={() => onArticle(article)}>View article <Plus size={15} /></button></div><div className="shop-product-details"><div className="product-collection-name">{settings.slides.find(s => s.id === article.category)?.label || `All styles`} <span>Size {article.size}</span></div><h3><button onClick={() => onArticle(article)}>{article.name}</button></h3><div><strong>{money(salePrice(article))}</strong>{Number(article.discount) > 0 && <del>{money(article.price)}</del>}{article.quantity === 0 ? <span className="product-stock-out">Sold out</span> : article.quantity <= 5 && <span className="product-stock-low">Only {article.quantity} left</span>}</div></div></article>)}</div><div className="featured-show-all"><button className="s-button light" onClick={() => onBrowse(tab)}>Show all {tabs.find(item => item.id === tab)?.label || `styles`} <ArrowRight size={17} /></button></div></> : <div className="shop-empty compact-empty"><span className="shop-empty-icon"><Shirt size={28} /></span><h3>No articles yet.</h3><p>Add articles from admin inventory and they will appear here.</p></div>}</section>;
}

function ProductImage({ article }) {
  const [failed, setFailed] = useState(false);
  if (!article.images?.[0]?.url || failed) return <span className="shop-image-placeholder"><Shirt size={38} /><small>{article.name}</small></span>;
  return <img src={article.images[0].url} alt={article.name} loading="lazy" onError={() => setFailed(true)} />;
}

function ShopModal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  const closer = useRef(onClose); closer.current = onClose;
  useEffect(() => {
    const oldFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('button')?.focus();
    function key(e) {
      if (e.key === 'Escape') closer.current();
      if (e.key === 'Tab') {
        const nodes = [...ref.current.querySelectorAll('button:not(:disabled),a[href],input,select')].filter(el => el.offsetParent !== null);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', key); oldFocus?.focus(); };
  }, []);
  return <div className={`shop-overlay ${className}`} onClick={onClose}><section ref={ref} className="shop-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-dialog-title" onClick={e => e.stopPropagation()}><div className="shop-dialog-heading"><h2 id="shop-dialog-title">{title}</h2><button aria-label="Close dialog" onClick={onClose}><X size={22} /></button></div>{children}</section></div>;
}

function ProductDialog({ article, onClose, onAdd }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  return <ShopModal title="A closer look." onClose={() => !busy && onClose()} className="product-modal"><div className="shop-detail"><div className="shop-detail-gallery"><div className="detail-main-image">{article.images[imageIndex] ? <img src={article.images[imageIndex].url} alt={article.name} /> : <ProductImage article={article} />}</div>{article.images.length > 1 && <div className="shop-thumbnails">{article.images.map((image, i) => <button key={i} aria-label={`View image ${i + 1}`} aria-pressed={i === imageIndex} onClick={() => setImageIndex(i)}><img src={image.url} alt="" /></button>)}</div>}</div><div className="shop-detail-info"><span className="s-eyebrow">{article.category} COLLECTION</span><h3>{article.name}</h3><div className="detail-pricing"><strong>{money(salePrice(article))}</strong>{Number(article.discount) > 0 && <><del>{money(article.price)}</del><span>{Number(article.discount)}% off</span></>}</div><div className="detail-size"><span>Your fit</span><strong>{article.size}</strong></div><p className="detail-stock">{article.quantity > 0 ? `${article.quantity} available in store` : 'Currently out of stock'}</p>{article.quantity > 0 && <div className="detail-quantity"><span>Quantity</span><div><button aria-label="Decrease quantity" disabled={qty <= 1 || busy} onClick={() => setQty(v => v - 1)}><Minus size={16} /></button><span>{qty}</span><button aria-label="Increase quantity" disabled={qty >= article.quantity || busy} onClick={() => setQty(v => v + 1)}><Plus size={16} /></button></div></div>}<button className="s-button" disabled={article.quantity === 0 || busy} onClick={async () => { setBusy(true); await onAdd(article, qty); setBusy(false); }}>{busy ? 'Adding…' : article.quantity === 0 ? 'Sold out' : 'Add to bag'}<ShoppingBag size={18} /></button><small>Your bag saves your favourites for a store enquiry. Availability is confirmed when you purchase.</small></div></div></ShopModal>;
}

function Bag({ items, setItems, onClose, onBrowse, phone }) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(items.map(async item => {
      try { const current = (await api(`/articles/${item.id}`)).article; return { ...current, qty: Math.min(item.qty, current.quantity) }; }
      catch (e) { if (e.status === 404) return null; throw e; }
    })).then(data => {
      if (!active) return;
      const next = data.filter(item => item && item.qty > 0);
      setChanged(next.length !== items.length || next.some((item, i) => item.qty !== items[i]?.qty || item.price !== items[i]?.price || item.discount !== items[i]?.discount));
      setItems(next);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  const total = items.reduce((sum, item) => sum + salePrice(item) * item.qty, 0);
  return <ShopModal title="Your little collection." onClose={onClose} className="bag-modal">{checking ? <div className="shop-empty"><LoaderCircle className="spin" /><p>Checking the latest stock…</p></div> : error ? <div className="shop-empty" role="alert"><p>{error}</p><button className="s-button light" onClick={onClose}>Close and try again</button></div> : !items.length ? <div className="shop-empty"><ShoppingBag size={32} /><h3>A little room for something you love.</h3><p>Your bag is waiting for its first favourite.</p><button className="s-button" onClick={onBrowse}>Explore the collection <ArrowRight size={17} /></button></div> : <><div className="live-bag-items">{changed && <p className="bag-update" role="status">Your bag has been updated with the latest prices and available stock.</p>}{items.map(item => <article className="live-bag-item" key={item.id}><div><ProductImage article={item} /></div><div><h3>{item.name}</h3><p>Size {item.size}</p><strong>{money(salePrice(item))}</strong><div className="live-bag-quantity"><button aria-label={`Remove one ${item.name}`} onClick={() => setItems(previous => previous.map(p => p.id === item.id ? { ...p, qty: p.qty - 1 } : p).filter(p => p.qty > 0))}><Minus size={14} /></button><span>{item.qty}</span><button aria-label={`Add one ${item.name}`} disabled={item.qty >= item.quantity} onClick={() => setItems(previous => previous.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p))}><Plus size={14} /></button></div></div><button aria-label={`Remove ${item.name}`} onClick={() => setItems(previous => previous.filter(p => p.id !== item.id))}><X size={17} /></button></article>)}</div><div className="live-bag-total"><div><span>Estimated total</span><strong>{money(total)}</strong></div><p>Contact the store to confirm availability and place your order. No payment is taken online.</p>{phone ? <a className="s-button" href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Phone size={17} /> Call the store</a> : <button className="s-button" onClick={() => { onClose(); document.getElementById('contact').scrollIntoView({ behavior: 'smooth' }); }}>Visit the store <ArrowUpRight size={17} /></button>}</div></>}</ShopModal>;
}
