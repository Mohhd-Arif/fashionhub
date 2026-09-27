import ThemedSelect from '../components/ThemedSelect';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock, Heart, Home, Image, Leaf, LoaderCircle, LogOut, MapPin, Megaphone, Menu, MessageCircle, Minus, Package, Phone, Plus, Search, Shirt, ShoppingBag, SlidersHorizontal, Sparkles, User, X } from 'lucide-react';
import { api } from '../admin/api';
import { productWhatsAppUrl } from './productShare';
import './storefront.css';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
const salePrice = article => Number(article.price) * (1 - Number(article.discount) / 100);
const readList = key => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const whatsappNumber = '919330820717';
const whatsappText = encodeURIComponent('Hi Fashion Hub, I am interested in your clothes. Please share more details.');
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;
const facebookUrl = 'https://www.facebook.com/profile.php?id=61593967649897&rdid=LTE9XDA04rGYATNy&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F19TfZeabfV%2F#';
const mapUrl = 'https://maps.app.goo.gl/F1Y581JwZa34DwjCA';
const mapQuery = 'Fashion Hub, Chargaha Rd, Turkauliya, Bihar 845437';
const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;


function cleanText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\u00e2\u20ac\u201d/g, '-')
    .replace(/\u00e2\u20ac\u00a6/g, '...')
    .replace(/\u00e2\u0153\u00b3/g, '')
    .replace(/\u00c2\u00a9/g, '(c)')
    .replace(/[\u00e2\u20ac\u201d\u00a6\u0153\u00b3\u00c2\u00a9]/g, '')
    .replace(/\bA[O0]E\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function cleanData(value) {
  if (Array.isArray(value)) return value.map(cleanData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanData(item)]));
  return cleanText(value);
}

const defaultCrop = { x: 0, y: 0, width: 100, height: 100 };
function cleanCrop(value) {
  const source = value && typeof value === 'object' ? value : defaultCrop;
  const width = Math.min(100, Math.max(12, Number(source.width) || 100));
  const height = Math.min(100, Math.max(12, Number(source.height) || 100));
  const x = Math.min(100 - width, Math.max(0, Number(source.x) || 0));
  const y = Math.min(100 - height, Math.max(0, Number(source.y) || 0));
  return { x, y, width, height };
}
function cropBackground(image, crop) {
  const item = cleanCrop(crop);
  const x = item.width >= 100 ? 50 : (item.x / (100 - item.width)) * 100;
  const y = item.height >= 100 ? 50 : (item.y / (100 - item.height)) * 100;
  return { backgroundImage: `url(${image?.url})`, backgroundSize: `${10000 / item.width}% ${10000 / item.height}%`, backgroundPosition: `${x}% ${y}%` };
}
function CroppedImage({ image, crop, alt = '', className = '', loading, priority }) {
  return <span className={`cropped-image ${className}`} role="img" aria-label={alt} style={cropBackground(image, crop)}>{image?.url && <img src={image.url} alt="" loading={loading} fetchPriority={priority} aria-hidden="true" />}</span>;
}


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
  const [view, setView] = useState(() => window.location.pathname.startsWith('/favorites') ? 'favorites' : window.location.pathname.startsWith('/explore') ? 'explore' : 'home');

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api('/storefront', { signal: controller.signal }).then(data => { const storefront = cleanData(data.storefront); const topFeatured = cleanData(data.featured || []); setSettings(storefront); setFeatured(topFeatured); document.title = `${cleanText(storefront.storeName) || 'Fashion Hub'} - Everyday style`; }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    api('/auth/me', { signal: controller.signal }).then(data => setUser(data.user)).catch(() => { });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setCatalogueError('');
    const timeout = setTimeout(async () => {
      try {
        if (savedOnly) {
          if (!saved.length) {
            setSavedItems([]);
            setLoading(false);
            return;
          }
          const result = await Promise.all(saved.map(id => api(`/articles/${id}`, { signal: controller.signal }).then(data => data.article).catch(e => { if (e.status === 404) return null; throw e; })));
          if (!controller.signal.aborted) setSavedItems(cleanData(result.filter(Boolean)));
        } else {
          const query = new URLSearchParams({ category, search, sort, page: String(page), limit: '12' });
          const data = await api(`/articles?${query}`, { signal: controller.signal });
          if (!controller.signal.aborted) { if (page > data.pages) setPage(data.pages); else setCatalogue(cleanData(data)); }
        }
      } catch (e) { if (!controller.signal.aborted) setCatalogueError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [category, search, sort, page, savedOnly, reload]);

  useEffect(() => { try { localStorage.setItem('fhub-saved', JSON.stringify(saved)); } catch { } }, [saved]);
  useEffect(() => { try { localStorage.setItem('fhub-bag', JSON.stringify(bag)); } catch { } }, [bag]);
  useEffect(() => { if (view === 'favorites') setSavedOnly(true); else setSavedOnly(false); }, [view]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);

  const toggleSave = (articleId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const exists = saved.includes(articleId);
    setSaved(items => exists ? items.filter(id => id !== articleId) : [...items, articleId]);
    if (savedOnly) {
      if (exists) setSavedItems(items => items.filter(item => item.id !== articleId));
      else {
        const article = selected?.id === articleId ? selected : featured.find(item => item.id === articleId) || catalogue.articles.find(item => item.id === articleId);
        if (article) setSavedItems(items => items.some(item => item.id === articleId) ? items : [...items, article]);
      }
    }
    setNotice(exists ? 'Removed from your wishlist.' : 'Saved to your wishlist!');
  };

  function routeFromPath() { return window.location.pathname.startsWith('/favorites') ? 'favorites' : window.location.pathname.startsWith('/explore') ? 'explore' : 'home'; }
  function syncRoute() {
    const nextView = routeFromPath();
    setView(nextView);
    if (nextView === 'explore') {
      setSavedOnly(false);
      setCategory(new URLSearchParams(window.location.search).get('collection') || '');
      setPage(1);
    } else if (nextView === 'favorites') {
      setSavedOnly(true);
      setCategory('');
      setSearch('');
      setPage(1);
    } else {
      setSavedOnly(false);
      setCategory('');
      setSearch('');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function go(next, path) {
    setView(next);
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  useEffect(() => {
    syncRoute();
    const sync = () => syncRoute();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function browse(nextCategory = '') {
    setCategory(nextCategory);
    setPage(1);
    setSavedOnly(false);
    setSearch('');
    setMenu(false);
    go('explore', nextCategory ? `/explore?collection=${nextCategory}` : '/explore');
  }

  function showSaved() {
    setSavedOnly(true);
    setCategory('');
    setSearch('');
    setMenu(false);
    go('favorites', '/favorites');
  }

  function goHome() {
    setSavedOnly(false);
    setCategory('');
    setSearch('');
    setMenu(false);
    go('home', '/');
  }

  async function viewArticle(article) {
    try { setSelected(cleanData((await api(`/articles/${article.id}`)).article)); }
    catch (e) { setNotice(e.message); }
  }
  async function addToBag(article, qty) {
    try {
      const current = cleanData((await api(`/articles/${article.id}`)).article);
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
  if (!settings) return <div className="shop-loading">{error ? <><Shirt size={35} /><h1>We'll be right with you.</h1><p>{error}</p><button className="s-button" onClick={() => setReload(v => v + 1)}>Try again</button><a href="/login">Sign in</a></> : <><LoaderCircle className="spin" /><p>A little style, on its way...</p></>}</div>;
  const articles = savedOnly ? savedItems : catalogue.articles;
  const total = bag.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className={`shop-app view-${view}`}>
      <header className="shop-header">
        <Logo name={settings.storeName} onHome={goHome} />
        <nav aria-label="Shop navigation">
          <button className={view === 'home' ? 'active' : ''} onClick={goHome}>Home</button>
          <button className={view === 'explore' && !category ? 'active' : ''} onClick={() => browse('')}>All styles</button>
          {settings.slides.map(slide => <button className={view === 'explore' && category === slide.id ? 'active' : ''} key={slide.id} onClick={() => browse(slide.id)}>{slide.label}</button>)}
          <button className={view === 'explore' && category === 'accessories' ? 'active' : ''} onClick={() => browse('accessories')}>Accessories</button>
          <button onClick={() => { if (view !== 'home') { goHome(); setTimeout(() => document.getElementById('story')?.scrollIntoView({ behavior: 'smooth' }), 50); } else { document.getElementById('story')?.scrollIntoView({ behavior: 'smooth' }); } }}>Our story <ArrowUpRight size={12} /></button>
        </nav>
        <div className="shop-actions">
          <button aria-label="Search articles" onClick={() => setSearchOpen(!searchOpen)}><Search size={20} /></button>
          <button aria-label="Your wishlist" className={`desktop-action ${view === 'favorites' ? 'active' : ''}`} onClick={showSaved}><Heart size={20} />{saved.length > 0 && <small>{saved.length}</small>}</button>
          <button aria-label="Your account" className="account-button" onClick={() => user ? setAccount(!account) : window.location.assign('/login')}><User size={20} /></button>
          <button aria-label={`Shopping bag, ${total} items`} className="shop-bag-button" onClick={() => setBagOpen(true)}><ShoppingBag size={19} /><span className="desktop-action">Bag</span><b>{total}</b></button>
          <button aria-label="Toggle navigation" aria-expanded={menu} className="shop-menu-button" onClick={() => setMenu(!menu)}>{menu ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {account && user && (
          <div className="account-popover">
            <strong>Welcome back</strong>
            <span>{user.email}</span>
            {user?.usertype === 'admin' && <a href="/admin">Manage your store <ArrowUpRight size={15} /></a>}
            <button onClick={signOut}><LogOut size={15} /> Sign out</button>
          </div>
        )}
      </header>

      <MovingBanner onBrowse={() => browse('')} />

      {menu && (
        <nav className="shop-mobile-menu" aria-label="Mobile collections">
          <button onClick={goHome}>Home <ArrowUpRight size={16} /></button>
          <button onClick={() => browse('')}>All styles <ArrowUpRight size={16} /></button>
          {settings.slides.map(slide => <button key={slide.id} onClick={() => browse(slide.id)}>{slide.label}<ArrowUpRight size={16} /></button>)}
          <button onClick={() => browse('accessories')}>Accessories <ArrowUpRight size={16} /></button>
          <button onClick={showSaved}>Saved items ({saved.length}) <Heart size={16} /></button>
          <a href="/login">{user ? 'My account' : 'Sign in'} <User size={16} /></a>
        </nav>
      )}
      <SidebarDrawer
        open={menu}
        onClose={() => setMenu(false)}
        settings={settings}
        user={user}
        savedCount={saved.length}
        bagCount={total}
        onGoHome={() => { setMenu(false); goHome(); }}
        onBrowse={cat => { setMenu(false); browse(cat); }}
        onSaved={() => { setMenu(false); showSaved(); }}
        onOpenBag={() => { setMenu(false); setBagOpen(true); }}
        onOpenSearch={() => { setMenu(false); setSearchOpen(true); }}
        onSignOut={signOut}
        phone={settings.phone}
        whatsappUrl={whatsappUrl}
        mapUrl={mapUrl}
        mapQuery={mapQuery}
      />

      {searchOpen && (
        <form
          className="shop-search"
          onSubmit={e => {
            e.preventDefault();
            setSavedOnly(false);
            setView('explore');
            window.history.pushState({}, '', '/explore');
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        >
          <Search size={18} />
          <input
            autoFocus
            aria-label="Find clothing"
            placeholder="Find your next favourite..."
            maxLength={120}
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
              setSavedOnly(false);
              setCategory('');
              if (view !== 'explore') setView('explore');
            }}
          />
          <button type="submit">Find <ArrowRight size={16} /></button>
          <button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setSearch(''); }}><X size={18} /></button>
        </form>
      )}

      <main>
        {view === 'home' && (
          <>
            <Hero settings={settings} featured={featured} onBrowse={browse} onArticle={viewArticle} />
            <div className="shop-values">
              <span><Leaf size={17} /> Feel-good everyday fits</span>
              <i />
              <span><Sparkles size={17} /> A style for every you</span>
              <i />
              <span><Shirt size={17} /> Kids. Gents. Ladies.</span>
            </div>
            <section className="shop-section home-category-section" aria-label="Shop by category">
              <CategoryAvatarStrip onSelect={cat => browse(cat)} />
            </section>
            <FeaturedArticles settings={settings} featured={featured} onBrowse={browse} onArticle={viewArticle} onAdd={addToBag} saved={saved} onToggleSave={toggleSave} />
            <section className="shop-section collections-section" id="collections">
              <div className="shop-section-heading">
                <div>
                  <span className="s-eyebrow">THREE COLLECTIONS. ENDLESS POSSIBILITIES.</span>
                  <h2>{settings.collectionHeading}</h2>
                </div>
                <p>{settings.collectionDescription}</p>
              </div>
              <div className="shop-collections">
                {settings.slides.map((slide, i) => (
                  <button key={slide.id} className={`shop-collection collection-${slide.id}`} onClick={() => browse(slide.id)}>
                    <CroppedImage image={slide.image} crop={slide.imageCrop} alt={`${slide.label} collection`} loading="lazy" />
                    <span className="collection-no">0{i + 1}</span>
                    <span className="shop-collection-caption">
                      <span><small>{slide.eyebrow}</small><strong>{slide.label}</strong></span>
                      <span><ArrowUpRight size={23} /></span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            {settings.showStory && (
              <section className="shop-section shop-story" id="story">
                <div>
                  <CroppedImage image={settings.storyImage} crop={settings.storyCrop} alt={settings.storyHeading} loading="lazy" />
                  <span className="shop-story-sticker">A LITTLE LOCAL.<strong>A lot to love.</strong><Heart size={20} /></span>
                </div>
                <div>
                  <span className="s-eyebrow">THE STORY BEHIND YOUR STYLE</span>
                  <h2>{settings.storyHeading}</h2>
                  <p>{settings.storyDescription}</p>
                </div>
              </section>
            )}
            <section className="shop-section shop-contact" id="contact">
              <div className="contact-visiting-card">
                <div className="contact-card-identity">
                  <div className="contact-card-brand">
                    <span className="contact-card-logo"><img src="/images/fhub-logo.jpeg" alt="" /></span>
                    <div>
                      <span className="s-eyebrow">YOUR NEIGHBOURHOOD. YOUR FASHION HUB.</span>
                      <h2>{settings.storeName}</h2>
                    </div>
                  </div>
                  <div className="contact-card-intro">
                    <strong>{settings.contactHeading}</strong>
                    <p>{settings.contactDescription}</p>
                  </div>
                  <span className="contact-card-signature">FASHION HUB · TURKAULIYA</span>
                </div>

                <div className="contact-details">
                  {settings.address && (
                    <a className="contact-card contact-address" href={mapUrl} target="_blank" rel="noreferrer">
                      <span className="contact-card-icon"><MapPin size={17} /></span>
                      <span><small>Visit our store</small><strong>{settings.address}</strong></span>
                      <ArrowUpRight size={16} className="contact-card-arrow" />
                    </a>
                  )}
                  <div className="contact-card-actions">
                    {settings.hours && (
                      <span className="contact-card contact-hours">
                        <span className="contact-mini-icon"><Clock size={15} /></span>
                        <span className="contact-mini-copy"><small>Open daily</small><strong>{settings.hours}</strong></span>
                      </span>
                    )}
                    {settings.phone && (
                      <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`} className="contact-phone-btn">
                        <span className="contact-mini-icon"><Phone size={15} /></span>
                        <span className="contact-mini-copy"><small>Call us</small><strong>{settings.phone}</strong></span>
                      </a>
                    )}
                    <a className="contact-whatsapp-btn" href={whatsappUrl} target="_blank" rel="noreferrer">
                      <span className="contact-mini-icon"><img src="/images/whatsapp-icon.png" alt="" /></span>
                      <span className="contact-mini-copy"><small>Message</small><strong>WhatsApp</strong></span>
                    </a>
                  </div>
                </div>
              </div>
            </section>
            <section className="shop-section shop-map-section" aria-labelledby="shop-map-title">
              <div className="shop-map-copy">
                <span className="s-eyebrow">FIND US ON GOOGLE MAPS</span>
                <h2 id="shop-map-title">Visit Fashion Hub.</h2>
                <p>Tap the map to open our shop page in Google Maps and get directions.</p>
                <a className="s-button light" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17} /> Open in Google Maps</a>
              </div>
            </section>
          </>
        )}

        {(view === 'explore' || view === 'favorites') && (
          <section className="shop-section catalogue-section" id="catalogue">
            {view === 'favorites' && (
              <div className="shop-section-heading">
                <div>
                  <span className="s-eyebrow">YOUR WISHLIST</span>
                  <h2>Saved for a little later.</h2>
                </div>
                <p>Here are the pieces you have kept close to your heart.</p>
              </div>
            )}

            {view === 'explore' && (
              <div className="explore-header-panel">
                <CategoryAvatarStrip category={category} onSelect={cat => browse(cat === category ? '' : cat)} />
                <div className="catalogue-toolbar">
                  <div className="catalogue-count">
                    {category && (
                      <button
                        type="button"
                        className="clear-cat-btn"
                        onClick={() => browse('')}
                        title="Show all styles"
                      >
                        <span className="active-cat-tag">{category.toUpperCase()} ✕</span>
                      </button>
                    )}
                  </div>
                  <label className="shop-sort">
                    <SlidersHorizontal size={14} />
                    <ThemedSelect aria-label="Sort articles" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
                      <option value="newest">Newest arrivals</option>
                      <option value="low">Price: low to high</option>
                      <option value="high">Price: high to low</option>
                    </ThemedSelect>
                  </label>
                </div>
              </div>
            )}

            {loading ? (
              <div className="shop-empty" role="status"><LoaderCircle className="spin" /><p>Finding your favourites...</p></div>
            ) : catalogueError ? (
              <div className="shop-empty" role="alert"><p>{catalogueError}</p><button className="s-button" onClick={() => setReload(v => v + 1)}>Try again</button></div>
            ) : articles.length ? (
              <>
                <div className="shop-products">
                  {articles.map(article => (
                    <article className="shop-product" key={article.id}>
                      <div className="shop-product-image">
                        <div className="product-image-wrap">
                          <ProductImage article={article} onOpen={() => viewArticle(article)} />
                        </div>
                        {Number(article.discount) > 0 && <span className="shop-discount">{Number(article.discount)}% OFF</span>}
                        <button
                          type="button"
                          className={`shop-heart ${saved.includes(article.id) ? 'is-saved' : ''}`}
                          aria-label={`${saved.includes(article.id) ? 'Unsave' : 'Save'} ${article.name}`}
                          aria-pressed={saved.includes(article.id)}
                          onClick={e => toggleSave(article.id, e)}
                        >
                          <Heart size={18} />
                        </button>
                        <button
                          type="button"
                          className="shop-card-bag"
                          disabled={article.quantity === 0}
                          aria-label={article.quantity === 0 ? 'Sold out' : `Add ${article.name} to bag`}
                          title={article.quantity === 0 ? 'Sold out' : 'Add to bag'}
                          onClick={e => {
                            e.stopPropagation();
                            if (article.quantity > 0) addToBag(article, 1);
                          }}
                        >
                          <span className="card-bag-label">{article.quantity === 0 ? 'Sold out' : 'Add to bag'}</span>
                          <ShoppingBag size={17} />
                        </button>
                      </div>
                      <div className="shop-product-details">
                        <div className="product-collection-name">{settings.slides.find(s => s.id === article.category)?.label} <span>Size {article.size}</span></div>
                        <h3><button onClick={() => viewArticle(article)}>{article.name}</button></h3>
                        <ProductPrice article={article} />
                      </div>
                    </article>
                  ))}
                </div>
                {view === 'explore' && catalogue.pages > 1 && (
                  <nav className="shop-pagination" aria-label="Catalogue pagination">
                    <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><ChevronLeft size={18} /></button>
                    <span>Page {page} of {catalogue.pages}</span>
                    <button type="button" aria-label="Next page" disabled={page >= catalogue.pages} onClick={() => { setPage(p => Math.min(catalogue.pages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><ChevronRight size={18} /></button>
                  </nav>
                )}
              </>
            ) : (
              <div className="shop-empty">
                <span className="shop-empty-icon">{view === 'favorites' ? <Heart size={30} /> : <Shirt size={30} />}</span>
                <h3>{view === 'favorites' ? 'Your saved collection is empty.' : search ? 'No matches just yet.' : 'Fresh favourites are on their way.'}</h3>
                <p>{view === 'favorites' ? 'Tap the heart icon on any piece in the shop to save it here for later.' : search ? 'Try a different name or explore another collection.' : 'Come back soon for new pieces picked for your everyday.'}</p>
                {(view === 'favorites' || category || search) && <button className="s-button light" onClick={() => browse('')}>Explore all styles <ArrowRight size={17} /></button>}
                {user?.usertype === 'admin' && <a className="s-text-link" href="/admin">Add your first article <Plus size={16} /></a>}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="shop-footer">
        <div><Logo name={settings.storeName} onHome={goHome} /><p>{settings.footerTagline}</p></div>
        <div className="shop-footer-links">
          <button onClick={goHome}>Home</button>
          <button onClick={() => browse('')}>All styles</button>
          <button onClick={showSaved}>Wishlist</button>
          <a href="/login">{user ? 'My account' : 'Sign in'}</a>
          <a href="/admin">Store admin <ArrowUpRight size={13} /></a>
        </div>
        <div className="shop-socials" aria-label="Fashion Hub social links">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><img src="/images/instagram-icon.png" alt="" /></a>
          <a href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook"><img src="/images/fb-iccon.png" alt="" /></a>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="WhatsApp Fashion Hub"><img src="/images/whatsapp-icon.png" alt="" /></a>
        </div>
        <small>(c) {new Date().getFullYear()} {settings.storeName}. Made for your everyday.</small>
      </footer>

      <nav className="shop-bottom-nav" aria-label="Mobile shopping">
        <button type="button" className={view === 'home' ? 'active' : ''} onClick={goHome}>
          <Home size={20} />
          <span>Home</span>
        </button>
        <button type="button" className={view === 'explore' ? 'active' : ''} onClick={() => browse('')}>
          <Shirt size={20} />
          <span>Explore</span>
        </button>
        <button type="button" className={view === 'favorites' ? 'active' : ''} onClick={showSaved}>
          <Heart size={20} />
          <span>Saved</span>
          {saved.length > 0 && <small className="nav-count-badge">{saved.length}</small>}
        </button>
        <button type="button" className={bagOpen ? 'active' : ''} onClick={() => setBagOpen(true)}>
          <ShoppingBag size={20} />
          <span>Bag</span>
          {total > 0 && <small className="nav-count-badge">{total}</small>}
        </button>
        <button type="button" className={account ? 'active' : ''} onClick={() => user ? setAccount(!account) : window.location.assign('/login')}>
          <User size={20} />
          <span>Account</span>
        </button>
      </nav>

      {selected && <ProductDialog article={selected} onClose={() => setSelected(null)} onAdd={addToBag} isSaved={saved.includes(selected.id)} onToggleSave={toggleSave} />}
      {bagOpen && <Bag items={bag} setItems={setBag} onClose={() => setBagOpen(false)} onBrowse={() => { setBagOpen(false); browse(''); }} phone={settings.phone} />}
      {notice && <div className="shop-toast" role="status"><Check size={17} /><span>{notice}</span></div>}
    </div>
  );
}

function Logo({ name, onHome }) {
  return (
    <a
      href="/"
      className="shop-brand"
      aria-label={`${name} home`}
      onClick={e => {
        if (onHome) {
          e.preventDefault();
          onHome();
        }
      }}
    >
      <span className="brand-mark logo-image-mark"><img src="/images/fhub-logo.jpeg" alt="" /></span>
      <span className="brand-name">{name}</span>
    </a>
  );
}

function CategoryAvatarStrip({ category = '', onSelect, className = '' }) {
  const categories = [
    { id: 'ladies', label: 'Ladies', image: '/images/categories/ladies.png' },
    { id: 'gents', label: 'Gents', image: '/images/categories/gents.png' },
    { id: 'kids', label: 'Kids', image: '/images/categories/kids.png' },
    { id: 'accessories', label: 'Accessories', image: '/images/categories/accessories.png' }
  ];

  return (
    <div className={`explore-category-strip ${className}`} role="tablist" aria-label="Shop by category">
      {categories.map(cat => {
        const isSelected = category === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`explore-category-card ${isSelected ? 'active' : ''}`}
            onClick={() => onSelect && onSelect(cat.id)}
          >
            <div className="category-avatar-wrapper">
              <img
                src={cat.image}
                alt=""
                className="category-avatar-img"
                loading="eager"
              />
            </div>
            <span className="category-avatar-label">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MovingBanner({ onBrowse }) {
  const items = ['FASHION HUB', 'NEW ARRIVALS', 'KIDS', 'GENTS', 'LADIES', 'FRESH PICKS', 'ACCESSORIES'];
  const loop = [...items, ...items, ...items, ...items];
  return (
    <div className="marquee-banner-wrapper">
      <button
        type="button"
        className="marquee-banner-pill"
        onClick={() => onBrowse && onBrowse('')}
        aria-label="Explore all styles in Fashion Hub"
        title="Click to explore all styles"
      >
        <span className="marquee-pill-icon" aria-hidden="true">
          <Megaphone size={15} />
        </span>
        <div className="marquee-pill-content">
          <div className="marquee-track">
            {loop.map((item, index) => (
              <span key={item + '-' + index}>{item}</span>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
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
  return <section className={`shop-hero hero-${slide.id}`} aria-roledescription="carousel" aria-label="Kids, gents and ladies showcase" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => { }} onKeyDown={e => { if (e.key === `ArrowLeft`) advance(-1); if (e.key === `ArrowRight`) advance(1); }}><div className="shop-hero-copy" aria-live={playing ? `off` : `polite`}><span className="s-eyebrow"><i />{slide.eyebrow}</span><h1>{slide.title}</h1><p>{slide.description}</p><div className="shop-hero-buttons"><button className="s-button hero-final-button" onClick={() => onBrowse(slide.id)}>{slide.buttonLabel}<ArrowUpRight size={18} /></button>{article && <button className="s-text-link hero-featured-link" onClick={() => onArticle(article)}>{article.name}<ArrowRight size={16} /></button>}</div><div className="hero-bottom-note"><p>{slide.message}<br /><strong>{heroPrice}</strong></p></div></div><div className="shop-hero-picture" role="button" tabIndex={0} aria-label={`Explore ${slide.label} collection`} onClick={() => onBrowse(slide.id)} onKeyDown={e => { if (e.key === `Enter` || e.key === ` `) { e.preventDefault(); onBrowse(slide.id); } }} onTouchStart={e => { startX.current = e.touches[0].clientX; }} onTouchEnd={e => { if (startX.current === null) return; const delta = e.changedTouches[0].clientX - startX.current; if (Math.abs(delta) > 60) { advance(delta < 0 ? 1 : -1); startX.current = null; return; } startX.current = null; }}><div className="hero-carousel-strip" style={{ transform: `translateX(-${index * 100}%)` }}>{settings.slides.map(item => <CroppedImage key={item.id} image={item.image} crop={item.imageCrop} alt={`${item.label} collection`} priority={item.id === slide.id ? `high` : `auto`} />)}</div></div></section>;
}

function FeaturedArticles({ settings, featured, onBrowse, onArticle, onAdd, saved = [], onToggleSave }) {
  const items = [...new Map((featured || []).map(item => [item.id, item])).values()].slice(0, 6);
  return (
    <section className="shop-section featured-section" id="featured">
      <div className="fresh-picks-header">
        <h2 className="fresh-picks-title">Fresh Picks</h2>
        <button type="button" className="fresh-picks-view-all" onClick={() => onBrowse && onBrowse('')}>
          <span>View All</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {items.length ? (
        <>
          <div className="shop-products featured-products home-top-products">
            {items.map(article => (
              <article className="shop-product" key={article.id}>
                <div className="shop-product-image">
                  <div className="product-image-wrap">
                    <ProductImage article={article} onOpen={() => onArticle(article)} />
                  </div>
                  {Number(article.discount) > 0 && <span className="shop-discount">{Number(article.discount)}% OFF</span>}
                  <button
                    type="button"
                    className={`shop-heart ${saved.includes(article.id) ? 'is-saved' : ''}`}
                    aria-label={`${saved.includes(article.id) ? 'Unsave' : 'Save'} ${article.name}`}
                    aria-pressed={saved.includes(article.id)}
                    onClick={e => onToggleSave && onToggleSave(article.id, e)}
                  >
                    <Heart size={18} />
                  </button>
                  <button
                    type="button"
                    className="shop-card-bag"
                    disabled={article.quantity === 0}
                    aria-label={article.quantity === 0 ? 'Sold out' : `Add ${article.name} to bag`}
                    title={article.quantity === 0 ? 'Sold out' : 'Add to bag'}
                    onClick={e => {
                      e.stopPropagation();
                      if (article.quantity > 0 && onAdd) onAdd(article, 1);
                    }}
                  >
                    <span className="card-bag-label">{article.quantity === 0 ? 'Sold out' : 'Add to bag'}</span>
                    <ShoppingBag size={17} />
                  </button>
                </div>
                <div className="shop-product-details">
                  <div className="product-collection-name">{settings.slides.find(s => s.id === article.category)?.label || `All styles`} <span>Size {article.size}</span></div>
                  <h3><button onClick={() => onArticle(article)}>{article.name}</button></h3>
                  <ProductPrice article={article} />
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="shop-empty compact-empty">
          <span className="shop-empty-icon"><Shirt size={28} /></span>
          <h3>No top articles yet.</h3>
            <p>Pin articles in the admin inventory to feature them here.</p>
        </div>
      )}
    </section>
  );
}

function ProductPrice({ article }) {
  const discounted = Number(article.discount) > 0;
  return <div className="product-price-row"><div className="product-price-stack"><strong>{money(salePrice(article))}</strong>{discounted ? <del>{money(article.price)}</del> : <span className="price-placeholder" aria-hidden="true">&nbsp;</span>}</div>{article.quantity === 0 ? <span className="product-stock-out">Sold out</span> : article.quantity <= 5 && <span className="product-stock-low">Only {article.quantity} left</span>}</div>;
}

function ProductImage({ article, onOpen }) {
  const images = (article.images || []).filter(img => img.url);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    if (images.length <= 1 || hovered) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [images.length, hovered]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    setHovered(true);
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true;
      if (dx < 0) {
        setIndex(prev => (prev + 1) % images.length);
      } else {
        setIndex(prev => (prev - 1 + images.length) % images.length);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setTimeout(() => {
      didSwipe.current = false;
      setHovered(false);
    }, 350);
  };

  const handleClick = (e) => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    if (onOpen) onOpen();
  };

  if (!images.length || failed) {
    return (
      <span className="shop-image-placeholder" onClick={handleClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleClick(e); }}>
        <Shirt size={38} />
        <small>{article.name}</small>
      </span>
    );
  }

  if (images.length === 1) {
    return (
      <div className="product-image-single" onClick={handleClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleClick(e); }}>
        <img src={images[0].url} alt={article.name} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div
      className="product-image-slider"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter') handleClick(e);
        if (e.key === 'ArrowLeft') { e.stopPropagation(); setIndex(prev => (prev - 1 + images.length) % images.length); }
        if (e.key === 'ArrowRight') { e.stopPropagation(); setIndex(prev => (prev + 1) % images.length); }
      }}
    >
      <div className="product-image-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((img, i) => (
          <img key={img.url || i} src={img.url} alt={`${article.name} ${i + 1}`} loading="lazy" onError={() => setFailed(true)} />
        ))}
      </div>

      <div className="product-carousel-dots" onClick={e => e.stopPropagation()}>
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`product-carousel-dot ${i === index ? 'active' : ''}`}
            aria-label={`Go to photo ${i + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              setIndex(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ShopModal({ title, children, onClose, className = '', closeDisabled = false }) {
  const ref = useRef(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const animated = className.split(' ').includes('product-modal');
  function requestClose() {
    if (closeDisabled || closeTimer.current !== null) return;
    if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onCloseRef.current();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => onCloseRef.current(), 180);
  }
  const closer = useRef(requestClose); closer.current = requestClose;
  useEffect(() => {
    const oldFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current.querySelector('button').focus();
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
    return () => { clearTimeout(closeTimer.current); document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', key); if (oldFocus?.isConnected) oldFocus.focus(); };
  }, []);
  return <div className={`shop-overlay ${className} ${closing ? 'is-closing' : ''}`} onClick={requestClose}><section ref={ref} className="shop-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-dialog-title" onClick={e => e.stopPropagation()}><div className="shop-dialog-heading"><h2 id="shop-dialog-title">{title}</h2><button aria-label="Close dialog" disabled={closeDisabled || closing} onClick={requestClose}><X size={22} /></button></div>{children}</section></div>;
}

function ProductDialog({ article, onClose, onAdd, isSaved = false, onToggleSave }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const images = (article.images || []).filter(img => img.url);

  useEffect(() => {
    if (images.length <= 1 || hovered) return;
    const timer = setInterval(() => {
      setImageIndex(prev => (prev + 1) % images.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [images.length, hovered]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setHovered(true);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        setImageIndex(prev => (prev + 1) % images.length);
      } else {
        setImageIndex(prev => (prev - 1 + images.length) % images.length);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setTimeout(() => setHovered(false), 500);
  };

  return (
    <ShopModal title="Product Details" onClose={onClose} closeDisabled={busy} className="product-modal">
      <div className="shop-detail">
        <div className="shop-detail-gallery">
          <div
            className="detail-main-image"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {images.length > 1 ? (
              <div className="product-image-slider">
                <div className="product-image-track" style={{ transform: `translateX(-${imageIndex * 100}%)` }}>
                  {images.map((img, i) => <img key={img.url || i} src={img.url} alt={`${article.name} ${i + 1}`} />)}
                </div>
              </div>
            ) : images[0] ? (
              <img src={images[0].url} alt={article.name} />
            ) : (
              <ProductImage article={article} />
            )}

            <button
              type="button"
              className={`shop-heart modal-heart ${isSaved ? 'is-saved' : ''}`}
              aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={isSaved}
              onClick={e => onToggleSave && onToggleSave(article.id, e)}
            >
              <Heart size={20} />
            </button>
            <button
              type="button"
              className="modal-whatsapp-share"

              aria-label="Enquire about this product on WhatsApp"
              title="Enquire on WhatsApp"
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); window.location.assign(productWhatsAppUrl(article, window.location.origin, whatsappNumber)); }}
            >
              <img src="/images/whatsapp-icon.png" alt="" />
            </button>
          </div>

          {images.length > 1 && (
            <div className="shop-thumbnails">
              {images.map((image, i) => (
                <button key={i} aria-label={`View image ${i + 1}`} aria-pressed={i === imageIndex} onClick={() => setImageIndex(i)}>
                  <img src={image.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shop-detail-info">
          <span className="s-eyebrow">{article.category} COLLECTION</span>
          <h3>{article.name}</h3>
          <div className="detail-pricing">
            <strong>{money(salePrice(article))}</strong>
            {Number(article.discount) > 0 && (
              <>
                <del>{money(article.price)}</del>
                <span>{Number(article.discount)}% off</span>
              </>
            )}
          </div>
          <div className="detail-size">
            <span>Your fit</span>
            <strong>{article.size}</strong>
          </div>
          <p className="detail-stock">
            {article.quantity > 0 ? (
              article.quantity <= 5 ? (
                <span className="detail-stock-low">Only {article.quantity} left in store</span>
              ) : (
                `${article.quantity} available in store`
              )
            ) : (
              'Currently out of stock'
            )}
          </p>
          {article.quantity > 0 && (
            <div className="detail-quantity">
              <span>Quantity</span>
              <div>
                <button aria-label="Decrease quantity" disabled={qty <= 1 || busy} onClick={() => setQty(v => v - 1)}>
                  <Minus size={16} />
                </button>
                <span>{qty}</span>
                <button aria-label="Increase quantity" disabled={qty >= article.quantity || busy} onClick={() => setQty(v => v + 1)}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
          <div className="detail-actions-group">
            <button
              className="s-button detail-add-btn"
              disabled={article.quantity === 0 || busy}
              onClick={async () => {
                setBusy(true);
                await onAdd(article, qty);
                setBusy(false);
              }}
            >
              {busy ? 'Adding...' : article.quantity === 0 ? 'Sold out' : 'Add to bag'}
              <ShoppingBag size={18} />
            </button>
            <button
              type="button"
              className={`detail-wishlist-btn ${isSaved ? 'is-saved' : ''}`}
              aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
              aria-pressed={isSaved}
              onClick={e => onToggleSave && onToggleSave(article.id, e)}
            >
              <Heart size={18} />
              <span>{isSaved ? 'Saved' : 'Wishlist'}</span>
            </button>
          </div>
          <small>Your bag saves your favourites for a store enquiry. Availability is confirmed when you purchase.</small>
        </div>
      </div>
    </ShopModal>
  );
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
      setChanged(next.length !== items.length || next.some((item, i) => item.qty !== items[i].qty || item.price !== items[i].price || item.discount !== items[i].discount));
      setItems(next);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  const total = items.reduce((sum, item) => sum + salePrice(item) * item.qty, 0);
  return <ShopModal title="Your little collection." onClose={onClose} className="bag-modal">{checking ? <div className="shop-empty"><LoaderCircle className="spin" /><p>Checking the latest stock...</p></div> : error ? <div className="shop-empty" role="alert"><p>{error}</p><button className="s-button light" onClick={onClose}>Close and try again</button></div> : !items.length ? <div className="shop-empty"><ShoppingBag size={32} /><h3>A little room for something you love.</h3><p>Your bag is waiting for its first favourite.</p><button className="s-button" onClick={onBrowse}>Explore the collection <ArrowRight size={17} /></button></div> : <><div className="live-bag-items">{changed && <p className="bag-update" role="status">Your bag has been updated with the latest prices and available stock.</p>}{items.map(item => <article className="live-bag-item" key={item.id}><div><ProductImage article={item} /></div><div><h3>{item.name}</h3><p>Size {item.size}</p><strong>{money(salePrice(item))}</strong><div className="live-bag-quantity"><button aria-label={`Remove one ${item.name}`} onClick={() => setItems(previous => previous.map(p => p.id === item.id ? { ...p, qty: p.qty - 1 } : p).filter(p => p.qty > 0))}><Minus size={14} /></button><span>{item.qty}</span><button aria-label={`Add one ${item.name}`} disabled={item.qty >= item.quantity} onClick={() => setItems(previous => previous.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p))}><Plus size={14} /></button></div></div><button aria-label={`Remove ${item.name}`} onClick={() => setItems(previous => previous.filter(p => p.id !== item.id))}><X size={17} /></button></article>)}</div><div className="live-bag-total"><div><span>Estimated total</span><strong>{money(total)}</strong></div><p>Contact the store to confirm availability and place your order. No payment is taken online.</p>{phone ? <a className="s-button" href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Phone size={17} /> Call the store</a> : <button className="s-button" onClick={() => { onClose(); document.getElementById('contact').scrollIntoView({ behavior: 'smooth' }); }}>Visit the store <ArrowUpRight size={17} /></button>}</div></>}</ShopModal>;
}

function SidebarDrawer({
  open,
  onClose,
  settings,
  user,
  savedCount,
  bagCount,
  onGoHome,
  onBrowse,
  onSaved,
  onOpenBag,
  onOpenSearch,
  onSignOut,
  phone,
  whatsappUrl,
  mapUrl,
  mapQuery
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={`shop-sidebar-overlay ${open ? 'open' : ''}`}
      onClick={onClose}
      aria-hidden={!open}
    >
      <aside
        className="shop-sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Store navigation drawer"
        onClick={e => e.stopPropagation()}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-mark logo-image-mark">
              <img src="/images/fhub-logo.jpeg" alt="" />
            </span>
            <div className="sidebar-brand-text">
              <strong>{settings?.storeName || 'Fashion Hub'}</strong>
              <small>TURKAULIYA • BIHAR</small>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-body">
          {/* Quick Shopping Bar (Wishlist & Bag) */}
          <div className="sidebar-quick-bar">
            <button type="button" className="sidebar-quick-card" onClick={onSaved}>
              <Heart size={18} />
              <div className="quick-card-text">
                <span>Wishlist</span>
                <small>{savedCount} saved</small>
              </div>
              {savedCount > 0 && <b className="quick-badge">{savedCount}</b>}
            </button>
            <button type="button" className="sidebar-quick-card" onClick={onOpenBag}>
              <ShoppingBag size={18} />
              <div className="quick-card-text">
                <span>My Bag</span>
                <small>{bagCount} items</small>
              </div>
              {bagCount > 0 && <b className="quick-badge">{bagCount}</b>}
            </button>
          </div>

          {/* Quick Search */}
          <button type="button" className="sidebar-search-btn" onClick={onOpenSearch}>
            <Search size={16} />
            <span>Search clothes & fits...</span>
          </button>

          {/* Main Navigation */}
          <div className="sidebar-section">
            <span className="sidebar-eyebrow">EXPLORE STORE</span>
            <button type="button" className="sidebar-nav-link" onClick={onGoHome}>
              <span className="sidebar-icon-box"><Home size={17} /></span>
              <span>Home Storefront</span>
              <ChevronRight size={15} className="sidebar-arrow" />
            </button>
            <button type="button" className="sidebar-nav-link" onClick={() => onBrowse('')}>
              <span className="sidebar-icon-box"><Shirt size={17} /></span>
              <span>All Styles & Fits</span>
              <span className="sidebar-tag">New</span>
            </button>
          </div>

          {/* Collections */}
          <div className="sidebar-section">
            <span className="sidebar-eyebrow">COLLECTIONS</span>
            <div className="sidebar-collections-list">
              {(settings?.slides || []).map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  className="sidebar-collection-item"
                  onClick={() => onBrowse(slide.id)}
                >
                  <div className="collection-item-left">
                    <span className="collection-number">0{idx + 1}</span>
                    <div>
                      <strong>{slide.label}</strong>
                      <small>{slide.eyebrow || 'Everyday fit'}</small>
                    </div>
                  </div>
                  <ArrowUpRight size={17} className="collection-item-arrow" />
                </button>
              ))}
              <button
                type="button"
                className="sidebar-collection-item"
                onClick={() => onBrowse('accessories')}
              >
                <div className="collection-item-left">
                  <span className="collection-number">04</span>
                  <div>
                    <strong>Accessories</strong>
                    <small>Shoes, bags & lifestyle</small>
                  </div>
                </div>
                <ArrowUpRight size={17} className="collection-item-arrow" />
              </button>
            </div>
          </div>

          {/* User Account / Admin */}
          <div className="sidebar-section">
            <span className="sidebar-eyebrow">ACCOUNT & STORE</span>
            {user ? (
              <div className="sidebar-user-box">
                <div className="sidebar-user-header">
                  <div className="sidebar-user-avatar">
                    <User size={18} />
                  </div>
                  <div className="sidebar-user-meta">
                    <strong>{user.email}</strong>
                    <span className="sidebar-user-role">
                      {user.usertype === 'admin' ? 'Store Administrator' : 'Customer'}
                    </span>
                  </div>
                </div>
                {user.usertype === 'admin' && (
                  <a href="/admin" className="sidebar-admin-btn">
                    <SlidersHorizontal size={15} />
                    <span>Store Admin Dashboard</span>
                    <ArrowUpRight size={14} />
                  </a>
                )}
                <button type="button" className="sidebar-logout-btn" onClick={onSignOut}>
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <a href="/login" className="sidebar-login-card">
                <span className="sidebar-icon-box"><User size={17} /></span>
                <div>
                  <strong>Customer & Admin Sign In</strong>
                  <small>Sign in to manage orders & store</small>
                </div>
                <ArrowRight size={16} />
              </a>
            )}
          </div>

          {/* Store Info & Direct Contact */}
          <div className="sidebar-section">
            <span className="sidebar-eyebrow">VISIT & CONTACT</span>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="sidebar-whatsapp-action"
            >
              <MessageCircle size={18} />
              <div className="action-meta">
                <strong>WhatsApp Orders & Enquiry</strong>
                <small>Instant reply • {phone || '+91 93308 20717'}</small>
              </div>
              <ArrowUpRight size={16} />
            </a>

            {phone && (
              <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="sidebar-action-row">
                <span className="sidebar-icon-box"><Phone size={16} /></span>
                <span>Call Store ({phone})</span>
              </a>
            )}

            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="sidebar-location-card"
            >
              <span className="sidebar-icon-box"><MapPin size={17} /></span>
              <div className="location-info">
                <strong>Fashion Hub, Turkauliya</strong>
                <small>{settings?.address || mapQuery}</small>
              </div>
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-socials">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
              <img src="/images/instagram-icon.png" alt="" />
            </a>
            <a href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook">
              <img src="/images/fb-iccon.png" alt="" />
            </a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <img src="/images/whatsapp-icon.png" alt="" />
            </a>
          </div>
          <p className="sidebar-footer-note">
            Made for your everyday. © {new Date().getFullYear()} {settings?.storeName || 'Fashion Hub'}
          </p>
        </div>
      </aside>
    </div>
  );
}
