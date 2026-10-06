import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BookOpen, Check, Compass, Film, Headphones, LoaderCircle, MapPin, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import './style.css';

type EntityType = 'movie' | 'artist' | 'book' | 'place';
type Entity = { id: string; name: string; type: EntityType; imageUrl: string | null };
type Recommendation = Entity & { basis: Pick<Entity, 'id' | 'name' | 'type'>[] };
type Plan = { recommendations: Recommendation[]; locationUnavailable: boolean; mood: string; city: string };
type ApiError = { error?: { code: string; message: string } };

const typeLabels: Record<EntityType, string> = { movie: 'Film', artist: 'Music', book: 'Book', place: 'Place' };
const icons = { movie: Film, artist: Headphones, book: BookOpen, place: MapPin };
const moods = ['Curious', 'Reflective', 'Playful', 'Slow'];
const cities = ['Shanghai', 'Hangzhou', 'New York', 'London'];

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error('Connection lost. Check your network and try again.');
  }
  const data = await response.json() as T & ApiError;
  if (!response.ok) throw new Error(data.error?.message ?? 'The request failed. Please try again.');
  return data;
}

function TastePicker({ slot, value, onChange }: { slot: number; value: Entity | null; onChange: (entity: Entity | null) => void }) {
  const [type, setType] = useState<'movie' | 'artist' | 'book'>('movie');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (value || query.trim().length < 2) {
      setResults([]);
      setMessage('');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      try {
        const data = await api<{ entities: Entity[] }>(`/api/search?query=${encodeURIComponent(query)}&type=${type}`, { signal: controller.signal });
        setResults(data.entities);
        if (data.entities.length === 0) setMessage('No Qloo matches. Try another title or name.');
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Search failed.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, type, value]);

  return (
    <div className="taste-row">
      <span className="taste-number">0{slot + 1}</span>
      <div className="taste-main">
        {value ? (
          <div className="selected-entity">
            <span className="selected-icon">{React.createElement(icons[value.type], { size: 18 })}</span>
            <span><strong>{value.name}</strong><small>{typeLabels[value.type]} · Qloo entity</small></span>
            <button className="icon-button" type="button" aria-label={`Remove ${value.name}`} title="Remove selection" onClick={() => { onChange(null); setQuery(''); }}><X size={17} /></button>
          </div>
        ) : (
          <>
            <div className="picker-controls">
              <select aria-label={`Preference ${slot + 1} category`} value={type} onChange={(event) => { setType(event.target.value as 'movie' | 'artist' | 'book'); setResults([]); }}>
                <option value="movie">Film</option><option value="artist">Music</option><option value="book">Book</option>
              </select>
              <div className="search-field"><Search size={17} /><input aria-label={`Preference ${slot + 1}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Qloo titles or creators" /></div>
              {loading && <LoaderCircle className="spin" size={17} aria-label="Searching" />}
            </div>
            {message && <p className="field-message" role="status">{message}</p>}
            {results.length > 0 && <div className="search-results" role="listbox" aria-label="Qloo search results">
              {results.map((entity) => <button key={entity.id} type="button" role="option" aria-selected="false" onClick={() => { onChange(entity); setResults([]); }}>
                <span>{entity.name}</span><small>{typeLabels[entity.type] ?? typeLabels[type]}</small>
              </button>)}
            </div>}
          </>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ item, index, replacing, onReplace }: { item: Recommendation; index: number; replacing: boolean; onReplace: () => void }) {
  const Icon = icons[item.type] ?? Sparkles;
  return <article className="recommendation">
    <div className={`recommendation-visual visual-${item.type}`}>
      {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <Icon size={35} strokeWidth={1.35} aria-hidden="true" />}
      <span className="card-index">0{index + 1}</span>
    </div>
    <div className="recommendation-content">
      <div className="recommendation-top"><span className="eyebrow">{typeLabels[item.type]} suggestion</span><Check size={15} aria-label="Qloo result" /></div>
      <h3>{item.name}</h3>
      <p>Recommended by Qloo Insights using your three selected tastes as signals.</p>
      <div className="basis">{item.basis.map((basis) => <span key={basis.id}>{basis.name}</span>)}</div>
      <button className="replace-button" type="button" disabled={replacing} onClick={onReplace}>
        <RefreshCw size={16} className={replacing ? 'spin' : ''} />{replacing ? 'Finding another…' : 'Not for me · replace'}
      </button>
    </div>
  </article>;
}

function App() {
  const [favorites, setFavorites] = useState<(Entity | null)[]>([null, null, null]);
  const [mood, setMood] = useState('Curious');
  const [city, setCity] = useState('Shanghai');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [excluded, setExcluded] = useState<string[]>([]);
  const selected = favorites.filter((entity): entity is Entity => Boolean(entity));
  const ready = selected.length === 3 && new Set(selected.map((entity) => entity.id)).size === 3;

  function updateFavorite(index: number, entity: Entity | null) {
    setFavorites((previous) => previous.map((old, position) => position === index ? entity : old));
    setPlan(null); setExcluded([]); setError(''); setNotice('');
  }

  async function create() {
    if (!ready) return;
    setBusy(true); setError(''); setNotice(''); setPlan(null); setExcluded([]);
    try {
      const data = await api<{ plan: Plan }>('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', favorites: selected, mood, city }) });
      setPlan(data.plan);
      if (data.plan.recommendations.length === 0) setNotice('Qloo returned no suggestions for these tastes. Try different favorites.');
      else if (data.plan.recommendations.length < 3) setNotice(`Qloo returned only ${data.plan.recommendations.length} distinct suggestions for these tastes.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create your trail.'); }
    finally { setBusy(false); }
  }

  async function replace(item: Recommendation) {
    if (!plan) return;
    setReplacingId(item.id); setError(''); setNotice('');
    const excludedIds = [...new Set([...excluded, ...plan.recommendations.map((entity) => entity.id)])];
    try {
      const data = await api<{ recommendation: Recommendation | null }>('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'replace', favorites: selected, mood, city, targetType: item.type, excludedIds }) });
      if (data.recommendation) {
        setPlan({ ...plan, recommendations: plan.recommendations.map((entity) => entity.id === item.id ? data.recommendation! : entity) });
        setExcluded(excludedIds);
      } else {
        setNotice(`No unseen ${typeLabels[item.type].toLowerCase()} result is available from Qloo right now. Try a new set of tastes.`);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Replacement failed.'); }
    finally { setReplacingId(null); }
  }

  return <div className="app-shell">
    <header className="site-header"><div className="brand"><span className="brand-mark"><Compass size={19} /></span><strong>Taste Trail</strong><span className="brand-divider" /><span>Weekend culture agent</span></div><a className="header-link" href="https://www.qloo.com/" target="_blank" rel="noreferrer">Powered by Qloo <ArrowRight size={14} /></a></header>
    <main>
      <div className="intro"><div><span className="eyebrow intro-label">YOUR TASTES, A NEW DIRECTION</span><h1>Make room for<br /><em>something different.</em></h1><p>Choose three things you love. Qloo finds a fresh cultural thread for your weekend.</p></div><span className="intro-symbol" aria-hidden="true"><Compass size={128} strokeWidth={0.75} /></span></div>
      <div className="workspace">
        <section className="input-panel" aria-labelledby="input-title"><div className="section-heading"><span className="step">01 / YOUR SIGNALS</span><h2 id="input-title">What stays with you?</h2><p>Search Qloo for three films, musicians, or books.</p></div>
          <div className="taste-list">{favorites.map((entity, index) => <TastePicker key={index} slot={index} value={entity} onChange={(next) => updateFavorite(index, next)} />)}</div>
          <div className="settings"><div><label htmlFor="city">City</label><select id="city" value={city} onChange={(event) => { setCity(event.target.value); setPlan(null); }}><option value="Shanghai">Shanghai</option><option value="Hangzhou">Hangzhou</option><option value="New York">New York</option><option value="London">London</option></select></div><div><label htmlFor="mood">Mood</label><select id="mood" value={mood} onChange={(event) => { setMood(event.target.value); setPlan(null); }}>{moods.map((option) => <option key={option}>{option}</option>)}</select></div></div>
          <button className="create-button" type="button" disabled={!ready || busy} onClick={create}>{busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{busy ? 'Finding your trail…' : 'Find my weekend trail'}<ArrowRight size={18} /></button>
          {!ready && selected.length === 3 && <p className="field-message">Choose three different Qloo entities.</p>}
          <p className="input-footnote">Your mood orders the categories. Qloo supplies the results; venue hours and events are not inferred.</p>
        </section>
        <section className="output-panel" aria-labelledby="output-title"><div className="section-heading output-heading"><span className="step">02 / YOUR TRAIL</span><h2 id="output-title">A few good directions.</h2><p>{plan ? `${plan.city} · ${plan.mood} mood` : 'Your results will appear here.'}</p></div>
          {error && <div className="alert error" role="alert">{error}</div>}
          {notice && <div className="alert" role="status">{notice}</div>}
          {plan?.locationUnavailable && <div className="alert" role="status">Qloo has no supported places for this city and taste mix. Here are culture picks instead; no venue details are invented.</div>}
          {plan && plan.recommendations.length > 0 ? <div className="recommendations">{plan.recommendations.map((item, index) => <RecommendationCard key={item.id} item={item} index={index} replacing={replacingId === item.id} onReplace={() => replace(item)} />)}</div> : <div className="empty-state"><Compass size={55} strokeWidth={1} /><span>THE UNWRITTEN WEEKEND</span><p>{busy ? 'Asking Qloo to connect your tastes…' : 'Your next discovery begins with three favorites.'}</p></div>}
          {plan && <p className="source-note">Source: Qloo Search + Insights. Results reflect taste signals, not guaranteed opening hours, events, or availability.</p>}
        </section>
      </div>
    </main>
    <footer><span>Taste Trail · An independent Qloo hackathon project</span><span>Made for discovery, grounded in data.</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
